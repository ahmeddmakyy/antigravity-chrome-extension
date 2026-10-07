/**
 * npm run setup            Install the MyChrome wake-up (sidecar + Stop hook) and the /mychrome skill.
 * npm run setup -- --check Show what the running bridge sees (versions, hook trace, wake mode).
 * npm run setup -- --test-hook  Run the Stop hook script once by hand and confirm it reaches the bridge.
 * npm run setup -- --uninstall
 *
 * Files touched (each existing file is backed up next to itself first):
 *   ~/.gemini/config/sidecars/mychrome-waker/sidecar.json
 *   ~/.gemini/config/config.json      (sidecars.mychrome-waker.enabled = true)
 *   ~/.gemini/config/hooks.json       ("mychrome-bridge" Stop hook)
 *   ~/.gemini/config/skills/mychrome/SKILL.md
 *   <workspace>/.agents/skills/mychrome/SKILL.md   (only if that folder already exists)
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { BRIDGE_VERSION } from "./version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(BRIDGE_ROOT, "..");
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "..");
const CONFIG_DIR = process.env.GEMINI_CONFIG_DIR || path.join(os.homedir(), ".gemini", "config");

const SIDECAR_ID = "mychrome-waker";
const HOOK_NAME = "mychrome-bridge";
const HOOK_TIMEOUT_S = 1830;

const args = new Set(process.argv.slice(2));

function fwd(p: string): string {
  return p.replace(/\\/g, "/");
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function backup(file: string): void {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak-${stamp()}`);
  }
}

function readJson(file: string): Record<string, unknown> {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error(`${file} is not valid JSON. Fix or rename it, then run setup again.`);
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  backup(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function ok(msg: string): void {
  process.stdout.write(`  OK  ${msg}\n`);
}

function warn(msg: string): void {
  process.stdout.write(`  !!  ${msg}\n`);
}

function setSessionFlag(setupDone: boolean): void {
  const file = path.join(BRIDGE_ROOT, ".session.json");
  const current = readJson(file);
  fs.writeFileSync(file, JSON.stringify({ ...current, setupDone }, null, 2), "utf-8");
}

function install(): void {
  const waker = path.join(BRIDGE_ROOT, "dist", "waker.js");
  const hook = path.join(BRIDGE_ROOT, "dist", "stop-hook.js");
  for (const f of [waker, hook]) {
    if (!fs.existsSync(f)) {
      throw new Error(`${f} is missing. Run "npm run build" first.`);
    }
  }

  process.stdout.write(`\nMyChrome setup v${BRIDGE_VERSION}\nAntigravity config folder: ${CONFIG_DIR}\n\n`);

  // 1. Sidecar definition
  const sidecarFile = path.join(CONFIG_DIR, "sidecars", SIDECAR_ID, "sidecar.json");
  writeJson(sidecarFile, {
    display_name: "MyChrome waker",
    description: "Delivers messages from the Antigravity Chrome side panel into the linked conversation.",
    command: "node",
    args: [fwd(waker)],
    restart_policy: "always",
    env: { BRIDGE_PORT: process.env.BRIDGE_PORT || "8765" },
  });
  ok(`Sidecar written: ${sidecarFile}`);

  // 2. Enable the sidecar
  const configFile = path.join(CONFIG_DIR, "config.json");
  const config = readJson(configFile);
  const sidecars = (config.sidecars && typeof config.sidecars === "object" ? config.sidecars : {}) as Record<string, unknown>;
  const existing = (sidecars[SIDECAR_ID] && typeof sidecars[SIDECAR_ID] === "object" ? sidecars[SIDECAR_ID] : {}) as Record<string, unknown>;
  sidecars[SIDECAR_ID] = { ...existing, enabled: true };
  config.sidecars = sidecars;
  writeJson(configFile, config);
  ok(`Sidecar enabled in ${configFile}`);

  // 3. Stop hook
  const hooksFile = path.join(CONFIG_DIR, "hooks.json");
  const hooks = readJson(hooksFile);
  hooks[HOOK_NAME] = {
    enabled: true,
    Stop: [{ type: "command", command: `node "${fwd(hook)}"`, timeout: HOOK_TIMEOUT_S }],
  };
  writeJson(hooksFile, hooks);
  ok(`Stop hook added to ${hooksFile}`);

  // 4. Skill
  const primarySkillSrc = path.join(PROJECT_ROOT, "plugin", "skills", "mychrome", "SKILL.md");
  const fallbackSkillSrc = path.join(PROJECT_ROOT, "skills", "mychrome", "SKILL.md");
  const skillSrc = fs.existsSync(primarySkillSrc) ? primarySkillSrc : fallbackSkillSrc;
  if (fs.existsSync(skillSrc)) {
    const targets = [path.join(CONFIG_DIR, "skills", "mychrome", "SKILL.md")];
    const wsSkillDir = path.join(WORKSPACE_ROOT, ".agents", "skills", "mychrome");
    if (fs.existsSync(wsSkillDir)) targets.push(path.join(wsSkillDir, "SKILL.md"));
    for (const target of targets) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      backup(target);
      fs.copyFileSync(skillSrc, target);
      ok(`Skill updated: ${target}`);
    }
  } else {
    warn(`Skill source not found at ${skillSrc}. Skipped.`);
  }

  setSessionFlag(true);
  ok("Bridge marked as set up (.session.json)");

  process.stdout.write(
    [
      "",
      "Done. Next steps:",
      "  1. Quit Antigravity completely and open it again.",
      "  2. In Antigravity: Settings > Customizations, check that the hook \"mychrome-bridge\"",
      "     and the sidecar \"MyChrome waker\" are listed and on.",
      "  3. Open any conversation and type /mychrome once.",
      "  4. From now on, write only in the Chrome side panel. No polling, no idle tokens.",
      "",
      "Check status any time with:  npm run setup -- --check",
      "",
    ].join("\n")
  );
}

function uninstall(): void {
  const sidecarDir = path.join(CONFIG_DIR, "sidecars", SIDECAR_ID);
  if (fs.existsSync(sidecarDir)) {
    fs.rmSync(sidecarDir, { recursive: true, force: true });
    ok(`Removed ${sidecarDir}`);
  }
  const configFile = path.join(CONFIG_DIR, "config.json");
  if (fs.existsSync(configFile)) {
    const config = readJson(configFile);
    const sidecars = config.sidecars as Record<string, unknown> | undefined;
    if (sidecars && sidecars[SIDECAR_ID]) {
      delete sidecars[SIDECAR_ID];
      writeJson(configFile, config);
      ok(`Sidecar removed from ${configFile}`);
    }
  }
  const hooksFile = path.join(CONFIG_DIR, "hooks.json");
  if (fs.existsSync(hooksFile)) {
    const hooks = readJson(hooksFile);
    if (hooks[HOOK_NAME]) {
      delete hooks[HOOK_NAME];
      writeJson(hooksFile, hooks);
      ok(`Hook removed from ${hooksFile}`);
    }
  }
  setSessionFlag(false);
  ok("Uninstalled. Restart Antigravity. The skill files were left in place.");
}

function readToken(): string {
  try {
    return fs.readFileSync(path.join(BRIDGE_ROOT, ".token"), "utf-8").trim();
  } catch {
    return "";
  }
}

async function fetchStatus(port: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { "x-bridge-token": token },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function ago(ts: unknown): string {
  if (typeof ts !== "number" || !ts) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

async function check(): Promise<void> {
  const port = process.env.BRIDGE_PORT || "8765";
  const token = readToken();
  if (!token) warn("bridge/.token not found.");
  process.stdout.write(`\nMyChrome check (setup v${BRIDGE_VERSION})\n\n`);

  const sidecarFile = path.join(CONFIG_DIR, "sidecars", SIDECAR_ID, "sidecar.json");
  const hooksFile = path.join(CONFIG_DIR, "hooks.json");
  (fs.existsSync(sidecarFile) ? ok : warn)(`Sidecar file ${fs.existsSync(sidecarFile) ? "present" : "missing"}: ${sidecarFile}`);
  const hooks = fs.existsSync(hooksFile) ? readJson(hooksFile) : {};
  const entry = hooks[HOOK_NAME] as Record<string, unknown> | undefined;
  if (entry) {
    const stop = Array.isArray(entry.Stop) ? (entry.Stop[0] as Record<string, unknown>) : undefined;
    ok(`Stop hook present in ${hooksFile} (enabled: ${entry.enabled !== false}, timeout: ${stop?.timeout ?? "default"}s)`);
    if (stop?.command) process.stdout.write(`      command: ${String(stop.command)}\n`);
  } else {
    warn(`Stop hook missing in ${hooksFile}`);
  }
  const wsHooks = path.join(WORKSPACE_ROOT, ".agents", "hooks.json");
  if (fs.existsSync(wsHooks)) process.stdout.write(`  ..  A workspace hooks file also exists: ${wsHooks}\n`);

  const traceFile = path.join(BRIDGE_ROOT, "logs", "hook-trace.log");
  if (fs.existsSync(traceFile)) {
    const lines = fs.readFileSync(traceFile, "utf-8").trim().split("\n").filter(Boolean);
    const real = lines.filter((l) => !l.includes("conversation=self-test"));
    (real.length ? ok : warn)(
      real.length
        ? `Antigravity has run the Stop hook ${real.length} time(s). Last runs:`
        : "Only self-tests in the hook trace: Antigravity has not run the hook yet."
    );
    for (const l of lines.slice(-5)) process.stdout.write(`      ${l}\n`);
  } else {
    warn(`No hook trace yet (${traceFile}). Antigravity has never run the Stop hook script.`);
    process.stdout.write("      Check Settings > Customizations > Hooks, then fully restart Antigravity.\n");
  }

  const status = await fetchStatus(port, token);
  if (!status) {
    warn(`Bridge is not reachable on port ${port}. Open Antigravity so it starts the MCP server.`);
    return;
  }
  const bridgeVersion = String(status.version || "unknown (older than 4.0.0)");
  (bridgeVersion === BRIDGE_VERSION ? ok : warn)(
    `Bridge is running on port ${port}, version ${bridgeVersion}` +
      (bridgeVersion === BRIDGE_VERSION ? "" : `. Expected ${BRIDGE_VERSION}: fully restart Antigravity.`)
  );
  const ext = status.extensionVersion ? String(status.extensionVersion) : "";
  if (!status.extensionConnected) warn("Chrome extension is not connected right now.");
  else (ext === BRIDGE_VERSION ? ok : warn)(
    `Chrome extension connected, version ${ext || "unknown (older than 4.0.0)"}` +
      (ext === BRIDGE_VERSION ? "" : ". Reload it in chrome://extensions.")
  );
  (status.waker ? ok : warn)(`Waker sidecar ${status.waker ? "online" : "offline (enable it in Antigravity, then restart)"}`);
  (status.hooks ? ok : warn)(
    `Stop hook ${status.hooks ? `has reached the bridge (last ${ago(status.hooksSeenAt)})` : "has not reached the bridge from Antigravity yet"}`
  );
  if (status.hookSelfTestAt) ok(`Hook self-test reached the bridge ${ago(status.hookSelfTestAt)}`);
  (status.linked ? ok : warn)(`Conversation ${status.linked ? `linked (${status.linkedConversationId})` : "not linked yet (type /mychrome once)"}`);
  ok(`Wake mode now: ${String(status.mode)}${status.busy ? " (agent busy)" : ""}`);
}

/** Run the hook script by hand with a self-test payload: proves the script, node and the token work. */
async function testHook(): Promise<void> {
  const port = process.env.BRIDGE_PORT || "8765";
  const hook = path.join(BRIDGE_ROOT, "dist", "stop-hook.js");
  if (!fs.existsSync(hook)) throw new Error(`${hook} is missing. Run "npm run build" first.`);
  process.stdout.write(`\nRunning: node "${fwd(hook)}" with a self-test payload\n\n`);
  const t0 = Date.now();
  const out = await new Promise<string>((resolve) => {
    const child = spawn(process.execPath, [hook], { env: { ...process.env, BRIDGE_PORT: port }, windowsHide: true });
    let s = "";
    child.stdout.on("data", (d) => (s += d));
    child.on("close", () => resolve(s.trim()));
    child.on("error", (e) => resolve(`spawn error: ${e.message}`));
    child.stdin.end(JSON.stringify({ selfTest: true, conversationId: "self-test", terminationReason: "self_test" }));
  });
  process.stdout.write(`  ..  Hook printed: ${out || "(nothing)"} in ${Date.now() - t0}ms\n`);
  const status = await fetchStatus(port, readToken());
  if (!status) {
    warn("Bridge is not reachable, so the self-test could not reach it. Open Antigravity first.");
    return;
  }
  const at = typeof status.hookSelfTestAt === "number" ? status.hookSelfTestAt : 0;
  if (at && Date.now() - at < 15000) ok("The hook script reached the bridge. If Antigravity still never runs it, the hook is off in Antigravity.");
  else warn("The hook script ran but the bridge did not see it. Check bridge/.token and the port.");
}

(async () => {
  try {
    if (args.has("--uninstall")) uninstall();
    else if (args.has("--check")) await check();
    else if (args.has("--test-hook")) await testHook();
    else install();
  } catch (err) {
    process.stderr.write(`\nSetup failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
})();
