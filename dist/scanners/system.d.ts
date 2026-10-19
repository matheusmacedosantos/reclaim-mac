import type { Candidate } from '../types.js';
interface SystemScanResult {
    candidates: Candidate[];
    warnings: string[];
}
export declare function scanSystemActions(options: {
    includeDocker: boolean;
    includeSimulators: boolean;
}): Promise<SystemScanResult>;
export {};
//# sourceMappingURL=system.d.ts.map