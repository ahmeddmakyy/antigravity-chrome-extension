import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/waker.ts
import fs2 from "fs";
import os2 from "os";
import path2 from "path";
import { spawn } from "child_process";
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

// src/waker.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var BRIDGE_ROOT = path2.resolve(__dirname, "..");
var PORT = parseInt(process.env.BRIDGE_PORT || "8765", 10);
var BASE = `http://127.0.0.1:${PORT}`;
var JOB_TIMEOUT_MS = 2e4;
var logSink = null;
function setWakerLogger(fn) {
  logSink = fn;
}
function log(message) {
  if (logSink) logSink(`[Waker] ${message}`);
  else process.stdout.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`);
}
function readToken() {
  if (process.env.MYCHROME_TOKEN) return process.env.MYCHROME_TOKEN;
  try {
    return fs2.readFileSync(getTokenPath(BRIDGE_ROOT), "utf-8").trim();
  } catch {
    return "";
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function resolveAgentApi() {
  const override = process.env.AGENTAPI_BIN;
  if (override && fs2.existsSync(override)) {
    return { bin: override, needsShell: /\.(cmd|bat)$/i.test(override) };
  }
  const isWin = process.platform === "win32";
  const exts = isWin ? ["", ".exe", ".cmd", ".bat"] : [""];
  const home = os2.homedir();
  const knownDirs = ["antigravity", "antigravity-cli", "antigravity-ide"].map((d) => path2.join(home, ".gemini", d, "bin"));
  const dirs = [...(process.env.PATH || process.env.Path || "").split(path2.delimiter).filter(Boolean), ...knownDirs];
  for (const preferShim of [false, true]) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const isShim = /\.(cmd|bat)$/i.test(ext);
        if (isShim !== preferShim) continue;
        if (isWin && ext === "") continue;
        const candidate = path2.join(dir, `agentapi${ext}`);
        try {
          if (fs2.statSync(candidate).isFile()) {
            return { bin: candidate, needsShell: isShim };
          }
        } catch {
        }
      }
    }
  }
  return null;
}
function runAgentApi(api, job) {
  return new Promise((resolve) => {
    const useSafe = api.needsShell;
    const prompt = useSafe ? job.safePrompt.replace(/[^A-Za-z0-9 .,_']/g, " ") : job.prompt;
    const args = ["send-message", job.conversationId, prompt];
    const child = useSafe ? spawn(`"${api.bin}"`, args.map((a) => `"${a}"`), { shell: true, windowsHide: true }) : spawn(api.bin, args, { shell: false, windowsHide: true });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d) => stdout += d.toString());
    child.stderr?.on("data", (d) => stderr += d.toString());
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "agentapi timed out", usedSafePrompt: useSafe });
    }, JOB_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `agentapi could not start: ${err.message}`, usedSafePrompt: useSafe });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, usedSafePrompt: useSafe });
      } else {
        const detail = (stderr || stdout).trim().slice(0, 400);
        resolve({ ok: false, error: `agentapi exited with code ${code}${detail ? `: ${detail}` : ""}`, usedSafePrompt: useSafe });
      }
    });
  });
}
async function postResult(token, body) {
  try {
    await fetch(`${BASE}/waker/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5e3)
    });
  } catch (err) {
    log(`Could not report a job result: ${err instanceof Error ? err.message : String(err)}`);
  }
}
async function runWaker() {
  log(`MyChrome waker started. Bridge: ${BASE}`);
  let api = resolveAgentApi();
  while (!api) {
    log("agentapi was not found (PATH and ~/.gemini/antigravity*/bin). Retrying in 30s.");
    await sleep(3e4);
    api = resolveAgentApi();
  }
  log(`Using agentapi at ${api.bin}${api.needsShell ? " (shell shim, safe prompts only)" : ""}`);
  let bridgeWasDown = false;
  for (; ; ) {
    const token = readToken();
    if (!token) {
      log("bridge/.token is missing. Waiting for the bridge to create it.");
      await sleep(5e3);
      continue;
    }
    let res;
    try {
      res = await fetch(`${BASE}/waker/next`, {
        headers: { "x-bridge-token": token },
        signal: AbortSignal.timeout(35e3)
      });
    } catch {
      if (!bridgeWasDown) log("Helper is not reachable yet.");
      bridgeWasDown = true;
      await sleep(3e3);
      continue;
    }
    if (bridgeWasDown) {
      log("Bridge is reachable.");
      bridgeWasDown = false;
    }
    if (res.status === 204) continue;
    if (res.status === 403) {
      log("The bridge rejected our token. Re-reading bridge/.token in 5s.");
      await sleep(5e3);
      continue;
    }
    if (res.status !== 200) {
      log(`Unexpected status ${res.status} from the bridge.`);
      await sleep(3e3);
      continue;
    }
    let job;
    try {
      job = await res.json();
    } catch {
      continue;
    }
    if (!job || job.action !== "send-message" || !job.conversationId) continue;
    log(`Delivering ${job.jobId} to conversation ${job.conversationId}`);
    const result = await runAgentApi(api, job);
    log(result.ok ? `Delivered ${job.jobId}` : `Failed ${job.jobId}: ${result.error}`);
    await postResult(token, { jobId: job.jobId, ...result });
  }
}
var startedDirectly = Boolean(process.argv[1]) && path2.resolve(process.argv[1]) === path2.resolve(__filename);
if (startedDirectly && path2.basename(__filename).startsWith("waker.")) {
  runWaker().catch((err) => {
    log(`Fatal: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    process.exit(1);
  });
}
export {
  resolveAgentApi,
  runWaker,
  setWakerLogger
};
