import fs from "fs";
import path from "path";

export type LogListener = (level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: unknown) => void;

export class Logger {
  private logFilePath: string;
  private listeners: LogListener[] = [];

  constructor(logsDir: string) {
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }
    this.logFilePath = path.join(logsDir, "bridge.log");
  }

  addListener(listener: LogListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: LogListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? " " + (typeof data === "string" ? data : JSON.stringify(data)) : "";
    const line = `[${timestamp}] [${level}] ${message}${dataStr}\n`;
    
    // Write to file
    try {
      fs.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
      // ignore
    }

    // Output to stderr so stdout remains 100% clean for MCP stdio protocol
    if (level === "ERROR" || level === "WARN") {
      process.stderr.write(line);
    }

    for (const listener of this.listeners) {
      try {
        listener(level, message, data);
      } catch {
        // ignore listener errors
      }
    }
  }

  getRecentLines(maxLines = 500): string[] {
    try {
      if (!fs.existsSync(this.logFilePath)) return [];
      const content = fs.readFileSync(this.logFilePath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim().length > 0);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }

  info(msg: string, data?: unknown) { this.log("INFO", msg, data); }
  warn(msg: string, data?: unknown) { this.log("WARN", msg, data); }
  error(msg: string, data?: unknown) { this.log("ERROR", msg, data); }
  debug(msg: string, data?: unknown) { this.log("DEBUG", msg, data); }
}

