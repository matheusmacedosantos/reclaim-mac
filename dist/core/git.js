import { realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { runCommand } from './process.js';
export class GitInspector {
    #repositoryCache = new Map();
    #dirtyCache = new Map();
    async repositoryFor(path) {
        const cwd = dirname(resolve(path));
        const cached = this.#repositoryCache.get(cwd);
        if (cached !== undefined) {
            return cached;
        }
        const result = await runCommand('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
        const repository = result.exitCode === 0 ? result.stdout.trim() : null;
        this.#repositoryCache.set(cwd, repository);
        return repository;
    }
    async isTracked(repository, path) {
        const [canonicalRepository, canonicalPath] = await Promise.all([
            realpath(repository),
            realpath(path),
        ]);
        const pathspec = relative(canonicalRepository, canonicalPath);
        const result = await runCommand('git', ['-C', repository, 'ls-files', '-z', '--', pathspec], { timeoutMs: 10_000 });
        return result.exitCode === 0 && result.stdout.length > 0;
    }
    async isDirty(repository) {
        const cached = this.#dirtyCache.get(repository);
        if (cached !== undefined) {
            return cached;
        }
        const result = await runCommand('git', ['-C', repository, 'status', '--porcelain=v1', '--untracked-files=normal'], { timeoutMs: 15_000 });
        const dirty = result.exitCode !== 0 || result.stdout.trim().length > 0;
        this.#dirtyCache.set(repository, dirty);
        return dirty;
    }
    async commonRepository(path) {
        const result = await runCommand('git', ['-C', path, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { timeoutMs: 10_000 });
        if (result.exitCode !== 0) {
            return null;
        }
        const commonDirectory = result.stdout.trim();
        return commonDirectory.endsWith('/.git') ? dirname(commonDirectory) : path;
    }
    async worktrees(repository) {
        const result = await runCommand('git', ['-C', repository, 'worktree', 'list', '--porcelain'], { timeoutMs: 15_000 });
        if (result.exitCode !== 0) {
            return [];
        }
        return result.stdout
            .trim()
            .split(/\n\n/u)
            .map((block) => {
            const lines = block.split('\n');
            const worktreeLine = lines.find((line) => line.startsWith('worktree '));
            if (!worktreeLine) {
                return null;
            }
            return {
                path: worktreeLine.slice('worktree '.length),
                prunable: lines.some((line) => line.startsWith('prunable')),
                bare: lines.includes('bare'),
            };
        })
            .filter((record) => record !== null);
    }
    async worktreeRemovalBlocker(path) {
        if (await this.isDirty(path)) {
            return 'repository has local or untracked changes';
        }
        const upstream = await runCommand('git', ['-C', path, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { timeoutMs: 10_000 });
        if (upstream.exitCode !== 0) {
            return 'branch has no upstream; pushed state cannot be proven';
        }
        const ahead = await runCommand('git', ['-C', path, 'rev-list', '--count', '@{upstream}..HEAD'], { timeoutMs: 10_000 });
        if (ahead.exitCode !== 0 || Number.parseInt(ahead.stdout.trim(), 10) !== 0) {
            return 'branch contains commits that are not on its upstream';
        }
        return null;
    }
}
//# sourceMappingURL=git.js.map