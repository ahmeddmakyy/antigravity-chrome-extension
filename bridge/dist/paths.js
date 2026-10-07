import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/paths.ts
import os from "os";
import path from "path";
import fs from "fs";
function getDataDir() {
  if (process.env.MYCHROME_DATA_DIR) {
    return path.resolve(process.env.MYCHROME_DATA_DIR);
  }
  const home = process.env.MYCHROME_HOME_DIR || os.homedir();
  return path.join(home, ".gemini", "mychrome");
}
function ensureDataDir() {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 448 });
    }
  } catch (err) {
    console.error(`[Paths] Failed to create data dir ${dir}:`, err);
  }
  return dir;
}
function getTokenPath(fallbackDir) {
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
function getLogsDir(fallbackDir) {
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
      fs.mkdirSync(logs, { recursive: true, mode: 448 });
    }
  } catch {
  }
  return logs;
}
function getUploadsDir(fallbackDir) {
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
      fs.mkdirSync(uploads, { recursive: true, mode: 448 });
    }
  } catch {
  }
  return uploads;
}
export {
  ensureDataDir,
  getDataDir,
  getLogsDir,
  getTokenPath,
  getUploadsDir
};
