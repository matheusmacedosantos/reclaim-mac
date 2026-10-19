import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadUserConfig } from '../src/core/config.js';

const fixtures: string[] = [];
const originalConfig = process.env.RECLAIM_MAC_CONFIG;

afterEach(async () => {
  if (originalConfig === undefined) {
    delete process.env.RECLAIM_MAC_CONFIG;
  } else {
    process.env.RECLAIM_MAC_CONFIG = originalConfig;
  }
  await Promise.all(fixtures.splice(0).map(async (path) => rm(path, { recursive: true, force: true })));
});

describe('local configuration', () => {
  it('loads and expands roots and protected paths', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'reclaim-mac-config-'));
    fixtures.push(directory);
    const configPath = resolve(directory, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        roots: ['~/Projects'],
        protectedPaths: ['~/Projects/example/local-state'],
      }),
    );
    process.env.RECLAIM_MAC_CONFIG = configPath;

    const config = await loadUserConfig();

    expect(config.roots[0]).toMatch(/\/Projects$/u);
    expect(config.protectedPaths[0]).toMatch(/\/Projects\/example\/local-state$/u);
  });

  it('rejects malformed fields', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'reclaim-mac-config-'));
    fixtures.push(directory);
    const configPath = resolve(directory, 'config.json');
    await writeFile(configPath, JSON.stringify({ protectedPaths: 'not-an-array' }));
    process.env.RECLAIM_MAC_CONFIG = configPath;

    await expect(loadUserConfig()).rejects.toThrow(/must be an array/u);
  });
});
