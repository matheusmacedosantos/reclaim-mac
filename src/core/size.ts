import { runCommand } from './process.js';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return bytes === 0 ? '0 B' : 'unknown';
  }

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${UNITS[exponent]}`;
}

export function parseSize(value: string): number {
  const match = value.trim().match(/([\d.]+)\s*([kmgt]?b)/iu);
  if (!match?.[1] || !match[2]) {
    return 0;
  }
  const amount = Number.parseFloat(match[1]);
  const multiplier: Record<string, number> = {
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
  };
  return Math.round(amount * (multiplier[match[2].toLowerCase()] ?? 1));
}

export async function directorySize(path: string): Promise<number> {
  const result = await runCommand('du', ['-sk', path], { timeoutMs: 60_000 });
  if (result.exitCode !== 0) {
    return 0;
  }
  const kibibytes = Number.parseInt(result.stdout.split(/\s+/u)[0] ?? '0', 10);
  return Number.isFinite(kibibytes) ? kibibytes * 1024 : 0;
}
