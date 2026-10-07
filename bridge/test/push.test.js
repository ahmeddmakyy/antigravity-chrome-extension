import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { BridgeWSServer } from "../dist/ws-server.js";
import { createMcpServer } from "../dist/mcp-server.js";
import { Logger } from "../dist/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const CID = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";

// The hook and waker scripts read bridge/.token, so these tests use the same token.
const TOKEN = (() => {
  const f = path.join(BRIDGE_ROOT, ".token");
  if (!fs.existsSync(f)) fs.writeFileSync(f, "test_token_push_0123456789abcdef0123456789");
  return fs.readFileSync(f, "utf-8").trim();
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let portSeq = 9900;

async function makeServer(opts = {}) {
  const port = portSeq++;
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "mychrome-state-"));
  const logger = new Logger(path.join(stateDir, "logs"));
  const server = new BridgeWSServer(port, TOKEN, logger, { stateDir, holdSeconds: 0, ...opts });
  await server.start();
  return { server, port, stateDir };
}

/** A fake Chrome extension: connects, authenticates, records every server message. */
async function connectExtension(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: ORIGIN } });
  const inbox = [];
  await new Promise((resolve, reject) => {
    ws.on("open", () => ws.send(JSON.stringify({ type: "auth", token: TOKEN })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      inbox.push(msg);
      if (msg.type === "auth_ok") resolve();
    });
    ws.on("error", reject);
  });
  const waitFor = async (pred, ms = 3000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await sleep(20);
    }
    throw new Error("Timed out waiting for a server message");
  };
  const send = (text, extra = {}) =>
    ws.send(
      JSON.stringify({
        type: "chat_message",
        text,
        clientMsgId: `c_${Math.random().toString(36).slice(2)}`,
        tab: { id: 42, url: "https://example.com", title: "Example" },
        ui_language: "ar",
        ...extra,
      })
    );
  return { ws, inbox, waitFor, send };
}

async function post(port, route, body, token = TOKEN) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-token": token },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

