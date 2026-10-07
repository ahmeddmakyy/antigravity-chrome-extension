/**
 * daemon.ts: the long-lived MyChrome helper.
 *
 * Antigravity starts it as the "MyChrome helper" sidecar when the app opens, and keeps it running.
 * It owns port 8765 (the Chrome extension connects here, so the panel shows "connected" as soon as
 * Antigravity is open), the linked conversation, the message queue and the wake-up loop.
 * The MCP processes that Antigravity starts per conversation only forward tool calls here (/rpc).
 */
import path from "path";
import { fileURLToPath } from "url";
import { getOrCreatePairingToken } from "./token.js";
import { Logger } from "./logger.js";
import { BridgeWSServer } from "./ws-server.js";
import { BRIDGE_VERSION } from "./version.js";
import { getDataDir, getLogsDir } from "./paths.js";
import { runWaker, setWakerLogger } from "./waker.js";

const __filename = fileURLToPath(import.meta.url);
const BRIDGE_ROOT = path.resolve(path.dirname(__filename), "..");

async function main(): Promise<void> {
  const stateDir = process.env.MYCHROME_DATA_DIR || getDataDir();
  const logsDir = process.env.MYCHROME_LOGS_DIR || getLogsDir(BRIDGE_ROOT);
  const logger = new Logger(logsDir);
  const startedBy = process.env.MYCHROME_STARTED_BY || "sidecar";
  logger.info(`Starting MyChrome helper v${BRIDGE_VERSION} (started by ${startedBy}, node ${process.version}, ${process.platform}).`);

  const { token } = getOrCreatePairingToken(stateDir);
  const port = parseInt(process.env.BRIDGE_PORT || "8765", 10);
  const holdSeconds = parseInt(process.env.BRIDGE_HOLD_SECONDS || "1800", 10);
  const server = new BridgeWSServer(port, token, logger, {
    stateDir,
    holdSeconds: Number.isFinite(holdSeconds) ? holdSeconds : 1800,
  });
  await server.start();
  logger.info(`MyChrome helper is listening on 127.0.0.1:${port}.`);

  // The wake-up loop runs in this same process (it needs agentapi, which sidecars have).
  if (process.env.MYCHROME_NO_WAKER !== "1") {
    setWakerLogger((m) => logger.info(m));
    runWaker().catch((err) => logger.error(`[Waker] stopped: ${err instanceof Error ? err.message : String(err)}`));
  }

  const shutdown = (signal: string) => {
    logger.info(`MyChrome helper stopping (${signal}).`);
    server.stop().finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error starting the MyChrome helper:", err);
  process.exit(1);
});
