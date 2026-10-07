import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/logger.ts
import fs from "fs";
import path from "path";
var Logger = class {
  logFilePath;
  listeners = [];
  constructor(logsDir) {
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (err) {
      }
    }
    this.logFilePath = path.join(logsDir, "bridge.log");
  }
  addListener(listener) {
    this.listeners.push(listener);
  }
  removeListener(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  log(level, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const dataStr = data ? " " + (typeof data === "string" ? data : JSON.stringify(data)) : "";
    const line = `[${timestamp}] [${level}] ${message}${dataStr}
`;
    try {
      fs.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
    }
    if (level === "ERROR" || level === "WARN") {
      process.stderr.write(line);
    }
    for (const listener of this.listeners) {
      try {
        listener(level, message, data);
      } catch {
      }
    }
  }
  getRecentLines(maxLines = 500) {
    try {
      if (!fs.existsSync(this.logFilePath)) return [];
      const content = fs.readFileSync(this.logFilePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }
  info(msg, data) {
    this.log("INFO", msg, data);
  }
  warn(msg, data) {
    this.log("WARN", msg, data);
  }
  error(msg, data) {
    this.log("ERROR", msg, data);
  }
  debug(msg, data) {
    this.log("DEBUG", msg, data);
  }
};
export {
  Logger
};
