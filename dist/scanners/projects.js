import { lstat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';
import { mapLimit } from '../core/concurrency.js';
import { candidateId } from '../core/id.js';
import { isProtectedByConfiguration, isProtectedPath } from '../core/paths.js';
import { PROJECT_RULES } from '../core/rules.js';
import { directorySize } from '../core/size.js';
const MAX_DEPTH = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
export async function scanProjectArtifacts(options, git, processCommands) {
    const artifacts = new Map();
    const repositories = new Set();
    const warnings = [];
    const protectedPaths = options.protectedPaths ?? [];
    async function walk(path, depth) {
        if (depth > MAX_DEPTH ||
            isProtectedPath(path) ||
            isProtectedByConfiguration(path, protectedPaths)) {
            return;
        }
        let entries;
        try {
            entries = await readdir(path, { withFileTypes: true });
        }
        catch (error) {
            const code = error.code;
            if (code !== 'EACCES' && code !== 'EPERM' && code !== 'ENOENT') {
                warnings.push(`Could not inspect ${path}: ${String(error)}`);
            }
            return;
        }
        if (entries.some((entry) => entry.name === '.git')) {
            repositories.add(path);
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.isSymbolicLink()) {
                continue;
            }
            const child = resolve(path, entry.name);
            if (isProtectedPath(child) || isProtectedByConfiguration(child, protectedPaths)) {
                continue;
            }
            if (PROJECT_RULES.has(entry.name)) {
                try {
                    const stats = await lstat(child);
                    if (!stats.isSymbolicLink()) {
                        artifacts.set(child, { path: child, modifiedAt: stats.mtime });
                    }
                }
                catch {
                    // The directory disappeared while scanning; ignore it.
                }
                continue;
            }
            await walk(child, depth + 1);
        }
    }
    for (const root of options.roots) {
        await walk(root, 0);
    }
    const now = Date.now();
    const home = homedir();
    const values = [...artifacts.values()].filter((artifact) => {
        const rule = PROJECT_RULES.get(basename(artifact.path));
        if (!rule) {
            return false;
        }
        const minimumAge = Math.max(options.minAgeDays, rule.defaultMinAgeDays);
        return now - artifact.modifiedAt.getTime() >= minimumAge * DAY_MS;
    });
    const candidates = await mapLimit(values, 6, async (artifact) => {
        const rule = PROJECT_RULES.get(basename(artifact.path));
        if (!rule) {
            throw new Error(`Missing rule for ${artifact.path}`);
        }
        const repository = await git.repositoryFor(artifact.path);
        const tracked = repository ? await git.isTracked(repository, artifact.path) : false;
        const dirty = repository ? await git.isDirty(repository) : false;
        const inUse = processCommands.includes(artifact.path);
        const isAgentArtifact = artifact.path.startsWith(resolve(home, '.claude', 'jobs'));
        const blockedReason = tracked
            ? 'directory contains files tracked by Git'
            : inUse
                ? 'directory is referenced by a running process'
                : undefined;
        const risk = dirty && rule.risk === 'safe' ? 'review' : rule.risk;
        return {
            id: candidateId(rule.id, artifact.path),
            ruleId: rule.id,
            category: isAgentArtifact ? 'agent-artifacts' : 'developer-builds',
            kind: 'directory',
            risk,
            title: rule.title,
            reason: dirty
                ? `${rule.reason} The enclosing repository has local changes, so review it first.`
                : rule.reason,
            path: artifact.path,
            sizeBytes: await directorySize(artifact.path),
            modifiedAt: artifact.modifiedAt.toISOString(),
            ...(repository ? { repository } : {}),
            ...(blockedReason ? { blockedReason } : {}),
        };
    });
    return {
        candidates,
        repositories: [...repositories],
        warnings,
    };
}
//# sourceMappingURL=projects.js.map