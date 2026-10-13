import { TEST_ROOT } from "./setup.js";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { BridgeWSServer } from "../dist/ws-server.js";
import { Logger } from "../dist/logger.js";
import path from "node:path";
import fs from "node:fs";

const TEST_PORT = 9983;
const TEST_TOKEN = "test_hold_token_1234567890abcdef1234567890";
const EXTENSION_ORIGIN = "chrome-extension://aeofpcedejopeeebdjfkapcabkkflhej";

describe("command_hold WebSocket Extension Protocol Tests", { concurrency: 1 }, () => {
  let server;
  let logger;
  let ws;
  const tempLogDir = path.join(TEST_ROOT, "hold-logs");

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.MYCHROME_ALLOWED_ORIGINS = EXTENSION_ORIGIN;
    if (!fs.existsSync(tempLogDir)) {
      fs.mkdirSync(tempLogDir, { recursive: true });
    }
    logger = new Logger(tempLogDir);
    server = new BridgeWSServer(TEST_PORT, TEST_TOKEN, logger);
    await server.start();

    // Connect authenticated fake extension
    ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const authPromise = new Promise((resolve) => {
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          ws.off("message", handler);
          resolve();
        }
      };
      ws.on("message", handler);
    });
    ws.send(JSON.stringify({ type: "auth", token: TEST_TOKEN }));
    await authPromise;
  });

  after(async () => {
    if (ws) {
      ws.close();
    }
    if (server) {
      await server.stop();
    }
    try {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    } catch {}
  });

  test("command_hold extends command timeout and resolves successfully after original timeout", async () => {
    let commandReceived = null;
    const msgHandler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "browser_command") {
        commandReceived = msg;
        // Extend timeout by 1500 ms
        ws.send(JSON.stringify({ type: "command_hold", correlationId: msg.correlationId, holdMs: 1500 }));
        // Answer after 800 ms (which is > original 500 ms timeout)
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              type: "browser_command_result",
              correlationId: msg.correlationId,
              result: { clicked: true },
            })
          );
        }, 800);
      }
    };

    ws.on("message", msgHandler);
    try {
      const res = await server.executeBrowserCommand("click", { tabId: 101 }, 500);
      assert.deepEqual(res, { clicked: true });
      assert.ok(commandReceived, "browser_command should have been received by fake extension");
    } finally {
      ws.off("message", msgHandler);
    }
  });

  test("control case without command_hold times out as expected", async () => {
    // Fake extension receives the command but does not send hold and does not reply
    await assert.rejects(
      server.executeBrowserCommand("click", { tabId: 101 }, 300),
      /timed out after 300ms/i
    );
  });

  test("unknown correlation ids and invalid holdMs values are ignored without crashing", async () => {
    // Unknown correlation id
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "nonexistent_corr_id", holdMs: 1500 }));

    // Non-finite or negative holdMs
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "test_corr_id", holdMs: -500 }));
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "test_corr_id", holdMs: NaN }));
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "test_corr_id", holdMs: Infinity }));
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "test_corr_id", holdMs: "1500" }));
    ws.send(JSON.stringify({ type: "command_hold", correlationId: "test_corr_id", holdMs: null }));

    // Verify server is alive and functioning with ping-pong
    const pongPromise = new Promise((resolve) => {
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          ws.off("message", handler);
          resolve();
        }
      };
      ws.on("message", handler);
    });
    ws.send(JSON.stringify({ type: "ping" }));
    await pongPromise;
  });
});
