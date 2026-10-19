import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export async function runCommand(command, args, options = {}) {
    try {
        const result = await execFileAsync(command, args, {
            cwd: options.cwd,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: options.timeoutMs ?? 10_000,
        });
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
            timedOut: false,
        };
    }
    catch (error) {
        const value = error;
        return {
            stdout: value.stdout ?? '',
            stderr: value.stderr ?? value.message,
            exitCode: typeof value.code === 'number' ? value.code : 1,
            timedOut: value.killed === true,
        };
    }
}
export async function runningProcessCommands() {
    const result = await runCommand('ps', ['-axo', 'command='], { timeoutMs: 5_000 });
    return result.exitCode === 0 ? result.stdout : '';
}
//# sourceMappingURL=process.js.map