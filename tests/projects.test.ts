import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { GitInspector } from '../src/core/git.js';
import { runCommand } from '../src/core/process.js';
import { scanProjectArtifacts } from '../src/scanners/projects.js';

const fixtures: string[] = [];

async function fixture(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), 'reclaim-mac-project-'));
  fixtures.push(path);
  return path;
}

async function makeOld(path: string): Promise<void> {
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await utimes(path, old, old);
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(async (path) => rm(path, { recursive: true, force: true })));
});

describe('project artifact scanner', () => {
  it('finds generated directories and skips protected trees', async () => {
    const root = await fixture();
    const target = resolve(root, 'service', 'target');
    const protectedDist = resolve(root, 'vendor', 'package', 'dist');
    await mkdir(target, { recursive: true });
    await mkdir(protectedDist, { recursive: true });
    await writeFile(resolve(target, 'artifact'), 'generated');
    await makeOld(target);
    await makeOld(protectedDist);

    const result = await scanProjectArtifacts(
      {
        roots: [root],
        minAgeDays: 0,
        includeDocker: false,
        includeSimulators: false,
      },
      new GitInspector(),
      '',
    );

    expect(result.candidates.map((candidate) => candidate.path)).toContain(target);
    expect(result.candidates.map((candidate) => candidate.path)).not.toContain(protectedDist);
  });

  it('blocks generated-looking directories tracked by Git', async () => {
    const root = await fixture();
    const dist = resolve(root, 'dist');
    await mkdir(dist, { recursive: true });
    await writeFile(resolve(dist, 'index.js'), 'export {};');
    await runCommand('git', ['init', root]);
    await runCommand('git', ['-C', root, 'add', 'dist/index.js']);
    await runCommand(
      'git',
      [
        '-C',
        root,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'fixture',
      ],
    );
    await makeOld(dist);

    const result = await scanProjectArtifacts(
      {
        roots: [root],
        minAgeDays: 0,
        includeDocker: false,
        includeSimulators: false,
      },
      new GitInspector(),
      '',
    );
    const candidate = result.candidates.find((value) => value.path === dist);

    expect(candidate?.blockedReason).toMatch(/tracked by Git/u);
  });

  it('blocks directories referenced by a running command', async () => {
    const root = await fixture();
    const modules = resolve(root, 'node_modules');
    await mkdir(modules, { recursive: true });
    await makeOld(modules);

    const result = await scanProjectArtifacts(
      {
        roots: [root],
        minAgeDays: 0,
        includeDocker: false,
        includeSimulators: false,
      },
      new GitInspector(),
      `node ${modules}/tool.js`,
    );
    const candidate = result.candidates.find((value) => value.path === modules);

    expect(candidate?.blockedReason).toMatch(/running process/u);
  });
});
