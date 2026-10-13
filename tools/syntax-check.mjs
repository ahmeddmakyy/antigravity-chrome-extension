import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const EXTENSION_DIR = path.join(REPO_ROOT, "extension");

function findJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "vendor") continue;
      results.push(...findJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findJsFiles(EXTENSION_DIR);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "syntax-check-"));
let failures = 0;
let okCount = 0;

try {
  for (const file of files) {
    const tempFile = path.join(tempDir, `check-${Math.random().toString(36).slice(2)}.mjs`);
    fs.copyFileSync(file, tempFile);
    try {
      execSync(`node --check ${JSON.stringify(tempFile)}`, { stdio: "pipe" });
      okCount++;
    } catch (err) {
      failures++;
      console.error(`Syntax check failed for ${file}:\n${err.stderr?.toString() || err.message}`);
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

if (failures > 0) {
  console.error(`${failures} file(s) failed syntax check`);
  process.exit(1);
}

console.log(`${okCount} files OK`);
