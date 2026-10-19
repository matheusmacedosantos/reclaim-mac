import type { Candidate, CleanSummary, ScanReport } from '../types.js';
export declare function displayPath(path: string): string;
export declare function riskBadge(candidate: Candidate): string;
export declare function banner(): string;
export declare function diskSummary(): Promise<string | null>;
export declare function printReport(report: ScanReport): void;
export declare function printCleanSummary(summary: CleanSummary): void;
//# sourceMappingURL=display.d.ts.map