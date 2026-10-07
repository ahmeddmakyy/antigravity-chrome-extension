/**
 * MyChrome Stop hook for Antigravity.
 *
 * Antigravity runs this every time an agent turn ends and passes a JSON payload on stdin
 * (conversationId, terminationReason, ...). We forward it to the bridge, which answers with
 * {"decision":"stop"} or {"decision":"continue","reason":"..."}.
 *
 * For any conversation that is not linked to the side panel, the bridge answers "stop" at once.
 * If anything goes wrong we always print "stop", so a broken bridge can never block Antigravity.
 *
 * Every run appends one line to bridge/logs/hook-trace.log. If that file never appears after a few
 * agent turns, Antigravity is not running the hook at all (check Settings > Customizations > Hooks).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTokenPath, getLogsDir } from "./paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.BRIDGE_PORT || "8765", 10);
// Must be a bit shorter than the hook timeout in hooks.json so we always answer ourselves.
const MAX_WAIT_MS = parseInt(process.env.MYCHROME_HOOK_MAX_MS || "1815000", 10);

const ALLOW_STOP = JSON.stringify({ decision: "stop" });
const TRACE_FILE = process.env.MYCHROME_HOOK_TRACE || path.join(getLogsDir(BRIDGE_ROOT), "hook-trace.log");
const started = Date.now();

/** One short line per run. Never throws, never blocks. */
function trace(payload: string, outcome: string): void {
  if (TRACE_FILE === "off") return;
  try {
    let cid = "none";
    let reason = "n/a";
    try {
      const body = JSON.parse(payload || "{}") as Record<string, unknown>;
      if (typeof body.conversationId === "string") cid = body.conversationId.slice(0, 8);
      if (typeof body.terminationReason === "string") reason = body.terminationReason;
      if (body.selfTest === true) cid = "self-test";
    } catch {
      cid = "unparsed";
    }
    fs.mkdirSync(path.dirname(TRACE_FILE), { recursive: true });
    try {
      if (fs.statSync(TRACE_FILE).size > 200 * 1024) {
        const lines = fs.readFileSync(TRACE_FILE, "utf-8").split("\n").slice(-200);
        fs.writeFileSync(TRACE_FILE, lines.join("\n"), "utf-8");
      }
    } catch {}
    fs.appendFileSync(
      TRACE_FILE,
      `${new Date().toISOString()} conversation=${cid} reason=${reason} -> ${outcome} (${Date.now() - started}ms)\n`,
      "utf-8"
    );
  } catch {}
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const guard = setTimeout(() => resolve(data), 3000);
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
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

async function main(): Promise<void> {
  const raw = await readStdin();
  let token = process.env.MYCHROME_TOKEN || "";
  if (!token) {
    try {
      token = fs.readFileSync(getTokenPath(BRIDGE_ROOT), "utf-8").trim();
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
      signal: AbortSignal.timeout(MAX_WAIT_MS),
    });
    if (!res.ok) {
      trace(raw, `stop (bridge answered HTTP ${res.status})`);
      process.stdout.write(ALLOW_STOP);
      return;
    }
    const out = (await res.json()) as { decision?: string; reason?: string };
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
