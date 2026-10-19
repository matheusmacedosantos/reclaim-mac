import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { GitInspector } from '../core/git.js';
import { candidateId } from '../core/id.js';
import { isProtectedByConfiguration } from '../core/paths.js';
import { directorySize } from '../core/size.js';
import type { Candidate } from '../types.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function scanGitWorktrees(
  repositories: string[],
  git: GitInspector,
  processCommands: string,
  protectedPaths: string[] = [],
): Promise<Candidate[]> {
  const commonRepositories = new Set<string>();
  for (const repository of repositories) {
    const common = await git.commonRepository(repository);
    if (common) {
      commonRepositories.add(common);
    }
  }

  const candidates: Candidate[] = [];
  const seenWorktrees = new Set<string>();
  const agentJobs = resolve(homedir(), '.claude', 'jobs');

  for (const repository of commonRepositories) {
    const worktrees = await git.worktrees(repository);
    const hasPrunable = worktrees.some((worktree) => worktree.prunable);
    if (hasPrunable) {
      candidates.push({
        id: candidateId('git-worktree-prune', repository),
        ruleId: 'git-worktree-prune',
        category: 'git-worktrees',
        kind: 'action',
        risk: 'safe',
        title: 'Stale Git worktree metadata',
        reason: 'Git marked these records as prunable because their directories no longer exist.',
        path: repository,
        repository,
        sizeBytes: 0,
        action: 'git-worktree-prune',
      });
    }

    for (const worktree of worktrees) {
      if (
        worktree.bare ||
        worktree.prunable ||
        worktree.path === repository ||
        seenWorktrees.has(worktree.path) ||
        !(await exists(worktree.path))
      ) {
        continue;
      }
      seenWorktrees.add(worktree.path);
      const blocker = await git.worktreeRemovalBlocker(worktree.path);
      const inUse = processCommands.includes(worktree.path);
      const configuredAsProtected = isProtectedByConfiguration(worktree.path, protectedPaths);
      const isAgentWorktree = worktree.path.startsWith(agentJobs);
      const blockedReason = configuredAsProtected
        ? 'worktree is protected by local configuration'
        : inUse
        ? 'worktree is referenced by a running process'
        : blocker ?? undefined;

      candidates.push({
        id: candidateId('git-worktree', worktree.path),
        ruleId: 'git-worktree',
        category: 'git-worktrees',
        kind: 'git-worktree',
        risk: 'review',
        title: isAgentWorktree ? 'Agent Git worktree' : 'Secondary Git worktree',
        reason: 'The worktree is clean and its commits are present on the configured upstream.',
        path: worktree.path,
        repository,
        sizeBytes: await directorySize(worktree.path),
        ...(blockedReason ? { blockedReason } : {}),
      });
    }
  }

  return candidates;
}
