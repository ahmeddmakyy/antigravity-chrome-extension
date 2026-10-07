// v5.2: the long-lived helper owns port 8765; MCP processes call it over /rpc.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeWSServer, toWire, fromWire } from "../dist/ws-server.js";
import { RemoteBridge, pingHelper } from "../dist/remote-bridge.js";
import { resolveAgentApi } from "../dist/waker.js";
import { Logger } from "../dist/logger.js";
import { EXTENSION_ORIGIN } from "../dist/constants.js";

process.env.NODE_ENV = "test";
const TOKEN = "helper_test_token_0123456789abcdef0123";
let portSeq = 9970;

async function makeServer(opts = {}) {
  const port = portSeq++;
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "mychrome-helper-"));
  fs.writeFileSync(path.join(stateDir, ".token"), TOKEN);
  const server = new BridgeWSServer(port, TOKEN, new Logger(path.join(stateDir, "logs")), { stateDir, holdSeconds: 0, ...opts });
  await server.start();
  return { server, port, stateDir };
}

function fakeExtension(port, results = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: EXTENSION_ORIGIN } });
    ws.on("open", () => ws.send(JSON.stringify({ type: "auth", extensionVersion: "test" })));
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "auth_ok") resolve(ws);
      if (m.type === "browser_command") ws.send(JSON.stringify({ type: "browser_command_result", correlationId: m.correlationId, result: results[m.tool] ?? { ok: true } }));
    });
    ws.on("error", reject);
  });
}

describe("v5.2 helper and RPC", { concurrency: 1 }, () => {
  test("toWire/fromWire keep Maps", () => {
    const back = fromWire(toWire({ a: 1, m: new Map([[3, "x"]]) }));
    assert.equal(back.a, 1);
    assert.ok(back.m instanceof Map);
    assert.equal(back.m.get(3), "x");
  });

  test("ping, /connected and the /connect page need no token", async () => {
    const { server, port } = await makeServer();
    assert.equal(await pingHelper(port), true);
    let j = await (await fetch(`http://127.0.0.1:${port}/connected`)).json();
    assert.equal(j.connected, false);
    const html = await (await fetch(`http://127.0.0.1:${port}/connect`)).text();
    assert.match(html, /mychrome_wake/);
    const ext = await fakeExtension(port);
    j = await (await fetch(`http://127.0.0.1:${port}/connected`)).json();
    assert.equal(j.connected, true);
    ext.close();
    await server.stop();
  });

  test("RemoteBridge forwards tool calls, and /rpc rejects bad tokens and unknown methods", async () => {
    const { server, port, stateDir } = await makeServer();
    const ext = await fakeExtension(port, { click: { clicked: { x: 1, y: 2 }, target: "Save" } });
    const remote = new RemoteBridge(port, stateDir);
    const r = await remote.executeBrowserCommand("click", { tabId: 1, ref: "e1" }, 5000, "Clicking save");
    assert.equal(r.target, "Save");
    const status = await remote.getAgentStatus();
    assert.equal(typeof status.busy, "boolean");
    const read = await remote.readPanelMessages();
    assert.ok(read.screenshots instanceof Map);
    const bad = await fetch(`http://127.0.0.1:${port}/rpc`, { method: "POST", headers: { "x-bridge-token": "nope", "Content-Type": "application/json" }, body: JSON.stringify({ method: "getAgentStatus", args: [] }) });
    assert.equal(bad.status, 403);
    const unknown = await fetch(`http://127.0.0.1:${port}/rpc`, { method: "POST", headers: { "x-bridge-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ method: "stop", args: [] }) });
    assert.equal(unknown.status, 400);
    ext.close();
    await server.stop();
  });

  test("ensureExtension opens Chrome at the connect page and waits for the extension", async () => {
    let opened = null;
    let extWs = null;
    const { server, port } = await makeServer({
      chromeLauncher: (url) => {
        opened = url;
        setTimeout(async () => (extWs = await fakeExtension(port)), 150);
        return true;
      },
    });
    const r = await server.ensureExtension(5000);
    assert.equal(opened, `http://127.0.0.1:${port}/connect`);
    assert.deepEqual(r, { connected: true, launched: true });
    const again = await server.ensureExtension(5000);
    assert.deepEqual(again, { connected: true, launched: false });
    extWs.close();
    await server.stop();
  });

  test("a browser tool waits for Chrome instead of failing at once", async () => {
    let extWs = null;
    const { server, port } = await makeServer({
      chromeLauncher: () => {
        setTimeout(async () => (extWs = await fakeExtension(port, { tabs_list: [{ id: 5 }] })), 150);
        return true;
      },
    });
    const res = await server.executeBrowserCommand("tabs_list", {}, 5000);
    assert.deepEqual(res, [{ id: 5 }]);
    extWs.close();
    await server.stop();
  });

  test("the waker finds agentapi in ~/.gemini/antigravity/bin even when it is not on PATH", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
    const bin = path.join(home, ".gemini", "antigravity", "bin");
    fs.mkdirSync(bin, { recursive: true });
    const name = process.platform === "win32" ? "agentapi.bat" : "agentapi";
    fs.writeFileSync(path.join(bin, name), "echo", { mode: 0o755 });
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, PATH: process.env.PATH, AGENTAPI_BIN: process.env.AGENTAPI_BIN };
    try {
      process.env.HOME = home;
      process.env.USERPROFILE = home;
      process.env.PATH = os.tmpdir();
      delete process.env.AGENTAPI_BIN;
      const api = resolveAgentApi();
      assert.ok(api, "agentapi should be found");
      assert.equal(api.bin, path.join(bin, name));
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
