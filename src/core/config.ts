import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { expandPath, uniquePaths } from './paths.js';

export interface UserConfig {
  roots: string[];
  protectedPaths: string[];
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Configuration field ${field} must be an array of paths.`);
  }
  return value.map((entry: unknown) => {
    if (typeof entry !== 'string') {
      throw new Error(`Configuration field ${field} must be an array of paths.`);
    }
    return expandPath(entry);
  });
}

export function userConfigPath(): string {
  return process.env.RECLAIM_MAC_CONFIG
    ? expandPath(process.env.RECLAIM_MAC_CONFIG)
    : resolve(homedir(), '.config', 'reclaim-mac', 'config.json');
}

export async function loadUserConfig(): Promise<UserConfig> {
  let contents: string;
  try {
    contents = await readFile(userConfigPath(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { roots: [], protectedPaths: [] };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(`Could not parse ${userConfigPath()} as JSON.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Configuration must be a JSON object.');
  }
  const value = parsed as Record<string, unknown>;
  return {
    roots: uniquePaths(stringArray(value.roots, 'roots')),
    protectedPaths: uniquePaths(stringArray(value.protectedPaths, 'protectedPaths')),
  };
}
