import process from 'node:process';

import chalk from 'chalk';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export class Spinner {
  readonly #text: string;
  #frame = 0;
  #timer: NodeJS.Timeout | null = null;
  #rendered = false;

  constructor(text: string) {
    this.#text = text;
  }

  start(): this {
    if (!process.stderr.isTTY) {
      process.stderr.write(`- ${this.#text}\n`);
      return this;
    }
    this.#render();
    this.#timer = setInterval(() => this.#render(), 80);
    this.#timer.unref();
    return this;
  }

  succeed(text = this.#text): void {
    this.#clear();
    process.stderr.write(`${chalk.green('✓')} ${text}\n`);
  }

  stop(): void {
    this.#clear();
  }

  #render(): void {
    const frame = FRAMES[this.#frame % FRAMES.length] ?? FRAMES[0];
    this.#frame += 1;
    process.stderr.write(`\r\u001B[2K${chalk.cyan(frame)} ${this.#text}`);
    this.#rendered = true;
  }

  #clear(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    if (this.#rendered) {
      process.stderr.write('\r\u001B[2K');
      this.#rendered = false;
    }
  }
}
