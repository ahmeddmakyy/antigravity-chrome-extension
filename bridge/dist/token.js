import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/token.ts
import fs2 from "fs";
import path2 from "path";
import crypto from "crypto";

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

// src/token.ts
function getOrCreatePairingToken(baseDir) {
  const tokenPath = getTokenPath(baseDir);
  try {
    if (fs2.existsSync(tokenPath)) {
      const existing = fs2.readFileSync(tokenPath, "utf-8").trim();
      if (existing.length >= 16) {
        return { token: existing, isNew: false };
      }
    }
  } catch {
  }
  const dir = path2.dirname(tokenPath);
  try {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true, mode: 448 });
    }
  } catch {
  }
  const newToken = crypto.randomBytes(24).toString("hex");
  try {
    fs2.writeFileSync(tokenPath, newToken, { encoding: "utf-8", mode: 384 });
  } catch (err) {
    console.error(`[Token] Failed to write token to ${tokenPath}:`, err);
  }
  return { token: newToken, isNew: true };
}
export {
  getOrCreatePairingToken
};
