import { createInterface } from 'node:readline/promises';

import checkbox from '@inquirer/checkbox';
import confirm from '@inquirer/confirm';
import chalk from 'chalk';

import { cleanCandidates } from '../core/cleaner.js';
import { formatBytes } from '../core/size.js';
import { scan } from '../scanners/index.js';
import type { Candidate, ScanOptions } from '../types.js';
import { banner, diskSummary, displayPath, printCleanSummary } from './display.js';
import { Spinner } from './spinner.js';

function choiceName(candidate: Candidate): string {
  const badge = candidate.risk === 'safe' ? chalk.green('safe') : chalk.yellow('review');
  return `${badge.padEnd(12)} ${formatBytes(candidate.sizeBytes).padStart(9)}  ${candidate.title}  ${chalk.dim(displayPath(candidate.path))}`;
}

async function typedConfirmation(count: number): Promise<boolean> {
  const phrase = `delete ${count}`;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      `Type ${chalk.bold(phrase)} to permanently remove the selected items: `,
    );
    return answer.trim() === phrase;
  } finally {
    prompt.close();
  }
}

export async function interactive(options: Partial<ScanOptions> = {}): Promise<void> {
  process.stdout.write(`${banner()}\n`);
  const disk = await diskSummary();
  if (disk) {
    process.stdout.write(`${chalk.dim(disk)}\n`);
  }
  process.stdout.write('\n');

  const spinner = new Spinner('Scanning safe locations and developer roots').start();
  const report = await scan(options);
  spinner.succeed(
    `Found ${report.candidates.length} items (${formatBytes(report.totalBytes)} selectable)`,
  );

  if (report.candidates.length === 0) {
    process.stdout.write(`${chalk.green('Nothing eligible was found.')}\n`);
    return;
  }

  const selectedIds = await checkbox({
    message: 'Choose what to remove',
    pageSize: 18,
    loop: false,
    instructions: 'Space toggles · enter confirms · review items start unchecked',
    choices: report.candidates.map((candidate) => ({
      name: choiceName(candidate),
      value: candidate.id,
      checked: candidate.risk === 'safe' && !candidate.blockedReason,
      ...(candidate.blockedReason ? { disabled: candidate.blockedReason } : {}),
    })),
  });

  const selected = report.candidates.filter((candidate) => selectedIds.includes(candidate.id));
  if (selected.length === 0) {
    process.stdout.write(`${chalk.dim('Nothing selected.')}\n`);
    return;
  }

  const selectedBytes = selected.reduce((total, candidate) => total + candidate.sizeBytes, 0);
  const proceed = await confirm({
    message: `Permanently remove ${selected.length} items (${formatBytes(selectedBytes)})?`,
    default: false,
  });
  if (!proceed || !(await typedConfirmation(selected.length))) {
    process.stdout.write(`${chalk.dim('Cancelled. No files were removed.')}\n`);
    return;
  }

  const cleaning = new Spinner('Revalidating and cleaning selected items').start();
  const summary = await cleanCandidates(selected);
  cleaning.stop();
  printCleanSummary(summary);
}
