import { lstat } from 'node:fs/promises';

import { loadUserConfig } from '../core/config.js';
import { GitInspector } from '../core/git.js';
import {
  agentTemporaryRoots,
  defaultDeveloperRoots,
  expandPath,
  uniquePaths,
} from '../core/paths.js';
import { runningProcessCommands } from '../core/process.js';
import type { ScanOptions, ScanReport } from '../types.js';
import { scanCaches } from './caches.js';
import { scanProjectArtifacts } from './projects.js';
import { scanSystemActions } from './system.js';
import { scanGitWorktrees } from './worktrees.js';

async function existingDirectories(paths: string[]): Promise<string[]> {
  const values: string[] = [];
  for (const path of paths) {
    try {
      const stats = await lstat(path);
      if (stats.isDirectory() && !stats.isSymbolicLink()) {
        values.push(path);
      }
    } catch {
      // Missing user-supplied roots are reported by the caller's final root list.
    }
  }
  return values;
}

export async function scan(input: Partial<ScanOptions> = {}): Promise<ScanReport> {
  const startedAt = Date.now();
  const config = await loadUserConfig();
  const customRoots = (input.roots ?? []).map((path) => expandPath(path));
  const roots = await existingDirectories(
    uniquePaths([
      ...customRoots,
      ...config.roots,
      ...(await defaultDeveloperRoots()),
      ...(await agentTemporaryRoots()),
    ]),
  );
  const options: ScanOptions = {
    roots,
    protectedPaths: uniquePaths([...(input.protectedPaths ?? []), ...config.protectedPaths]),
    minAgeDays: Math.max(0, input.minAgeDays ?? 7),
    includeDocker: input.includeDocker ?? true,
    includeSimulators: input.includeSimulators ?? true,
  };
  const processCommands = await runningProcessCommands();
  const git = new GitInspector();
  const projects = await scanProjectArtifacts(options, git, processCommands);
  const [caches, worktrees, system] = await Promise.all([
    scanCaches(options.minAgeDays, processCommands, options.protectedPaths),
    scanGitWorktrees(projects.repositories, git, processCommands, options.protectedPaths),
    scanSystemActions(options),
  ]);

  const byId = new Map(
    [...projects.candidates, ...caches, ...worktrees, ...system.candidates].map(
      (candidate) => [candidate.id, candidate] as const,
    ),
  );
  const candidates = [...byId.values()].sort((left, right) => right.sizeBytes - left.sizeBytes);
  return {
    candidates,
    roots,
    warnings: [...projects.warnings, ...system.warnings],
    totalBytes: candidates
      .filter((candidate) => candidate.blockedReason === undefined)
      .reduce((total, candidate) => total + candidate.sizeBytes, 0),
    elapsedMs: Date.now() - startedAt,
  };
}
