import { statfs } from 'node:fs/promises';
import { homedir } from 'node:os';

import chalk from 'chalk';

import { formatBytes } from '../core/size.js';
import type { Candidate, Category, CleanSummary, ScanReport } from '../types.js';

const CATEGORY_LABELS: Record<Category, string> = {
  'agent-artifacts': 'Agent build artifacts',
  'developer-builds': 'Developer builds',
  'developer-caches': 'Developer and application caches',
  xcode: 'Xcode',
  'git-worktrees': 'Git worktrees',
  docker: 'Docker',
  simulators: 'Simulators',
};

export function displayPath(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

export function riskBadge(candidate: Candidate): string {
  return candidate.risk === 'safe' ? chalk.green('SAFE') : chalk.yellow('REVIEW');
}

export function banner(): string {
  return [
    chalk.bold.cyan('reclaim-mac'),
    chalk.dim('A cautious, Git-aware disk space cleaner for macOS'),
  ].join('\n');
}

export async function diskSummary(): Promise<string | null> {
  try {
    const stats = await statfs(homedir());
    const available = Number(stats.bavail) * Number(stats.bsize);
    const total = Number(stats.blocks) * Number(stats.bsize);
    return `${formatBytes(available)} free of ${formatBytes(total)}`;
  } catch {
    return null;
  }
}

export function printReport(report: ScanReport): void {
  process.stdout.write(`${banner()}\n\n`);
  if (report.candidates.length === 0) {
    process.stdout.write(`${chalk.green('Nothing eligible was found.')}\n`);
    return;
  }

  for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
    const candidates = report.candidates.filter((candidate) => candidate.category === category);
    if (candidates.length === 0) {
      continue;
    }
    process.stdout.write(`${chalk.bold(CATEGORY_LABELS[category])}\n`);
    for (const candidate of candidates) {
      const state = candidate.blockedReason
        ? chalk.red(`BLOCKED: ${candidate.blockedReason}`)
        : riskBadge(candidate);
      process.stdout.write(
        `  ${state.padEnd(18)} ${chalk.bold(formatBytes(candidate.sizeBytes).padStart(9))}  ${candidate.title}\n`,
      );
      process.stdout.write(`  ${' '.repeat(29)}${chalk.dim(displayPath(candidate.path))}\n`);
      process.stdout.write(`  ${' '.repeat(29)}${chalk.dim(`id ${candidate.id} · ${candidate.reason}`)}\n`);
    }
    process.stdout.write('\n');
  }

  const selectable = report.candidates.filter((candidate) => !candidate.blockedReason).length;
  process.stdout.write(
    `${chalk.bold(formatBytes(report.totalBytes))} potentially reclaimable across ${selectable} selectable items.\n`,
  );
  process.stdout.write(chalk.dim(`Scan completed in ${(report.elapsedMs / 1000).toFixed(1)}s.\n`));
  for (const warning of report.warnings) {
    process.stdout.write(`${chalk.yellow('Warning:')} ${warning}\n`);
  }
}

export function printCleanSummary(summary: CleanSummary): void {
  process.stdout.write('\n');
  for (const result of summary.results) {
    if (result.ok) {
      process.stdout.write(
        `${chalk.green('✓')} ${result.candidate.title} ${chalk.dim(`(${formatBytes(result.bytesReclaimed)})`)}\n`,
      );
    } else {
      process.stdout.write(
        `${chalk.red('✗')} ${result.candidate.title}: ${result.error ?? 'unknown error'}\n`,
      );
    }
  }
  process.stdout.write(
    `\n${chalk.bold.green(formatBytes(summary.bytesReclaimed))} reclaimed or scheduled for reclamation.\n`,
  );
}
