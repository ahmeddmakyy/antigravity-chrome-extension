import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "mychrome-test-"));

const dataDir = path.join(TEST_ROOT, "data");
const homeDir = path.join(TEST_ROOT, "home");
const tokenFile = path.join(dataDir, ".token");
const logsDir = path.join(TEST_ROOT, "logs");
const uploadsDir = path.join(TEST_ROOT, "uploads");

process.env.MYCHROME_DATA_DIR = dataDir;
process.env.MYCHROME_HOME_DIR = homeDir;
process.env.MYCHROME_TOKEN_FILE = tokenFile;
process.env.MYCHROME_LOGS_DIR = logsDir;
process.env.MYCHROME_UPLOADS_DIR = uploadsDir;

delete process.env.MYCHROME_TOKEN;
delete process.env.BRIDGE_PORT;
delete process.env.MYCHROME_ALLOWED_ORIGINS;
delete process.env.MYCHROME_HOOK_TRACE;

// Verify MYCHROME_DATA_DIR is inside os.tmpdir()
const resolvedTmp = path.resolve(os.tmpdir()).toLowerCase();
const resolvedData = path.resolve(process.env.MYCHROME_DATA_DIR).toLowerCase();
const rel = path.relative(resolvedTmp, resolvedData);
if (rel.startsWith("..") || path.isAbsolute(rel)) {
  throw new Error(`MYCHROME_DATA_DIR (${process.env.MYCHROME_DATA_DIR}) is not inside os.tmpdir() (${os.tmpdir()})`);
}

for (const dir of [dataDir, homeDir, logsDir, uploadsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

process.on("exit", () => {
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch {}
});

export function writeTestToken(token) {
  fs.mkdirSync(path.dirname(process.env.MYCHROME_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(process.env.MYCHROME_TOKEN_FILE, token, "utf-8");
  return token;
}
