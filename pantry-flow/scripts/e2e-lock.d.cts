export function lockFile(env?: NodeJS.ProcessEnv): string;
export function isAlive(pid: number): boolean;
export function acquireRunLock(file: string, pid: number, isAlive: (pid: number) => boolean, root?: string): void;
export function releaseRunLock(file: string, pid: number): void;
export function assertNoOtherRun(file: string, allowedPid: number | null, isAlive: (pid: number) => boolean): void;
