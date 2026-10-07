/**
 * MyChrome waker: an Antigravity sidecar.
 *
 * Antigravity starts this script in the background (see ~/.gemini/config/sidecars/mychrome-waker/).
 * Sidecars get the `agentapi` command on their PATH. The bridge hands us "wake jobs" through a
 * local long-poll, and we deliver each one with:
 *
 *     agentapi send-message <conversation_id> <prompt>
 *
 * That starts a new turn in the linked Antigravity conversation, so the agent never has to poll.
 * Polling here is local HTTP only: it costs no model tokens.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { getTokenPath } from "./paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.BRIDGE_PORT || "8765", 10);
const BASE = `http://127.0.0.1:${PORT}`;
const JOB_TIMEOUT_MS = 20000;

interface WakeJob {
  jobId: string;
  action: "send-message";
  conversationId: string;
  prompt: string;
  safePrompt: string;
}

interface AgentApi {
  bin: string;
  needsShell: boolean;
}

let logSink: ((message: string) => void) | null = null;

/** The helper routes waker messages into bridge.log (a detached process has no console). */
export function setWakerLogger(fn: (message: string) => void): void {
  logSink = fn;
}

function log(message: string): void {
  if (logSink) logSink(`[Waker] ${message}`);
  else process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function readToken(): string {
  if (process.env.MYCHROME_TOKEN) return process.env.MYCHROME_TOKEN;
  try {
    return fs.readFileSync(getTokenPath(BRIDGE_ROOT), "utf-8").trim();
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Find agentapi on PATH (Antigravity adds it for sidecars). */
/**
 * Find agentapi. Sidecars get Antigravity's bin folder on PATH, but the helper may also be started
 * by an MCP process, which does not. So we also look in Antigravity's own bin folders.
 */
export function resolveAgentApi(): AgentApi | null {
  const override = process.env.AGENTAPI_BIN;
  if (override && fs.existsSync(override)) {
    return { bin: override, needsShell: /\.(cmd|bat)$/i.test(override) };
  }
  const isWin = process.platform === "win32";
  const exts = isWin ? ["", ".exe", ".cmd", ".bat"] : [""];
  const home = os.homedir();
  const knownDirs = ["antigravity", "antigravity-cli", "antigravity-ide"].map((d) => path.join(home, ".gemini", d, "bin"));
  const dirs = [...(process.env.PATH || process.env.Path || "").split(path.delimiter).filter(Boolean), ...knownDirs];
  // Prefer real executables over shell shims, so the user's text never passes through a shell.
  for (const preferShim of [false, true]) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const isShim = /\.(cmd|bat)$/i.test(ext);
        if (isShim !== preferShim) continue;
        if (isWin && ext === "") continue;
        const candidate = path.join(dir, `agentapi${ext}`);
        try {
          if (fs.statSync(candidate).isFile()) {
            return { bin: candidate, needsShell: isShim };
          }
        } catch {}
      }
    }
  }
  return null;
}

function runAgentApi(api: AgentApi, job: WakeJob): Promise<{ ok: boolean; error?: string; usedSafePrompt: boolean }> {
  return new Promise((resolve) => {
    // With a shell shim we only pass a fixed ASCII prompt; the agent then reads the real text
    // with read_panel_messages. This keeps user text away from cmd.exe parsing.
    const useSafe = api.needsShell;
    const prompt = useSafe ? job.safePrompt.replace(/[^A-Za-z0-9 .,_']/g, " ") : job.prompt;
    const args = ["send-message", job.conversationId, prompt];
    const child = useSafe
      ? spawn(`"${api.bin}"`, args.map((a) => `"${a}"`), { shell: true, windowsHide: true })
      : spawn(api.bin, args, { shell: false, windowsHide: true });

    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

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

async function postResult(token: string, body: unknown): Promise<void> {
  try {
    await fetch(`${BASE}/waker/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    log(`Could not report a job result: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function runWaker(): Promise<void> {
  log(`MyChrome waker started. Bridge: ${BASE}`);
  let api = resolveAgentApi();
  while (!api) {
    log("agentapi was not found (PATH and ~/.gemini/antigravity*/bin). Retrying in 30s.");
    await sleep(30000);
    api = resolveAgentApi();
  }
  log(`Using agentapi at ${api.bin}${api.needsShell ? " (shell shim, safe prompts only)" : ""}`);

  let bridgeWasDown = false;
  for (;;) {
    const token = readToken();
    if (!token) {
      log("bridge/.token is missing. Waiting for the bridge to create it.");
      await sleep(5000);
      continue;
    }
    let res: Response;
    try {
      res = await fetch(`${BASE}/waker/next`, {
        headers: { "x-bridge-token": token },
        signal: AbortSignal.timeout(35000),
      });
    } catch {
      if (!bridgeWasDown) log("Helper is not reachable yet.");
      bridgeWasDown = true;
      await sleep(3000);
      continue;
    }
    if (bridgeWasDown) {
      log("Bridge is reachable.");
      bridgeWasDown = false;
    }
    if (res.status === 204) continue;
    if (res.status === 403) {
      log("The bridge rejected our token. Re-reading bridge/.token in 5s.");
      await sleep(5000);
      continue;
    }
    if (res.status !== 200) {
      log(`Unexpected status ${res.status} from the bridge.`);
      await sleep(3000);
      continue;
    }

    let job: WakeJob;
    try {
      job = (await res.json()) as WakeJob;
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

// Run on its own only when started as waker.js (the helper imports runWaker instead).
const startedDirectly = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(__filename);
if (startedDirectly && path.basename(__filename).startsWith("waker.")) {
  runWaker().catch((err) => {
    log(`Fatal: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    process.exit(1);
  });
}
