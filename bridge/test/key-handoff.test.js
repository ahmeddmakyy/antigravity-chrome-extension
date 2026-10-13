import { TEST_ROOT, writeTestToken } from "./setup.js";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import WebSocket from "ws";
import path from "node:path";
import fs from "node:fs";
import { BridgeWSServer } from "../dist/ws-server.js";
import { writeExtensionKey } from "../dist/token.js";
import { Logger } from "../dist/logger.js";
import { EXTENSION_ORIGIN } from "../dist/constants.js";

let portSeq = 9990;

async function createServer(opts = {}) {
  const port = portSeq++;
  const token = `test_token_handoff_${port}_0123456789abcdef`;
  const stateDir = path.join(TEST_ROOT, `handoff-${port}`);
  fs.mkdirSync(stateDir, { recursive: true });
  writeTestToken(token);
  const logger = new Logger(path.join(stateDir, "logs"));
  const server = new BridgeWSServer(port, token, logger, { stateDir, holdSeconds: 0, ...opts });
  await server.start();
  return { server, port, token };
}

function httpPost(port, pathName, headers = {}, body = "") {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? body : JSON.stringify(body);
    const reqHeaders = {
      Host: `127.0.0.1:${port}`,
      ...headers,
    };
    if (data && !reqHeaders["Content-Length"] && !reqHeaders["content-length"]) {
      reqHeaders["Content-Length"] = Buffer.byteLength(data);
    }
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathName,
        method: "POST",
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, raw, json });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

