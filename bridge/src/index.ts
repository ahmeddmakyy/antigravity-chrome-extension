import path from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getOrCreatePairingToken } from "./token.js";
import { Logger } from "./logger.js";
import { BridgeWSServer } from "./ws-server.js";
import { createMcpServer } from "./mcp-server.js";
import { BRIDGE_VERSION } from "./version.js";
import { getDataDir, getLogsDir } from "./paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");

async function main() {
  const stateDir = process.env.MYCHROME_DATA_DIR || getDataDir();
  const logsDir = process.env.MYCHROME_LOGS_DIR || getLogsDir(BRIDGE_ROOT);

  const logger = new Logger(logsDir);
  logger.info(`Initializing MyChrome MCP Bridge v${BRIDGE_VERSION} (node ${process.version}, ${process.platform})...`);

  // 1. Get or generate pairing token in persistent data directory
  const { token, isNew } = getOrCreatePairingToken(stateDir);
  if (isNew) {
    logger.info(`Generated new pairing token in ${stateDir}`);
    process.stderr.write(`\n======================================================\n`);
    process.stderr.write(` [MyChrome] Pairing Token Generated:\n`);
    process.stderr.write(` ${token}\n`);
    process.stderr.write(` (Automatic pairing is enabled for MyChrome extension)\n`);
    process.stderr.write(`======================================================\n\n`);
  } else {
    logger.info(`Using existing pairing token from ${stateDir}.`);
  }

  // 2. Start WebSocket Server on 127.0.0.1:8765
  const port = parseInt(process.env.BRIDGE_PORT || "8765", 10);
  const holdSeconds = parseInt(process.env.BRIDGE_HOLD_SECONDS || "1800", 10);
  const wsServer = new BridgeWSServer(port, token, logger, {
    stateDir: stateDir,
    holdSeconds: Number.isFinite(holdSeconds) ? holdSeconds : 1800,
  });
  await wsServer.start();

  // 3. Connect MCP stdio transport
  const mcpServer = createMcpServer(wsServer, logger);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  logger.info("MyChrome MCP Server connected to stdio transport successfully.");

  // Exit when MCP stdio transport closes
  process.stdin.on("end", () => {
    logger.info("[MCP] stdin ended. Exiting...");
    process.exit(0);
  });
  process.stdin.on("close", () => {
    logger.info("[MCP] stdin closed. Exiting...");
    process.exit(0);
  });
  if (transport.onclose !== undefined) {
    transport.onclose = () => {
      logger.info("[MCP] Transport closed. Exiting...");
      process.exit(0);
    };
  }
}

main().catch((err) => {
  console.error("Fatal error starting MyChrome bridge:", err);
  process.exit(1);
});
