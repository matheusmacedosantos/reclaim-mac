import { candidateId } from '../core/id.js';
import { runCommand } from '../core/process.js';
import { parseSize } from '../core/size.js';
function scalarString(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
function dockerBuildCacheCandidate(output) {
    for (const line of output.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            const value = JSON.parse(line);
            if (scalarString(value.Type).toLowerCase() !== 'build cache') {
                continue;
            }
            const reclaimableText = scalarString(value.Reclaimable) || scalarString(value.Size);
            const sizeBytes = parseSize(reclaimableText.split(/\s+/u)[0] ?? '');
            if (sizeBytes <= 0) {
                return null;
            }
            return {
                id: candidateId('docker-builder-cache', 'docker://builder-cache'),
                ruleId: 'docker-builder-cache',
                category: 'docker',
                kind: 'action',
                risk: 'review',
                title: 'Unused Docker build cache',
                reason: 'Docker can rebuild these layers. Images, containers, and volumes are never selected.',
                path: 'docker://builder-cache',
                sizeBytes,
                action: 'docker-builder-prune',
            };
        }
        catch {
            // Ignore output from older Docker versions that is not JSON.
        }
    }
    return null;
}
async function scanDocker() {
    const result = await runCommand('docker', ['system', 'df', '--format', '{{json .}}'], { timeoutMs: 6_000 });
    if (result.exitCode !== 0) {
        const reason = result.timedOut ? 'Docker daemon did not respond in time.' : 'Docker is unavailable.';
        return { candidates: [], warnings: [reason] };
    }
    const candidate = dockerBuildCacheCandidate(result.stdout);
    return { candidates: candidate ? [candidate] : [], warnings: [] };
}
async function scanUnavailableSimulators() {
    const result = await runCommand('xcrun', ['simctl', 'list', 'devices', 'unavailable', '--json'], { timeoutMs: 8_000 });
    if (result.exitCode !== 0) {
        return { candidates: [], warnings: [] };
    }
    try {
        const parsed = JSON.parse(result.stdout);
        const count = Object.values(parsed.devices ?? {}).reduce((total, devices) => total + devices.length, 0);
        if (count === 0) {
            return { candidates: [], warnings: [] };
        }
        return {
            candidates: [
                {
                    id: candidateId('unavailable-simulators', 'xcrun://simctl/unavailable'),
                    ruleId: 'unavailable-simulators',
                    category: 'simulators',
                    kind: 'action',
                    risk: 'review',
                    title: `${count} unavailable simulator ${count === 1 ? 'device' : 'devices'}`,
                    reason: 'Only simulator device records whose runtimes are unavailable will be deleted.',
                    path: 'xcrun://simctl/unavailable',
                    sizeBytes: 0,
                    action: 'simulator-delete-unavailable',
                },
            ],
            warnings: [],
        };
    }
    catch {
        return { candidates: [], warnings: ['Could not parse simulator inventory.'] };
    }
}
export async function scanSystemActions(options) {
    const scans = [];
    if (options.includeDocker) {
        scans.push(scanDocker());
    }
    if (options.includeSimulators) {
        scans.push(scanUnavailableSimulators());
    }
    const results = await Promise.all(scans);
    return {
        candidates: results.flatMap((result) => result.candidates),
        warnings: results.flatMap((result) => result.warnings),
    };
}
//# sourceMappingURL=system.js.map