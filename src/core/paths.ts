import { access, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { isProtectedPathSegments } from './rules.js';

export function expandPath(input: string, home = homedir()): string {
  if (input === '~') {
    return home;
  }
  if (input.startsWith(`~${sep}`)) {
    return resolve(home, input.slice(2));
  }
  return resolve(input);
}

export function isWithin(parent: string, child: string): boolean {
  const value = relative(resolve(parent), resolve(child));
  return value !== '' && !value.startsWith(`..${sep}`) && value !== '..' && !isAbsolute(value);
}

export function pathSegments(path: string): string[] {
  return resolve(path).split(sep).filter(Boolean);
}

export function isProtectedPath(path: string): boolean {
  return isProtectedPathSegments(pathSegments(path));
}

export function isProtectedByConfiguration(path: string, protectedPaths: string[]): boolean {
  const target = resolve(path);
  return protectedPaths.some((protectedPath) => {
    const protectedTarget = resolve(protectedPath);
    return target === protectedTarget || isWithin(protectedTarget, target);
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function defaultDeveloperRoots(home = homedir()): Promise<string[]> {
  const candidates = [
    resolve(home, 'Developer'),
    resolve(home, 'Develop'),
    resolve(home, 'Projects'),
    resolve(home, 'Code'),
    resolve(home, 'src'),
    resolve(home, 'Documents', 'DevelopmentProjects'),
  ];

  const roots: string[] = [];
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      roots.push(candidate);
    }
  }
  return roots;
}

export async function agentTemporaryRoots(home = homedir()): Promise<string[]> {
  const jobsRoot = resolve(home, '.claude', 'jobs');
  let entries;
  try {
    entries = await readdir(jobsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const roots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const temp = resolve(jobsRoot, entry.name, 'tmp');
    if (await exists(temp)) {
      roots.push(temp);
    }
  }
  return roots;
}

export function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => resolve(path)))];
}
