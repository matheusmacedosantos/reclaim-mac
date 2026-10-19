export interface UserConfig {
    roots: string[];
    protectedPaths: string[];
}
export declare function userConfigPath(): string;
export declare function loadUserConfig(): Promise<UserConfig>;
//# sourceMappingURL=config.d.ts.map