import { lstat, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, resolve } from 'node:path';
import { loadUserConfig } from './config.js';
import { GitInspector } from './git.js';
import { isProtectedByConfiguration, isProtectedPath, isWithin } from './paths.js';
import { runningProcessCommands, runCommand } from './process.js';
import { PROJECT_RULES } from './rules.js';
const CACHE_RULES = new Set([
    'user-application-cache',
    'dot-cache',
    'npm-cache',
    'yarn-cache',
    'homebrew-cache',
    'xcode-derived-data',
    'xcode-device-support',
]);
function cachePathAllowed(candidate, home) {
    const exactPaths = {
        'npm-cache': resolve(home, '.npm', '_cacache'),
        'yarn-cache': resolve(home, '.yarn', 'berry', 'cache'),
        'homebrew-cache': resolve(home, 'Library', 'Caches', 'Homebrew'),
    };
    const childRoots = {
        'user-application-cache': resolve(home, 'Library', 'Caches'),
        'dot-cache': resolve(home, '.cache'),
        'xcode-derived-data': resolve(home, 'Library', 'Developer', 'Xcode', 'DerivedData'),
        'xcode-device-support': resolve(home, 'Library', 'Developer', 'Xcode', 'iOS DeviceSupport'),
    };
    const exact = exactPaths[candidate.ruleId];
    if (exact) {
        return resolve(candidate.path) === exact;
    }
    const parent = childRoots[candidate.ruleId];
    return parent ? isWithin(parent, candidate.path) : false;
}
async function validateDirectoryCandidate(candidate, git, processCommands, protectedPaths) {
    const home = homedir();
    const path = resolve(candidate.path);
    if (!isAbsolute(candidate.path) || candidate.path !== path) {
        throw new Error('candidate path is not a normalized absolute path');
    }
    if (!isWithin(home, path) ||
        path === home ||
        isProtectedPath(path) ||
        isProtectedByConfiguration(path, protectedPaths)) {
        throw new Error('candidate falls outside the allowed user directory or is protected');
    }
    if (processCommands.includes(path)) {
        throw new Error('candidate is referenced by a running process');
    }
    const stats = await lstat(path);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error('candidate is not a real directory');
    }
    const projectRule = [...PROJECT_RULES.values()].find((rule) => rule.id === candidate.ruleId);
    if (projectRule) {
        if (basename(path) !== projectRule.directoryName) {
            throw new Error('candidate no longer matches its project rule');
        }
        const repository = await git.repositoryFor(path);
        if (repository && (await git.isTracked(repository, path))) {
            throw new Error('candidate contains files tracked by Git');
        }
        return;
    }
    if (!CACHE_RULES.has(candidate.ruleId) || !cachePathAllowed(candidate, home)) {
        throw new Error('candidate no longer matches an approved cache rule');
    }
}
async function cleanDirectory(candidate, git, processCommands, protectedPaths) {
    await validateDirectoryCandidate(candidate, git, processCommands, protectedPaths);
    await rm(candidate.path, { recursive: true, force: false, maxRetries: 2, retryDelay: 100 });
}
async function cleanWorktree(candidate, git, processCommands, protectedPaths) {
    if (!candidate.repository) {
        throw new Error('worktree candidate has no common repository');
    }
    if (processCommands.includes(candidate.path)) {
        throw new Error('worktree is referenced by a running process');
    }
    if (isProtectedByConfiguration(candidate.path, protectedPaths)) {
        throw new Error('worktree is protected by local configuration');
    }
    const blocker = await git.worktreeRemovalBlocker(candidate.path);
    if (blocker) {
        throw new Error(blocker);
    }
    const result = await runCommand('git', ['-C', candidate.repository, 'worktree', 'remove', candidate.path], { timeoutMs: 120_000 });
    if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || 'git worktree remove failed');
    }
    await runCommand('git', ['-C', candidate.repository, 'worktree', 'prune'], {
        timeoutMs: 30_000,
    });
}
async function cleanAction(candidate) {
    let command;
    let args;
    switch (candidate.action) {
        case 'docker-builder-prune':
            command = 'docker';
            args = ['builder', 'prune', '--force'];
            break;
        case 'simulator-delete-unavailable':
            command = 'xcrun';
            args = ['simctl', 'delete', 'unavailable'];
            break;
        case 'git-worktree-prune':
            command = 'git';
            args = ['-C', candidate.path, 'worktree', 'prune', '--verbose'];
            break;
        default:
            throw new Error('unsupported cleanup action');
    }
    const result = await runCommand(command, args, { timeoutMs: 120_000 });
    if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || `${command} failed`);
    }
}
export async function cleanCandidates(candidates) {
    const processCommands = await runningProcessCommands();
    const git = new GitInspector();
    const config = await loadUserConfig();
    const results = [];
    for (const candidate of candidates) {
        if (candidate.blockedReason) {
            results.push({
                candidate,
                ok: false,
                bytesReclaimed: 0,
                error: candidate.blockedReason,
            });
            continue;
        }
        try {
            if (candidate.kind === 'directory') {
                await cleanDirectory(candidate, git, processCommands, config.protectedPaths);
            }
            else if (candidate.kind === 'git-worktree') {
                await cleanWorktree(candidate, git, processCommands, config.protectedPaths);
            }
            else {
                await cleanAction(candidate);
            }
            results.push({
                candidate,
                ok: true,
                bytesReclaimed: candidate.sizeBytes,
            });
        }
        catch (error) {
            results.push({
                candidate,
                ok: false,
                bytesReclaimed: 0,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return {
        results,
        bytesReclaimed: results.reduce((total, result) => total + result.bytesReclaimed, 0),
    };
}
//# sourceMappingURL=cleaner.js.map