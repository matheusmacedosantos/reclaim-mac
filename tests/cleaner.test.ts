import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cleanCandidates } from '../src/core/cleaner.js';
import { candidateId } from '../src/core/id.js';
import type { Candidate } from '../src/types.js';

const fixtures: string[] = [];

async function homeFixture(): Promise<string> {
  const path = await mkdtemp(resolve(homedir(), '.reclaim-mac-test-'));
  fixtures.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(async (path) => rm(path, { recursive: true, force: true })));
});

describe('cleaner revalidation', () => {
  it('removes a valid generated directory', async () => {
    const root = await homeFixture();
    const target = resolve(root, 'target');
    await mkdir(target);
    await writeFile(resolve(target, 'artifact'), 'generated');
    const candidate: Candidate = {
      id: candidateId('rust-target', target),
      ruleId: 'rust-target',
      category: 'developer-builds',
      kind: 'directory',
      risk: 'safe',
      title: 'Rust build output',
      reason: 'test',
      path: target,
      sizeBytes: 9,
    };

    const result = await cleanCandidates([candidate]);

    expect(result.results[0]?.ok).toBe(true);
    await expect(access(target)).rejects.toThrow();
  });

  it('refuses a protected path even when the candidate claims it is safe', async () => {
    const root = await homeFixture();
    const target = resolve(root, 'vendor', 'target');
    await mkdir(target, { recursive: true });
    const candidate: Candidate = {
      id: candidateId('rust-target', target),
      ruleId: 'rust-target',
      category: 'developer-builds',
      kind: 'directory',
      risk: 'safe',
      title: 'Rust build output',
      reason: 'test',
      path: target,
      sizeBytes: 0,
    };

    const result = await cleanCandidates([candidate]);

    expect(result.results[0]?.ok).toBe(false);
    await expect(access(target)).resolves.toBeUndefined();
  });
});
