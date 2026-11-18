import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BridgeWSServer } from "./ws-server.js";
import { Logger } from "./logger.js";
export declare function createMcpServer(wsServer: BridgeWSServer, logger: Logger): McpServer;
