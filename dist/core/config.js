import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { expandPath, uniquePaths } from './paths.js';
function stringArray(value, field) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error(`Configuration field ${field} must be an array of paths.`);
    }
    return value.map((entry) => {
        if (typeof entry !== 'string') {
            throw new Error(`Configuration field ${field} must be an array of paths.`);
        }
        return expandPath(entry);
    });
}
export function userConfigPath() {
    return process.env.RECLAIM_MAC_CONFIG
        ? expandPath(process.env.RECLAIM_MAC_CONFIG)
        : resolve(homedir(), '.config', 'reclaim-mac', 'config.json');
}
export async function loadUserConfig() {
    let contents;
    try {
        contents = await readFile(userConfigPath(), 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return { roots: [], protectedPaths: [] };
        }
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(contents);
    }
    catch {
        throw new Error(`Could not parse ${userConfigPath()} as JSON.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Configuration must be a JSON object.');
    }
    const value = parsed;
    return {
        roots: uniquePaths(stringArray(value.roots, 'roots')),
        protectedPaths: uniquePaths(stringArray(value.protectedPaths, 'protectedPaths')),
    };
}
//# sourceMappingURL=config.js.map