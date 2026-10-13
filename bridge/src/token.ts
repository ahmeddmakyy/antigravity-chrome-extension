import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getTokenPath, ensureDataDir } from "./paths.js";

export function getOrCreatePairingToken(baseDir?: string): { token: string; isNew: boolean } {
  const tokenPath = getTokenPath(baseDir);
  try {
    if (fs.existsSync(tokenPath)) {
      const existing = fs.readFileSync(tokenPath, "utf-8").trim();
      if (existing.length >= 16) {
        return { token: existing, isNew: false };
      }
    }
  } catch {
    // regenerate if read fails
  }

  // Ensure directory exists
  const dir = path.dirname(tokenPath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  } catch {}

  const newToken = crypto.randomBytes(24).toString("hex");
  try {
    fs.writeFileSync(tokenPath, newToken, { encoding: "utf-8", mode: 0o600 });
  } catch (err) {
    console.error(`[Token] Failed to write token to ${tokenPath}:`, err);
  }
  return { token: newToken, isNew: true };
}

export function safeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) {
    return false;
  }
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function writeExtensionKey(extensionDir: string, token: string): { ok: boolean; path: string; error?: string } {
  let targetPath = "";
  let tmpPath: string | null = null;
  try {
    if (!extensionDir || typeof extensionDir !== "string") {
      return { ok: false, path: "", error: "Invalid extension directory" };
    }
    targetPath = path.join(extensionDir, "pairing.json");

    if (!fs.existsSync(extensionDir)) {
      return { ok: false, path: targetPath, error: "Extension directory does not exist" };
    }

    const stat = fs.statSync(extensionDir);
    if (!stat.isDirectory()) {
      return { ok: false, path: targetPath, error: "Extension path is not a directory" };
    }

    // Idempotent: check if file already contains the same token
    if (fs.existsSync(targetPath)) {
      try {
        const raw = fs.readFileSync(targetPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.token === token) {
          return { ok: true, path: targetPath };
        }
      } catch {
        // If unreadable or corrupt, rewrite below
      }
    }

    const tmpName = `.pairing.json.tmp.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`;
    tmpPath = path.join(extensionDir, tmpName);
    const content = JSON.stringify({ token }) + "\n";
    fs.writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600 });
    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {}

    fs.renameSync(tmpPath, targetPath);
    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {}

    tmpPath = null;
    return { ok: true, path: targetPath };
  } catch (err) {
    if (tmpPath) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {}
    }
    return {
      ok: false,
      path: targetPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

