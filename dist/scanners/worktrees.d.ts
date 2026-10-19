import type { GitInspector } from '../core/git.js';
import type { Candidate } from '../types.js';
export declare function scanGitWorktrees(repositories: string[], git: GitInspector, processCommands: string, protectedPaths?: string[]): Promise<Candidate[]>;
//# sourceMappingURL=worktrees.d.ts.map