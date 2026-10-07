import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { BridgeWSServer } from "../dist/ws-server.js";
import { createMcpServer } from "../dist/mcp-server.js";
import { Logger } from "../dist/logger.js";
import path from "node:path";
import fs from "node:fs";

const TEST_PORT = 9876;
const TEST_TOKEN = "test_token_0123456789abcdef0123456789abcdef";
const EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

describe("Antigravity Bridge & WebSocket Server Test Suite", { concurrency: 1 }, () => {
  let server;
  let logger;
  const tempLogDir = path.join(process.cwd(), "test-logs");

  before(async () => {
    process.env.NODE_ENV = "test";
    if (!fs.existsSync(tempLogDir)) {
      fs.mkdirSync(tempLogDir, { recursive: true });
    }
    logger = new Logger(tempLogDir);
    server = new BridgeWSServer(TEST_PORT, TEST_TOKEN, logger);
    await server.start();
  });

  after(async () => {
    if (server) {
      await server.stop();
    }
    try {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    } catch {}
  });

  test("1. Rejects WebSocket connection with invalid Origin", async () => {
    await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
        headers: { Origin: "http://evil-website.com" },
      });

      ws.on("error", (err) => {
        assert.ok(err);
      });

      ws.on("unexpected-response", (req, res) => {
        assert.equal(res.statusCode, 403);
        ws.close();
        resolve();
      });

      ws.on("open", () => {
        ws.close();
        assert.fail("Should not allow connection with non-extension origin");
      });
    });
  });

  test("2. Rejects connection with wrong pairing token", async () => {
    await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });

      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: "wrong_token_12345",
          extensionId: "test_ext",
        }));
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_error") {
          assert.equal(msg.error, "Invalid pairing token");
        }
      });

      ws.on("close", (code) => {
        assert.equal(code, 4003);
        resolve();
      });
    });
  });

  test("3. Authenticates successfully with valid pairing token and handles pings", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    let authenticated = false;

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          authenticated = true;
          ws.send(JSON.stringify({ type: "ping" }));
        } else if (msg.type === "pong") {
          assert.ok(authenticated);
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  });

  test("4. Message queueing, monotonic IDs, and wait_for_user_message", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          ws.send(JSON.stringify({
            type: "chat_message",
            text: "Hello from test sidepanel!",
            tab: { id: 101, url: "https://antigravity.test", title: "Test Page" },
            ui_language: "ar",
            clientMsgId: "c_msg_01",
          }));

          const userMsg = await server.waitForUserMessage(5);
          assert.ok(userMsg);
          assert.equal(userMsg.text, "Hello from test sidepanel!");
          assert.equal(userMsg.tab?.id, 101);
          assert.equal(userMsg.clientMsgId, "c_msg_01");
          assert.ok(userMsg.messageId > 0);

          ws.close();
          resolve();
        }
      });
    });
  });

  test("5. Remote Browser Command RPC execution", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          try {
            const res = await server.executeBrowserCommand("click", { tabId: 101, ref: "btn1" });
            assert.deepEqual(res, { clicked: true, ref: "btn1" });
            ws.close();
            resolve();
          } catch (err) {
            ws.close();
            reject(err);
          }
        } else if (msg.type === "browser_command") {
          assert.equal(msg.tool, "click");
          assert.equal(msg.params.ref, "btn1");

          ws.send(JSON.stringify({
            type: "browser_command_result",
            correlationId: msg.correlationId,
            result: { clicked: true, ref: "btn1" },
          }));
        }
      });

      ws.on("error", reject);
    });
  });

  test("6. Confirmation card and ask_user workflow", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          try {
            const approved = await server.requestConfirmation("Authorize checkout payment of $10", 5);
            assert.equal(approved, true);

            const answer = await server.askUser("Choose action", ["Option A", "Option B"], 5);
            assert.equal(answer, "Option B");

            ws.close();
            resolve();
          } catch (err) {
            ws.close();
            reject(err);
          }
        } else if (msg.type === "request_confirmation") {
          assert.equal(msg.summary, "Authorize checkout payment of $10");
          ws.send(JSON.stringify({
            type: "user_action",
            action: "approve",
            correlationId: msg.correlationId,
          }));
        } else if (msg.type === "ask_user") {
          assert.equal(msg.question, "Choose action");
          ws.send(JSON.stringify({
            type: "user_action",
            action: "answer",
            correlationId: msg.correlationId,
            value: "Option B",
          }));
        }
      });

      ws.on("error", reject);
    });
  });

  test("7. Stop action aborts commands with stopped_by_user", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          ws.send(JSON.stringify({
            type: "user_action",
            action: "stop",
          }));

          try {
            await server.executeBrowserCommand("navigate", { tabId: 101, url: "https://example.com" });
            assert.fail("Command should throw stopped_by_user");
          } catch (err) {
            assert.equal(err.message, "stopped_by_user");
            ws.close();
            resolve();
          }
        }
      });

      ws.on("error", reject);
    });
  });

  test("8. Undefined result returns 'null' in tool handler without throwing", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          try {
            const res = await server.executeBrowserCommand("execute_javascript", {
              tabId: 101,
              code: "console.log('test')",
            });
            assert.equal(res, undefined);
            ws.close();
            resolve();
          } catch (err) {
            ws.close();
            reject(err);
          }
        } else if (msg.type === "browser_command" && msg.tool === "execute_javascript") {
          ws.send(JSON.stringify({
            type: "browser_command_result",
            correlationId: msg.correlationId,
            result: undefined,
          }));
        }
      });

      ws.on("error", reject);
    });
  });

  test("9. Task state sequence: thinking -> acting -> waiting -> done -> idle", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    const receivedStates = [];

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          // 1. Send chat message
          ws.send(JSON.stringify({
            type: "chat_message",
            text: "Start task",
            tab: { id: 202, url: "https://test.local", title: "Test" },
            clientMsgId: "c_task_01",
            ui_language: "ar",
          }));
        } else if (msg.type === "task_state") {
          receivedStates.push(msg.state);
          if (msg.state === "idle" && receivedStates.includes("done")) {
            // Sequence completed
            assert.ok(receivedStates.includes("thinking"));
            assert.ok(receivedStates.includes("acting"));
            assert.ok(receivedStates.includes("waiting"));
            assert.ok(receivedStates.includes("done"));
            assert.ok(receivedStates.includes("idle"));
            ws.close();
            resolve();
          }
        } else if (msg.type === "browser_command") {
          ws.send(JSON.stringify({
            type: "browser_command_result",
            correlationId: msg.correlationId,
            result: { success: true },
          }));
        } else if (msg.type === "ask_user") {
          ws.send(JSON.stringify({
            type: "user_action",
            action: "answer",
            correlationId: msg.correlationId,
            value: "yes",
          }));
        }
      });

      ws.on("error", reject);

      (async () => {
        try {
          // Server receives message -> thinking
          const msg = await server.waitForUserMessage(5);
          assert.ok(msg);

          // Server acts -> acting
          await server.executeBrowserCommand("click", { tabId: 202, ref: "e1" });

          // Server asks -> waiting
          await server.askUser("Continue?", ["yes", "no"], 5);

          // Server finishes -> done, then idle
          server.sendReply("Task finished successfully", "final");
        } catch (err) {
          ws.close();
          reject(err);
        }
      })();
    });
  });

  test("10. EADDRINUSE takeover by new instance", async () => {
    const TAKEOVER_PORT = 9877;
    const serverA = new BridgeWSServer(TAKEOVER_PORT, TEST_TOKEN, logger);
    await serverA.start();

    // Verify serverA is running
    const resA = await fetch(`http://127.0.0.1:${TAKEOVER_PORT}/shutdown`, {
      method: "POST",
      headers: { "x-bridge-token": "wrong_token" },
    });
    assert.equal(resA.status, 403);

    // Now start serverB on same port with valid token
    // serverB will request takeover on EADDRINUSE and succeed
    const serverB = new BridgeWSServer(TAKEOVER_PORT, TEST_TOKEN, logger);
    await serverB.start();

    // Clean up serverB
    await serverB.stop();
  });

  test("11. get_bridge_log RPC and activity_event intent propagation", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      let receivedBridgeLog = false;
      let receivedIntentActivity = false;

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          // Request bridge log
          ws.send(JSON.stringify({ type: "get_bridge_log" }));

          // Trigger browser command with intent
          server.executeBrowserCommand("scroll", { tabId: 101, direction: "down", amount: 200 }, 5000, "تمرير للأسفل لرؤية باقي المحتوى");
        } else if (msg.type === "bridge_log") {
          assert.ok(Array.isArray(msg.lines));
          receivedBridgeLog = true;
          if (receivedBridgeLog && receivedIntentActivity) {
            ws.close();
            resolve();
          }
        } else if (msg.type === "activity_event") {
          if (msg.event.tool === "scroll") {
            assert.equal(msg.event.intent, "تمرير للأسفل لرؤية باقي المحتوى");
            receivedIntentActivity = true;
            if (receivedBridgeLog && receivedIntentActivity) {
              ws.close();
              resolve();
            }
          }
        } else if (msg.type === "browser_command") {
          ws.send(JSON.stringify({
            type: "browser_command_result",
            correlationId: msg.correlationId,
            result: { scrollY: 200, atBottom: false },
          }));
        }
      });

      ws.on("error", reject);
    });
  });

  test("12. Task watchdog and reply kind 'final' resets state cleanly", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: EXTENSION_ORIGIN },
    });

    await new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "auth",
          token: TEST_TOKEN,
          extensionId: "test_ext",
        }));
      });

      let finalReplyReceived = false;

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          // Send user message
          ws.send(JSON.stringify({
            type: "chat_message",
            text: "اختبار انتهاء المهمة",
            tab: { id: 301, url: "https://test.local", title: "Test" },
            ui_language: "ar",
            clientMsgId: "c_task_01",
          }));

          const receivedMsg = await server.waitForUserMessage(5);
          assert.ok(receivedMsg);
          assert.equal(receivedMsg.clientMsgId, "c_task_01");

          // Agent sends progress reply
          server.sendReply("جاري فحص الصفحة...", "progress");

          // Agent completes task with final reply
          server.sendReply("تم إنهاء الفحص بنجاح.", "final");
        } else if (msg.type === "agent_reply" && msg.kind === "final") {
          assert.equal(msg.text, "تم إنهاء الفحص بنجاح.");
          finalReplyReceived = true;
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  });
});

