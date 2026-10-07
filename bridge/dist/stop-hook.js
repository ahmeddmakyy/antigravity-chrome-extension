import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/stop-hook.ts
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

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

// src/stop-hook.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var BRIDGE_ROOT = path2.resolve(__dirname, "..");
var PORT = parseInt(process.env.BRIDGE_PORT || "8765", 10);
var MAX_WAIT_MS = parseInt(process.env.MYCHROME_HOOK_MAX_MS || "1815000", 10);
var ALLOW_STOP = JSON.stringify({ decision: "stop" });
var TRACE_FILE = process.env.MYCHROME_HOOK_TRACE || path2.join(getLogsDir(BRIDGE_ROOT), "hook-trace.log");
var started = Date.now();
function trace(payload, outcome) {
  if (TRACE_FILE === "off") return;
  try {
    let cid = "none";
    let reason = "n/a";
    try {
      const body = JSON.parse(payload || "{}");
      if (typeof body.conversationId === "string") cid = body.conversationId.slice(0, 8);
      if (typeof body.terminationReason === "string") reason = body.terminationReason;
      if (body.selfTest === true) cid = "self-test";
    } catch {
      cid = "unparsed";
    }
    fs2.mkdirSync(path2.dirname(TRACE_FILE), { recursive: true });
    try {
      if (fs2.statSync(TRACE_FILE).size > 200 * 1024) {
        const lines = fs2.readFileSync(TRACE_FILE, "utf-8").split("\n").slice(-200);
        fs2.writeFileSync(TRACE_FILE, lines.join("\n"), "utf-8");
      }
    } catch {
    }
    fs2.appendFileSync(
      TRACE_FILE,
      `${(/* @__PURE__ */ new Date()).toISOString()} conversation=${cid} reason=${reason} -> ${outcome} (${Date.now() - started}ms)
`,
      "utf-8"
    );
  } catch {
  }
}
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    const guard = setTimeout(() => resolve(data), 3e3);
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => {
      clearTimeout(guard);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(guard);
      resolve(data);
    });
  });
}
async function main() {
  const raw = await readStdin();
  let token = process.env.MYCHROME_TOKEN || "";
  if (!token) {
    try {
      token = fs2.readFileSync(getTokenPath(BRIDGE_ROOT), "utf-8").trim();
    } catch {
      trace(raw, "stop (token file missing)");
      process.stdout.write(ALLOW_STOP);
      return;
    }
  }
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/hook/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: raw && raw.trim() ? raw : "{}",
      signal: AbortSignal.timeout(MAX_WAIT_MS)
    });
    if (!res.ok) {
      trace(raw, `stop (bridge answered HTTP ${res.status})`);
      process.stdout.write(ALLOW_STOP);
      return;
    }
    const out = await res.json();
    if (out && out.decision === "continue" && typeof out.reason === "string" && out.reason) {
      trace(raw, "continue");
      process.stdout.write(JSON.stringify({ decision: "continue", reason: out.reason }));
    } else {
      trace(raw, "stop");
      process.stdout.write(ALLOW_STOP);
    }
  } catch (err) {
    trace(raw, `stop (bridge not reachable: ${err instanceof Error ? err.name : "error"})`);
    process.stdout.write(ALLOW_STOP);
  }
}
main().then(
  () => process.exit(0),
  () => {
    process.stdout.write(ALLOW_STOP);
    process.exit(0);
  }
);
