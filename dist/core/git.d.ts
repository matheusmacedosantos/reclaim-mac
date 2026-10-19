export interface WorktreeRecord {
    path: string;
    prunable: boolean;
    bare: boolean;
}
export declare class GitInspector {
    #private;
    repositoryFor(path: string): Promise<string | null>;
    isTracked(repository: string, path: string): Promise<boolean>;
    isDirty(repository: string): Promise<boolean>;
    commonRepository(path: string): Promise<string | null>;
    worktrees(repository: string): Promise<WorktreeRecord[]>;
    worktreeRemovalBlocker(path: string): Promise<string | null>;
}
//# sourceMappingURL=git.d.ts.map