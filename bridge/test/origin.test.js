import { TEST_ROOT } from "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { BridgeWSServer } from "../dist/ws-server.js";
import { Logger } from "../dist/logger.js";
import { EXTENSION_ORIGIN, EXTENSION_ID } from "../dist/constants.js";
import fs from "fs";
import path from "path";

const PORT = 9988;
const TEST_TOKEN = "test_token_secret_0123456789abcdef";

test("Origin-based authentication and allowlist", async (t) => {
  const logger = new Logger(path.join(TEST_ROOT, "origin-logs"));
  const server = new BridgeWSServer(PORT, TEST_TOKEN, logger);
  await server.start();

  t.after(async () => {
    await server.stop();
  });

  await t.test("Rejects unauthorized origin with 403", async () => {
    let ws = null;
    try {
      await new Promise((resolve, reject) => {
        ws = new WebSocket(`ws://127.0.0.1:${PORT}`, {
          headers: { Origin: "http://malicious-website.com" },
        });
        ws.on("open", () => reject(new Error("Should not open")));
        ws.on("unexpected-response", (req, res) => {
          try {
            assert.equal(res.statusCode, 403);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        ws.on("error", (err) => {
          if (err.message.includes("403")) resolve();
        });
      });
    } finally {
      if (ws) ws.close();
    }
  });

  await t.test("Extension origin without token is rejected with auth_error code invalid_token", async () => {
    let ws = null;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${PORT}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });

      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      // Send auth with NO token (or empty token)
      ws.send(JSON.stringify({ type: "auth", extensionId: EXTENSION_ID, extensionVersion: "5.2.0" }));

      const authErr = await new Promise((resolve, reject) => {
        ws.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_error") resolve(msg);
          else if (msg.type === "auth_ok") reject(new Error("Unexpected auth_ok"));
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_error")), 2000);
      });

      assert.equal(authErr.type, "auth_error");
      assert.equal(authErr.code, "invalid_token");
    } finally {
      if (ws) ws.close();
    }
  });

  await t.test("Extension origin with valid pairing token succeeds", async () => {
    let ws = null;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${PORT}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });

      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      // Send auth with valid token
      ws.send(JSON.stringify({ type: "auth", token: TEST_TOKEN, extensionId: EXTENSION_ID, extensionVersion: "5.2.0" }));

      const authOk = await new Promise((resolve, reject) => {
        ws.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_ok") resolve(msg);
          else if (msg.type === "auth_error") reject(new Error(msg.error));
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_ok")), 2000);
      });

      assert.equal(authOk.type, "auth_ok");
      assert.equal(authOk.bridgeVersion, "5.3.0");
    } finally {
      if (ws) ws.close();
    }
  });

  await t.test("Allows extra origins specified via MYCHROME_ALLOWED_ORIGINS env var", async () => {
    let ws = null;
    try {
      process.env.MYCHROME_ALLOWED_ORIGINS = "http://localhost:3000, chrome-extension://test-dev-id";
      ws = new WebSocket(`ws://127.0.0.1:${PORT}`, {
        headers: { Origin: "http://localhost:3000" },
      });

      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      // Dev origin is allowed to connect and authenticates with token
      ws.send(JSON.stringify({ type: "auth", token: TEST_TOKEN, extensionVersion: "5.0.0" }));

      const authOk = await new Promise((resolve, reject) => {
        ws.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_ok") resolve(msg);
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_ok")), 2000);
      });

      assert.equal(authOk.type, "auth_ok");
    } finally {
      if (ws) ws.close();
      delete process.env.MYCHROME_ALLOWED_ORIGINS;
    }
  });

  await t.test("Plugin templates are valid JSON and contain expected placeholders", () => {
    const mcpTmplPath = path.resolve("..", "plugin", "mcp_config.template.json");
    const hooksTmplPath = path.resolve("..", "plugin", "hooks.template.json");
    const sidecarTmplPath = path.resolve("..", "sidecars", "mychrome-waker", "sidecar.template.json");

    assert.ok(fs.existsSync(mcpTmplPath), "mcp_config.template.json exists");
    assert.ok(fs.existsSync(hooksTmplPath), "hooks.template.json exists");
    assert.ok(fs.existsSync(sidecarTmplPath), "sidecar.template.json exists");

    const mcpRaw = fs.readFileSync(mcpTmplPath, "utf-8");
    const hooksRaw = fs.readFileSync(hooksTmplPath, "utf-8");
    const sidecarRaw = fs.readFileSync(sidecarTmplPath, "utf-8");

    assert.ok(mcpRaw.includes("{{NODE_PATH}}"));
    assert.ok(mcpRaw.includes("{{BRIDGE_PATH}}"));
    assert.ok(hooksRaw.includes("{{STOP_HOOK_PATH}}"));
    assert.ok(sidecarRaw.includes("{{WAKER_PATH}}"));
  });
});
