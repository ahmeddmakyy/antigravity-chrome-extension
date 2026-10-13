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
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) {
    return false;
  }
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
function writeExtensionKey(extensionDir, token) {
  let targetPath = "";
  let tmpPath = null;
  try {
    if (!extensionDir || typeof extensionDir !== "string") {
      return { ok: false, path: "", error: "Invalid extension directory" };
    }
    targetPath = path2.join(extensionDir, "pairing.json");
    if (!fs2.existsSync(extensionDir)) {
      return { ok: false, path: targetPath, error: "Extension directory does not exist" };
    }
    const stat = fs2.statSync(extensionDir);
    if (!stat.isDirectory()) {
      return { ok: false, path: targetPath, error: "Extension path is not a directory" };
    }
    if (fs2.existsSync(targetPath)) {
      try {
        const raw = fs2.readFileSync(targetPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.token === token) {
          return { ok: true, path: targetPath };
        }
      } catch {
      }
    }
    const tmpName = `.pairing.json.tmp.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`;
    tmpPath = path2.join(extensionDir, tmpName);
    const content = JSON.stringify({ token }) + "\n";
    fs2.writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 384 });
    try {
      fs2.chmodSync(tmpPath, 384);
    } catch {
    }
    fs2.renameSync(tmpPath, targetPath);
    try {
      fs2.chmodSync(targetPath, 384);
    } catch {
    }
    tmpPath = null;
    return { ok: true, path: targetPath };
  } catch (err) {
    if (tmpPath) {
      try {
        if (fs2.existsSync(tmpPath)) {
          fs2.unlinkSync(tmpPath);
        }
      } catch {
      }
    }
    return {
      ok: false,
      path: targetPath,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
export {
  getOrCreatePairingToken,
  safeEqual,
  writeExtensionKey
};