describe("Push wake-up (no polling)", { concurrency: 1 }, () => {
  before(() => {
    process.env.NODE_ENV = "test";
  });

  test("control endpoints reject a missing token", async () => {
    const { server, port } = await makeServer();
    const r = await post(port, "/hook/stop", { conversationId: CID }, "nope");
    assert.equal(r.status, 403);
    assert.equal(r.json.decision, "stop");
    await server.stop();
  });

  test("Stop hook from an unrelated conversation answers stop at once", async () => {
    const { server, port } = await makeServer();
    const t0 = Date.now();
    const r = await post(port, "/hook/stop", { conversationId: OTHER, terminationReason: "model_stop" });
    assert.equal(r.json.decision, "stop");
    assert.ok(Date.now() - t0 < 500);
    await server.stop();
  });

  test("connect_side_panel + next Stop hook links the conversation and persists it", async () => {
    const { server, port, stateDir } = await makeServer();
    const ext = await connectExtension(port);
    const r = server.connectPanel();
    assert.equal(r.linked, false);
    assert.equal(r.linkPending, true);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const st = await ext.waitFor((m) => m.type === "agent_status" && m.status.linked);
    assert.equal(st.status.hooks, true);
    const saved = JSON.parse(fs.readFileSync(path.join(stateDir, ".session.json"), "utf-8"));
    assert.equal(saved.linkedConversationId, CID);
    ext.ws.close();
    await server.stop();
  });

  test("a panel message is pushed through the waker and acked on success", async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const ext = await connectExtension(port);

    // Fake waker long-poll
    const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    ext.send("حلل الصفحة دي");
    const job = await (await pending).json();
    assert.equal(job.action, "send-message");
    assert.equal(job.conversationId, CID);
    assert.match(job.prompt, /حلل الصفحة دي/);
    assert.match(job.prompt, /Tab: id 42/);
    assert.doesNotMatch(job.safePrompt, /حلل/);

    await post(port, "/waker/result", { jobId: job.jobId, ok: true });
    await ext.waitFor((m) => m.type === "message_ack");
    await ext.waitFor((m) => m.type === "task_state" && m.state === "thinking");
    ext.ws.close();
    await server.stop();
  });

  test("a failed wake keeps the message and tells the panel", async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const ext = await connectExtension(port);
    const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    ext.send("hello");
    const job = await (await pending).json();
    await post(port, "/waker/result", { jobId: job.jobId, ok: false, error: "conversation not found" });
    const err = await ext.waitFor((m) => m.type === "delivery_error");
    assert.match(err.error, /conversation not found/);
    assert.equal(server.getAgentStatus().queued, 1);
    ext.ws.close();
    await server.stop();
  });

  test("messages sent while the agent works ride along with the next tool result", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    server.connectPanel(CID); // turn is active now
    ext.send("وكمان شوف التعليقات");
    await sleep(100);
    const note = server.takeInterrupts();
    assert.ok(note);
    assert.match(note, /while you were working/);
    assert.match(note, /وكمان شوف التعليقات/);
    await ext.waitFor((m) => m.type === "message_ack");
    assert.equal(server.takeInterrupts(), null);
    ext.ws.close();
    await server.stop();
  });

  test("Stop without a final reply gets one nudge, then a no_reply note", async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" }); // links + ends connect turn
    const ext = await connectExtension(port);
    const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    ext.send("do it");
    const job = await (await pending).json();
    await post(port, "/waker/result", { jobId: job.jobId, ok: true });
    await ext.waitFor((m) => m.type === "message_ack");

    const first = await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    assert.equal(first.json.decision, "continue");
    assert.match(first.json.reason, /reply_to_user/);

    const second = await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    assert.equal(second.json.decision, "stop");
    await ext.waitFor((m) => m.type === "system_note" && m.code === "no_reply");
    ext.ws.close();
    await server.stop();
  });

  test("a message that lands between the final reply and Stop continues the same turn", async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const ext = await connectExtension(port);
    server.connectPanel(); // agent active again
    server.sendReply("done", "final");
    ext.send("one more thing");
    await sleep(100);
    const r = await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    assert.equal(r.json.decision, "continue");
    assert.match(r.json.reason, /one more thing/);
    ext.ws.close();
    await server.stop();
  });

  test("hold mode: with no waker, the finished turn is parked and released by the next message", async () => {
    const { server, port } = await makeServer({ holdSeconds: 30 });
    server.connectPanel(CID);
    const ext = await connectExtension(port);
    const held = post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    await ext.waitFor((m) => m.type === "agent_status" && m.status.mode === "hold");
    ext.send("صحيت؟");
    const r = await held;
    assert.equal(r.json.decision, "continue");
    assert.match(r.json.reason, /صحيت؟/);
    await ext.waitFor((m) => m.type === "message_ack");
    ext.ws.close();
    await server.stop();
  });

  test("reply_to_user(final) tells the agent to end its turn once wake-up is set up", async () => {
    const { server, port } = await makeServer();
    const mcp = createMcpServer(server, new Logger(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-"))));
    const [a, b] = InMemoryTransport.createLinkedPair();
    await mcp.connect(a);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(b);

    const tools = (await client.listTools()).tools.map((t) => t.name);
    assert.ok(tools.includes("connect_side_panel"));
    assert.ok(tools.includes("read_panel_messages"));

    // Not set up: legacy instruction
    let r = await client.callTool({ name: "reply_to_user", arguments: { text: "x", kind: "final" } });
    assert.match(r.content[0].text, /wait_for_user_message/);

    // Linked + hooks confirmed: end the turn
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    r = await client.callTool({ name: "reply_to_user", arguments: { text: "x", kind: "final" } });
    assert.match(r.content[0].text, /end your turn now/);

    const c = await client.callTool({ name: "connect_side_panel", arguments: {} });
    assert.match(c.content[0].text, /End your turn now/);
    await client.close();
    await server.stop();
  });

  test("stop-hook.js end to end: unrelated conversation stops, queued message continues", async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const ext = await connectExtension(port);

    const runHook = (payload) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(BRIDGE_ROOT, "dist", "stop-hook.js")], {
          env: { ...process.env, BRIDGE_PORT: String(port), MYCHROME_HOOK_TRACE: "off" },
        });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("close", () => resolve(JSON.parse(out)));
        child.stdin.end(JSON.stringify(payload));
      });

    assert.deepEqual(await runHook({ conversationId: OTHER, terminationReason: "model_stop" }), { decision: "stop" });

    server.connectPanel(); // busy turn
    ext.send("queued while busy");
    await sleep(100);
    const out = await runHook({ conversationId: CID, terminationReason: "model_stop", fullyIdle: true });
    assert.equal(out.decision, "continue");
    assert.match(out.reason, /queued while busy/);
    ext.ws.close();
    await server.stop();
  });

  test("stop-hook.js prints stop when the bridge is down", async () => {
    const out = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(BRIDGE_ROOT, "dist", "stop-hook.js")], {
        env: { ...process.env, BRIDGE_PORT: "9", MYCHROME_HOOK_TRACE: "off" },
      });
      let s = "";
      child.stdout.on("data", (d) => (s += d));
      child.on("close", () => resolve(JSON.parse(s)));
      child.stdin.end("{}");
    });
    assert.deepEqual(out, { decision: "stop" });
  });

  test("waker.js end to end with a fake agentapi on PATH", { skip: process.platform === "win32" }, async () => {
    const { server, port } = await makeServer();
    server.connectPanel(CID);
    await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
    const ext = await connectExtension(port);

    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-agentapi-"));
    const record = path.join(binDir, "calls.json");
    fs.writeFileSync(
      path.join(binDir, "agentapi"),
      `#!${process.execPath}\nrequire("fs").appendFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv.slice(2)) + "\\n");\n`,
      { mode: 0o755 }
    );
    const waker = spawn(process.execPath, [path.join(BRIDGE_ROOT, "dist", "waker.js")], {
      env: { ...process.env, BRIDGE_PORT: String(port), PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
    });
    try {
      await ext.waitFor((m) => m.type === "agent_status" && m.status.waker && m.status.mode === "push", 5000);
      ext.send("افتح الإعدادات");
      await ext.waitFor((m) => m.type === "message_ack", 5000);
      const calls = fs.readFileSync(record, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], "send-message");
      assert.equal(calls[0][1], CID);
      assert.match(calls[0][2], /افتح الإعدادات/);
    } finally {
      waker.kill();
      ext.ws.close();
      await server.stop();
    }
  });

  after(() => {
    delete process.env.NODE_ENV;
  });
});