describe("Automatic key hand-off and token authentication tests", { concurrency: 1 }, () => {
  test("(a) writeExtensionKey writes valid JSON with the token and the file is replaced atomically", () => {
    const extDir = path.join(TEST_ROOT, "ext-test-a");
    fs.mkdirSync(extDir, { recursive: true });
    const token = "secret_handoff_token_alpha_1234567890";

    const res = writeExtensionKey(extDir, token);
    assert.equal(res.ok, true);
    assert.equal(res.path, path.join(extDir, "pairing.json"));
    assert.equal(fs.existsSync(res.path), true);

    const raw = fs.readFileSync(res.path, "utf-8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.token, token);

    // No leftover temporary files
    const entries = fs.readdirSync(extDir);
    assert.deepEqual(entries, ["pairing.json"]);

    // Atomic replacement with a new token
    const token2 = "secret_handoff_token_beta_0987654321";
    const res2 = writeExtensionKey(extDir, token2);
    assert.equal(res2.ok, true);
    const parsed2 = JSON.parse(fs.readFileSync(res2.path, "utf-8"));
    assert.equal(parsed2.token, token2);
  });

  test("(b) it is idempotent and leaves the file alone when the token is unchanged", async () => {
    const extDir = path.join(TEST_ROOT, "ext-test-b");
    fs.mkdirSync(extDir, { recursive: true });
    const token = "idempotent_token_test_1234567890";

    const res1 = writeExtensionKey(extDir, token);
    assert.equal(res1.ok, true);
    const stat1 = fs.statSync(res1.path);

    // Brief delay to ensure mtime would differ if file were rewritten
    await new Promise((r) => setTimeout(r, 25));

    const res2 = writeExtensionKey(extDir, token);
    assert.equal(res2.ok, true);
    const stat2 = fs.statSync(res2.path);

    assert.equal(stat1.mtimeMs, stat2.mtimeMs);
    assert.equal(stat1.size, stat2.size);
  });

  test("(c) it returns ok false for a missing folder and for a path that is a file, and does not create the folder", () => {
    const missingDir = path.join(TEST_ROOT, "missing-ext-folder");
    assert.equal(fs.existsSync(missingDir), false);

    const res1 = writeExtensionKey(missingDir, "sample_token_c1");
    assert.equal(res1.ok, false);
    assert.ok(res1.error);
    assert.equal(fs.existsSync(missingDir), false);

    // Target is a file, not a directory
    const filePath = path.join(TEST_ROOT, "file-not-dir.txt");
    fs.writeFileSync(filePath, "regular-file-content", "utf-8");

    const res2 = writeExtensionKey(filePath, "sample_token_c2");
    assert.equal(res2.ok, false);
    assert.ok(res2.error);
    assert.equal(fs.readFileSync(filePath, "utf-8"), "regular-file-content");
  });

  test("(d) it never throws on a read-only or invalid target (simulate with an invalid path)", () => {
    const invalidPath = path.join(TEST_ROOT, "invalid\0path");

    assert.doesNotThrow(() => {
      const res = writeExtensionKey(invalidPath, "sample_token_d");
      assert.equal(res.ok, false);
      assert.ok(res.error);
    });

    assert.doesNotThrow(() => {
      const res = writeExtensionKey("", "sample_token_d2");
      assert.equal(res.ok, false);
      assert.ok(res.error);
    });
  });

  test("(e) a WebSocket client with the right token authenticates, a client with a wrong token and a forged extension Origin is rejected, a client with no token is rejected", async () => {
    const { server, port, token } = await createServer();
    try {
      // 1. Correct token authenticates
      const wsGood = new WebSocket(`ws://127.0.0.1:${port}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });
      await new Promise((resolve, reject) => {
        wsGood.on("open", resolve);
        wsGood.on("error", reject);
      });
      wsGood.send(JSON.stringify({
        type: "auth",
        token,
        extensionId: "test_ext",
        extensionVersion: "5.2.0",
      }));
      const okMsg = await new Promise((resolve, reject) => {
        wsGood.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_ok") resolve(msg);
          else if (msg.type === "auth_error") reject(new Error("Unexpected auth_error"));
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_ok")), 2000);
      });
      assert.equal(okMsg.type, "auth_ok");
      wsGood.close();

      // 2. Wrong token with forged extension Origin is rejected
      const wsWrong = new WebSocket(`ws://127.0.0.1:${port}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });
      await new Promise((resolve, reject) => {
        wsWrong.on("open", resolve);
        wsWrong.on("error", reject);
      });
      wsWrong.send(JSON.stringify({
        type: "auth",
        token: "wrong_attacker_token",
        extensionId: "test_ext",
        extensionVersion: "5.2.0",
      }));
      const errWrong = await new Promise((resolve, reject) => {
        wsWrong.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_error") resolve(msg);
          else if (msg.type === "auth_ok") reject(new Error("Should not authenticate"));
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_error")), 2000);
      });
      assert.equal(errWrong.type, "auth_error");
      assert.equal(errWrong.code, "invalid_token");
      wsWrong.close();

      // 3. No token is rejected
      const wsNoToken = new WebSocket(`ws://127.0.0.1:${port}`, {
        headers: { Origin: EXTENSION_ORIGIN },
      });
      await new Promise((resolve, reject) => {
        wsNoToken.on("open", resolve);
        wsNoToken.on("error", reject);
      });
      wsNoToken.send(JSON.stringify({
        type: "auth",
        extensionId: "test_ext",
        extensionVersion: "5.2.0",
      }));
      const errNoToken = await new Promise((resolve, reject) => {
        wsNoToken.on("message", (raw) => {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (msg.type === "auth_error") resolve(msg);
          else if (msg.type === "auth_ok") reject(new Error("Should not authenticate"));
        });
        setTimeout(() => reject(new Error("Timeout waiting for auth_error")), 2000);
      });
      assert.equal(errNoToken.type, "auth_error");
      assert.equal(errNoToken.code, "invalid_token");
      wsNoToken.close();
    } finally {
      await server.stop();
    }
  });

  test("(f) POST /pair and POST /pairing/new return 404 (use an authenticated and an unauthenticated request)", async () => {
    const { server, port, token } = await createServer();
    try {
      // POST /pair unauthenticated
      const r1 = await httpPost(port, "/pair", {}, { code: "123456" });
      assert.equal(r1.status, 404);

      // POST /pair authenticated with token header
      const r2 = await httpPost(port, "/pair", { "x-bridge-token": token }, { code: "123456" });
      assert.equal(r2.status, 404);

      // POST /pairing/new unauthenticated
      const r3 = await httpPost(port, "/pairing/new", {});
      assert.equal(r3.status, 404);

      // POST /pairing/new authenticated with token header
      const r4 = await httpPost(port, "/pairing/new", { "x-bridge-token": token });
      assert.equal(r4.status, 404);
    } finally {
      await server.stop();
    }
  });

  test("(g) a request with a non-loopback Host header still gets 421", async () => {
    const { server, port } = await createServer();
    try {
      // HTTP request with non-loopback host
      const res = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: "/status",
            method: "GET",
            headers: { Host: "evil.example" },
          },
          (r) => resolve(r.statusCode)
        );
        req.on("error", reject);
        req.end();
      });
      assert.equal(res, 421);

      // WebSocket upgrade with non-loopback host
      const wsResult = await new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
          headers: { Host: "evil.example", Origin: EXTENSION_ORIGIN },
        });
        ws.on("unexpected-response", (_req, r) => {
          resolve(r.statusCode);
        });
        ws.on("open", () => {
          ws.close();
          resolve(200);
        });
        ws.on("error", () => {
          resolve(421);
        });
      });
      assert.equal(wsResult, 421);
    } finally {
      await server.stop();
    }
  });
});
