export type LogListener = (level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: unknown) => void;
export declare class Logger {
    private logFilePath;
    private listeners;
    constructor(logsDir: string);
    addListener(listener: LogListener): void;
    removeListener(listener: LogListener): void;
    log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: unknown): void;
    getRecentLines(maxLines?: number): string[];
    info(msg: string, data?: unknown): void;
    warn(msg: string, data?: unknown): void;
    error(msg: string, data?: unknown): void;
    debug(msg: string, data?: unknown): void;
}
