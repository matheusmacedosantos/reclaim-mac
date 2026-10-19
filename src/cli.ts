#!/usr/bin/env node

import process from 'node:process';

import chalk from 'chalk';
import { Command, Option } from 'commander';

import { cleanCandidates } from './core/cleaner.js';
import { scan } from './scanners/index.js';
import type { Candidate, ScanOptions } from './types.js';
import { printCleanSummary, printReport } from './ui/display.js';
import { interactive } from './ui/interactive.js';
import { Spinner } from './ui/spinner.js';

interface CommonCliOptions {
  root: string[];
  minAge: string;
  docker: boolean;
  simulators: boolean;
}

interface ScanCliOptions extends CommonCliOptions {
  json: boolean;
}

interface CleanCliOptions extends CommonCliOptions {
  id: string[];
  allSafe: boolean;
  includeReview: boolean;
  yes: boolean;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function scanOptions(options: CommonCliOptions): Partial<ScanOptions> {
  const minimumAge = Number.parseInt(options.minAge, 10);
  if (!Number.isFinite(minimumAge) || minimumAge < 0) {
    throw new Error('--min-age must be a non-negative integer');
  }
  return {
    roots: options.root,
    minAgeDays: minimumAge,
    includeDocker: options.docker,
    includeSimulators: options.simulators,
  };
}

function addCommonOptions(command: Command): Command {
  return command
    .option('-r, --root <path>', 'additional developer root to scan', collect, [])
    .option('--min-age <days>', 'minimum age for eligible items', '7')
    .option('--no-docker', 'skip Docker build-cache inspection')
    .option('--no-simulators', 'skip unavailable simulator inspection');
}

const program = new Command()
  .name('reclaim-mac')
  .description('Cautious, Git-aware disk space cleanup for macOS developer machines')
  .version('0.1.0')
  .showHelpAfterError();

addCommonOptions(
  program
    .command('scan')
    .description('analyze the machine without deleting anything')
    .option('--json', 'emit a machine-readable report', false),
).action(async (options: ScanCliOptions) => {
  const spinner = options.json ? null : new Spinner('Scanning').start();
  const report = await scan(scanOptions(options));
  spinner?.stop();
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printReport(report);
  }
});

addCommonOptions(
  program
    .command('clean')
    .description('select and permanently remove eligible items')
    .option('--id <candidate-id>', 'clean a candidate from a fresh scan', collect, [])
    .option('--all-safe', 'select every unblocked safe candidate', false)
    .option('--include-review', 'allow review-level candidates in scripted mode', false)
    .addOption(new Option('-y, --yes', 'skip prompts in scripted mode').default(false)),
).action(async (options: CleanCliOptions) => {
  if (options.id.length === 0 && !options.allSafe) {
    await interactive(scanOptions(options));
    return;
  }
  if (!options.yes) {
    throw new Error('scripted cleaning requires --yes');
  }

  const report = await scan(scanOptions(options));
  const requested = new Set(options.id);
  const selected: Candidate[] = report.candidates.filter((candidate) => {
    if (candidate.blockedReason) {
      return false;
    }
    const explicitlySelected = requested.has(candidate.id);
    const selectedAsSafe = options.allSafe && candidate.risk === 'safe';
    if (!explicitlySelected && !selectedAsSafe) {
      return false;
    }
    return candidate.risk === 'safe' || options.includeReview;
  });

  if (selected.length === 0) {
    throw new Error('no matching candidates are eligible for scripted cleaning');
  }
  const summary = await cleanCandidates(selected);
  printCleanSummary(summary);
  if (summary.results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('reclaim-mac supports macOS only');
  }
  if (process.argv.length === 2) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('interactive mode requires a TTY; use `reclaim-mac scan --json`');
    }
    await interactive();
    return;
  }
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${chalk.red('Error:')} ${message}\n`);
  process.exitCode = 1;
});
