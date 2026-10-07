/**
 * remote-bridge.ts
 *
 * Antigravity starts one MCP process per conversation (and stops it when the conversation is idle),
 * so the MCP process must not own port 8765. The long-lived MyChrome helper (daemon.ts, started by
 * the Antigravity sidecar) owns the port, the Chrome connection, the linked conversation and the
 * wake-up queue. Each MCP process is a thin client that forwards tool calls to it over POST /rpc.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fromWire } from "./ws-server.js";
import { getTokenPath } from "./paths.js";
import { Logger } from "./logger.js";

function readToken(fallbackDir: string): string {
  try {
    return fs.readFileSync(getTokenPath(fallbackDir), "utf-8").trim();
  } catch {
    return "";
  }
}

export function pingHelper(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/ping", timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(res.statusCode === 200 && body.trim() === "mychrome"));
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

/**
 * Start the helper ourselves if the sidecar is not running it (for example right after install,
 * before Antigravity was restarted). The child is detached so it outlives this MCP process.
 */
export async function ensureHelper(port: number, distDir: string, logger: Logger): Promise<boolean> {
  if (await pingHelper(port)) return true;
  const daemon = path.join(distDir, "daemon.js");
  if (!fs.existsSync(daemon)) {
    logger.error(`[MCP] Helper not running and ${daemon} is missing.`);
    return false;
  }
  logger.info("[MCP] Helper not running. Starting it in the background.");
  try {
    const child = spawn(process.execPath, [daemon], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, MYCHROME_STARTED_BY: "mcp" },
    });
    child.unref();
  } catch (err) {
    logger.error(`[MCP] Could not start the helper: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await pingHelper(port)) return true;
  }
  return false;
}

export class RemoteBridge {
  constructor(private port: number, private tokenDir: string) {}

  private call<T>(method: string, args: unknown[]): Promise<T> {
    const body = JSON.stringify({ method, args });
    const token = readToken(this.tokenDir);
    return new Promise<T>((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port: this.port,
          path: "/rpc",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "x-bridge-token": token },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (d) => chunks.push(d as Buffer));
          res.on("end", () => {
            let parsed: { ok?: boolean; result?: unknown; error?: string } = {};
            try {
              parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            } catch {
              reject(new Error(`MyChrome helper returned an invalid answer (HTTP ${res.statusCode}).`));
              return;
            }
            if (res.statusCode === 403) reject(new Error("MyChrome helper rejected the token. Re-run the installer."));
            else if (parsed.ok) resolve(fromWire(parsed.result) as T);
            else reject(new Error(parsed.error || `MyChrome helper error (HTTP ${res.statusCode}).`));
          });
        }
      );
      req.on("error", (err) =>
        reject(new Error(`MyChrome helper is not reachable (${err.message}). Antigravity starts it with the "MyChrome helper" sidecar.`))
      );
      req.end(body);
    });
  }

  askUser(...a: unknown[]) { return this.call("askUser", a); }
  canEndTurnSafely(...a: unknown[]) { return this.call("canEndTurnSafely", a); }
  connectPanel(...a: unknown[]) { return this.call("connectPanel", a); }
  executeBrowserCommand(...a: unknown[]) { return this.call("executeBrowserCommand", a); }
  formatMessagesForAgent(...a: unknown[]) { return this.call("formatMessagesForAgent", a); }
  readPanelMessages(...a: unknown[]) { return this.call("readPanelMessages", a); }
  requestConfirmation(...a: unknown[]) { return this.call("requestConfirmation", a); }
  sendReply(...a: unknown[]) { return this.call("sendReply", a); }
  takeInterrupts(...a: unknown[]) { return this.call("takeInterrupts", a); }
  updatePlan(...a: unknown[]) { return this.call("updatePlan", a); }
  waitForUserMessage(...a: unknown[]) { return this.call("waitForUserMessage", a); }
  ensureExtension(...a: unknown[]) { return this.call("ensureExtension", a); }
  getAgentStatus(...a: unknown[]) { return this.call("getAgentStatus", a); }
}
