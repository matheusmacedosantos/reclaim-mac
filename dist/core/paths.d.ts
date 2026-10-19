export declare function expandPath(input: string, home?: string): string;
export declare function isWithin(parent: string, child: string): boolean;
export declare function pathSegments(path: string): string[];
export declare function isProtectedPath(path: string): boolean;
export declare function isProtectedByConfiguration(path: string, protectedPaths: string[]): boolean;
export declare function defaultDeveloperRoots(home?: string): Promise<string[]>;
export declare function agentTemporaryRoots(home?: string): Promise<string[]>;
export declare function uniquePaths(paths: string[]): string[];
//# sourceMappingURL=paths.d.ts.map