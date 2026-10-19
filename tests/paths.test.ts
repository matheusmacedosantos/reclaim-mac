import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  expandPath,
  isProtectedByConfiguration,
  isProtectedPath,
  isWithin,
} from '../src/core/paths.js';

describe('path safety', () => {
  it('expands home-relative paths', () => {
    expect(expandPath('~/Projects')).toBe(resolve(homedir(), 'Projects'));
  });

  it('uses path boundaries instead of string prefixes', () => {
    expect(isWithin('/Users/example', '/Users/example/Projects')).toBe(true);
    expect(isWithin('/Users/example', '/Users/example-other/Projects')).toBe(false);
    expect(isWithin('/Users/example', '/Users/example')).toBe(false);
  });

  it.each([
    '/Users/example/project/.git/objects',
    '/Users/example/project/vendor/dist',
    '/Users/example/project/public/circuits/build',
    '/Users/example/project/keys/target',
    '/Users/example/project/extension/node_modules',
    '/Users/example/.cache/codex-runtimes',
  ])('protects %s', (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it('does not protect ordinary generated output', () => {
    expect(isProtectedPath('/Users/example/project/apps/web/.next')).toBe(false);
  });

  it('protects configured paths and their descendants', () => {
    const protectedPaths = ['/Users/example/project/local-state'];
    expect(
      isProtectedByConfiguration('/Users/example/project/local-state/database', protectedPaths),
    ).toBe(true);
    expect(isProtectedByConfiguration('/Users/example/project/target', protectedPaths)).toBe(false);
  });
});
