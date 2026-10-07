/**
 * index.ts: the MCP server Antigravity starts for each conversation (registered by the plugin).
 *
 * It does not own port 8765. It makes sure the long-lived MyChrome helper (daemon.ts) is running,
 * then forwards every tool call to it. Set MYCHROME_INPROCESS=1 to run the old all-in-one mode.
 */
import path from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getOrCreatePairingToken } from "./token.js";
import { Logger } from "./logger.js";
import { BridgeWSServer } from "./ws-server.js";
import { createMcpServer } from "./mcp-server.js";
import { BRIDGE_VERSION } from "./version.js";
import { getDataDir, getLogsDir } from "./paths.js";
import { RemoteBridge, ensureHelper } from "./remote-bridge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");

async function main() {
  const stateDir = process.env.MYCHROME_DATA_DIR || getDataDir();
  const logsDir = process.env.MYCHROME_LOGS_DIR || getLogsDir(BRIDGE_ROOT);
  const logger = new Logger(logsDir);
  const port = parseInt(process.env.BRIDGE_PORT || "8765", 10);
  getOrCreatePairingToken(stateDir);

  let bridge: BridgeWSServer;
  if (process.env.MYCHROME_INPROCESS === "1") {
    logger.info(`[MCP] v${BRIDGE_VERSION} in-process mode.`);
    const { token } = getOrCreatePairingToken(stateDir);
    const server = new BridgeWSServer(port, token, logger, { stateDir });
    await server.start();
    bridge = server;
  } else {
    const ok = await ensureHelper(port, __dirname, logger);
    logger.info(`[MCP] v${BRIDGE_VERSION} started for a conversation. Helper ${ok ? "is running" : "is NOT reachable"} on port ${port}.`);
    // Same method names as BridgeWSServer; every call is forwarded to the helper and awaited.
    bridge = new RemoteBridge(port, stateDir) as unknown as BridgeWSServer;
  }

  const mcpServer = createMcpServer(bridge, logger);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  const exit = (why: string) => {
    logger.info(`[MCP] ${why}. Exiting (the helper keeps running).`);
    process.exit(0);
  };
  process.stdin.on("end", () => exit("stdin ended"));
  process.stdin.on("close", () => exit("stdin closed"));
  transport.onclose = () => exit("transport closed");
}

main().catch((err) => {
  console.error("Fatal error starting MyChrome MCP server:", err);
  process.exit(1);
});
