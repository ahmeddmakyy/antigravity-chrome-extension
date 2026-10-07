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
