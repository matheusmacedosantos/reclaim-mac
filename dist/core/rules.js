const PROJECT_RULE_LIST = [
    {
        id: 'rust-target',
        directoryName: 'target',
        title: 'Rust build output',
        reason: 'Cargo recreates this directory on the next build.',
        risk: 'safe',
        defaultMinAgeDays: 3,
    },
    {
        id: 'node-modules',
        directoryName: 'node_modules',
        title: 'Installed Node.js dependencies',
        reason: 'The package manager can reinstall these dependencies from the lockfile.',
        risk: 'review',
        defaultMinAgeDays: 14,
    },
    {
        id: 'next-build',
        directoryName: '.next',
        title: 'Next.js build output',
        reason: 'Next.js recreates this directory during development or build.',
        risk: 'safe',
        defaultMinAgeDays: 3,
    },
    {
        id: 'distribution-output',
        directoryName: 'dist',
        title: 'Distribution output',
        reason: 'This looks like generated distribution output and is not tracked by Git.',
        risk: 'review',
        defaultMinAgeDays: 7,
    },
    {
        id: 'turbo-cache',
        directoryName: '.turbo',
        title: 'Turborepo cache',
        reason: 'Turborepo recreates this local cache.',
        risk: 'safe',
        defaultMinAgeDays: 3,
    },
    {
        id: 'coverage-output',
        directoryName: 'coverage',
        title: 'Test coverage output',
        reason: 'The test runner recreates coverage reports.',
        risk: 'safe',
        defaultMinAgeDays: 7,
    },
];
export const PROJECT_RULES = new Map(PROJECT_RULE_LIST.map((rule) => [rule.directoryName, rule]));
const PROTECTED_SEGMENTS = new Set([
    '.git',
    '.ssh',
    'keys',
    'wallets',
    'vendor',
    'extension',
    'security-audit',
    'audit-reports',
    'codex-runtimes',
    '.local-run',
    'ledger',
    'pgdata',
]);
const SECRET_FILE_PATTERNS = [
    /^\.env(?:\..+)?$/u,
    /(?:keypair|wallet|payout).+\.json$/iu,
    /\.(?:pem|key|p12|mobileprovision)$/iu,
];
export function isProtectedSegment(segment) {
    return PROTECTED_SEGMENTS.has(segment);
}
export function isProtectedFileName(name) {
    return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(name));
}
export function isProtectedPathSegments(segments) {
    if (segments.some(isProtectedSegment)) {
        return true;
    }
    if (segments.some(isProtectedFileName)) {
        return true;
    }
    if (segments.some((segment, index) => (segment === 'projects' && segments[index - 1] === '.claude') ||
        (segment === 'solana' && segments[index - 1] === '.config'))) {
        return true;
    }
    return segments.some((segment, index) => segment === 'circuits' && segments[index - 1] === 'public');
}
//# sourceMappingURL=rules.js.map