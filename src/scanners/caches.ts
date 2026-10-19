import { lstat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';

import { mapLimit } from '../core/concurrency.js';
import { candidateId } from '../core/id.js';
import { isProtectedByConfiguration, isProtectedPath } from '../core/paths.js';
import { directorySize } from '../core/size.js';
import type { Candidate, RiskLevel } from '../types.js';

interface CacheLocation {
  ruleId: string;
  path: string;
  title: string;
  reason: string;
  risk: RiskLevel;
  minAgeDays: number;
  children: boolean;
  category: 'developer-caches' | 'xcode';
}

interface CacheEntry {
  location: CacheLocation;
  path: string;
  modifiedAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function locations(home: string): CacheLocation[] {
  return [
    {
      ruleId: 'user-application-cache',
      path: resolve(home, 'Library', 'Caches'),
      title: 'Application cache',
      reason: 'The owning application can recreate this old cache.',
      risk: 'review',
      minAgeDays: 30,
      children: true,
      category: 'developer-caches',
    },
    {
      ruleId: 'dot-cache',
      path: resolve(home, '.cache'),
      title: 'Developer cache',
      reason: 'This old cache is stored in the standard user cache directory.',
      risk: 'review',
      minAgeDays: 30,
      children: true,
      category: 'developer-caches',
    },
    {
      ruleId: 'npm-cache',
      path: resolve(home, '.npm', '_cacache'),
      title: 'npm download cache',
      reason: 'npm downloads missing packages again when needed.',
      risk: 'safe',
      minAgeDays: 14,
      children: false,
      category: 'developer-caches',
    },
    {
      ruleId: 'yarn-cache',
      path: resolve(home, '.yarn', 'berry', 'cache'),
      title: 'Yarn download cache',
      reason: 'Yarn downloads missing packages again when needed.',
      risk: 'safe',
      minAgeDays: 14,
      children: false,
      category: 'developer-caches',
    },
    {
      ruleId: 'homebrew-cache',
      path: resolve(home, 'Library', 'Caches', 'Homebrew'),
      title: 'Homebrew download cache',
      reason: 'Homebrew downloads missing bottles and sources again when needed.',
      risk: 'safe',
      minAgeDays: 14,
      children: false,
      category: 'developer-caches',
    },
    {
      ruleId: 'xcode-derived-data',
      path: resolve(home, 'Library', 'Developer', 'Xcode', 'DerivedData'),
      title: 'Xcode DerivedData',
      reason: 'Xcode recreates indexes and build intermediates.',
      risk: 'safe',
      minAgeDays: 7,
      children: true,
      category: 'xcode',
    },
    {
      ruleId: 'xcode-device-support',
      path: resolve(home, 'Library', 'Developer', 'Xcode', 'iOS DeviceSupport'),
      title: 'Old iOS DeviceSupport',
      reason: 'Xcode can download symbols again, but reconnecting an older device may take time.',
      risk: 'review',
      minAgeDays: 90,
      children: true,
      category: 'xcode',
    },
  ];
}

export async function scanCaches(
  minimumAgeDays: number,
  processCommands: string,
  protectedPaths: string[] = [],
  home = homedir(),
): Promise<Candidate[]> {
  const entries: CacheEntry[] = [];
  for (const location of locations(home)) {
    if (location.children) {
      let children;
      try {
        children = await readdir(location.path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const child of children) {
        if (!child.isDirectory() || child.isSymbolicLink()) {
          continue;
        }
        const path = resolve(location.path, child.name);
        if (isProtectedPath(path) || isProtectedByConfiguration(path, protectedPaths)) {
          continue;
        }
        try {
          const stats = await lstat(path);
          entries.push({ location, path, modifiedAt: stats.mtime });
        } catch {
          // Ignore entries that disappear during the scan.
        }
      }
    } else {
      try {
        const stats = await lstat(location.path);
        if (
          stats.isDirectory() &&
          !stats.isSymbolicLink() &&
          !isProtectedByConfiguration(location.path, protectedPaths)
        ) {
          entries.push({ location, path: location.path, modifiedAt: stats.mtime });
        }
      } catch {
        // Optional cache is not installed.
      }
    }
  }

  const now = Date.now();
  const oldEntries = entries.filter(({ location, modifiedAt }) => {
    const age = Math.max(location.minAgeDays, minimumAgeDays);
    return now - modifiedAt.getTime() >= age * DAY_MS;
  });

  return mapLimit(oldEntries, 6, async ({ location, path, modifiedAt }) => {
    const inUse = processCommands.includes(path);
    return {
      id: candidateId(location.ruleId, path),
      ruleId: location.ruleId,
      category: location.category,
      kind: 'directory',
      risk: location.risk,
      title: `${location.title}: ${basename(path)}`,
      reason: location.reason,
      path,
      sizeBytes: await directorySize(path),
      modifiedAt: modifiedAt.toISOString(),
      ...(inUse ? { blockedReason: 'directory is referenced by a running process' } : {}),
    } satisfies Candidate;
  });
}
