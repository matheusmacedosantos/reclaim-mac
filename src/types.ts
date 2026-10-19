export type RiskLevel = 'safe' | 'review';

export type CandidateKind = 'directory' | 'git-worktree' | 'action';

export type Category =
  | 'agent-artifacts'
  | 'developer-builds'
  | 'developer-caches'
  | 'xcode'
  | 'git-worktrees'
  | 'docker'
  | 'simulators';

export type ActionName =
  | 'docker-builder-prune'
  | 'simulator-delete-unavailable'
  | 'git-worktree-prune';

export interface Candidate {
  id: string;
  ruleId: string;
  category: Category;
  kind: CandidateKind;
  risk: RiskLevel;
  title: string;
  reason: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: string;
  repository?: string;
  action?: ActionName;
  blockedReason?: string;
}

export interface ScanOptions {
  roots: string[];
  protectedPaths?: string[];
  minAgeDays: number;
  includeDocker: boolean;
  includeSimulators: boolean;
}

export interface ScanReport {
  candidates: Candidate[];
  roots: string[];
  warnings: string[];
  totalBytes: number;
  elapsedMs: number;
}

export interface CleanResult {
  candidate: Candidate;
  ok: boolean;
  bytesReclaimed: number;
  error?: string;
}

export interface CleanSummary {
  results: CleanResult[];
  bytesReclaimed: number;
}

export interface ProjectRule {
  id: string;
  directoryName: string;
  title: string;
  reason: string;
  risk: RiskLevel;
  defaultMinAgeDays: number;
}
