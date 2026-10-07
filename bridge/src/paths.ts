import os from "os";
import path from "path";
import fs from "fs";

/**
 * Returns the root data directory for MyChrome (~/.gemini/mychrome).
 * Can be overridden via MYCHROME_DATA_DIR or MYCHROME_HOME_DIR for tests and custom setups.
 */
export function getDataDir(): string {
  if (process.env.MYCHROME_DATA_DIR) {
    return path.resolve(process.env.MYCHROME_DATA_DIR);
  }
  const home = process.env.MYCHROME_HOME_DIR || os.homedir();
  return path.join(home, ".gemini", "mychrome");
}

/**
 * Ensures the data directory exists with safe permissions.
 */
export function ensureDataDir(): string {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  } catch (err) {
    console.error(`[Paths] Failed to create data dir ${dir}:`, err);
  }
  return dir;
}

/**
 * Resolves the path to the pairing token.
 * Prefers ~/.gemini/mychrome/.token, but falls back to fallbackDir/.token if present (e.g. in test suites).
 */
export function getTokenPath(fallbackDir?: string): string {
  if (process.env.MYCHROME_TOKEN_FILE) {
    return path.resolve(process.env.MYCHROME_TOKEN_FILE);
  }
  const dataDirToken = path.join(getDataDir(), ".token");
  if (fs.existsSync(dataDirToken)) {
    return dataDirToken;
  }
  if (fallbackDir) {
    const fallbackToken = path.join(fallbackDir, ".token");
    if (fs.existsSync(fallbackToken)) {
      return fallbackToken;
    }
  }
  return dataDirToken;
}

/**
 * Resolves the logs directory (~/.gemini/mychrome/logs).
 */
export function getLogsDir(fallbackDir?: string): string {
  if (process.env.MYCHROME_LOGS_DIR) {
    return path.resolve(process.env.MYCHROME_LOGS_DIR);
  }
  const dataDir = getDataDir();
  if (fallbackDir && !fs.existsSync(dataDir) && fs.existsSync(fallbackDir)) {
    return path.join(fallbackDir, "logs");
  }
  const logs = path.join(dataDir, "logs");
  try {
    if (!fs.existsSync(logs)) {
      fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
    }
  } catch {}
  return logs;
}

/**
 * Resolves the uploads directory (~/.gemini/mychrome/uploads).
 */
export function getUploadsDir(fallbackDir?: string): string {
  if (process.env.MYCHROME_UPLOADS_DIR) {
    return path.resolve(process.env.MYCHROME_UPLOADS_DIR);
  }
  const dataDir = getDataDir();
  if (fallbackDir && !fs.existsSync(dataDir) && fs.existsSync(fallbackDir)) {
    return path.join(fallbackDir, "uploads");
  }
  const uploads = path.join(dataDir, "uploads");
  try {
    if (!fs.existsSync(uploads)) {
      fs.mkdirSync(uploads, { recursive: true, mode: 0o700 });
    }
  } catch {}
  return uploads;
}
