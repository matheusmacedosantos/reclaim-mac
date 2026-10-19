import type { GitInspector } from '../core/git.js';
import type { Candidate, ScanOptions } from '../types.js';
export interface ProjectScanResult {
    candidates: Candidate[];
    repositories: string[];
    warnings: string[];
}
export declare function scanProjectArtifacts(options: ScanOptions, git: GitInspector, processCommands: string): Promise<ProjectScanResult>;
//# sourceMappingURL=projects.d.ts.map