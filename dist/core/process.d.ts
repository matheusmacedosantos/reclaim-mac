export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}
export declare function runCommand(command: string, args: string[], options?: {
    cwd?: string;
    timeoutMs?: number;
}): Promise<CommandResult>;
export declare function runningProcessCommands(): Promise<string>;
//# sourceMappingURL=process.d.ts.map