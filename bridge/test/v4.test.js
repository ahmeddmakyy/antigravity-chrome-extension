// v4 behaviour: turn lifecycle, routing without a Stop hook, plans, richer activity, language notes, hook trace.
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
import { BridgeWSServer, summarizeResult, lightResult } from "../dist/ws-server.js";
import { createMcpServer } from "../dist/mcp-server.js";
import { Logger } from "../dist/logger.js";
import { BRIDGE_VERSION } from "../dist/version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const CID = "11111111-2222-4333-8444-555555555555";
const TOKEN = (() => {
  const f = path.join(BRIDGE_ROOT, ".token");
  if (!fs.existsSync(f)) fs.writeFileSync(f, "test_token_push_0123456789abcdef0123456789");
  return fs.readFileSync(f, "utf-8").trim();
})();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let portSeq = 9950;

async function makeServer(opts = {}) {
  const port = portSeq++;
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "mychrome-v4-"));
  const logger = new Logger(path.join(stateDir, "logs"));
  const server = new BridgeWSServer(port, TOKEN, logger, { stateDir, holdSeconds: 0, ...opts });
  await server.start();
  return { server, port, stateDir, logger };
}

/** Fake extension that answers browser commands with canned results. */
async function connectExtension(port, results = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: ORIGIN } });
  const inbox = [];
  let authOk = null;
  await new Promise((resolve, reject) => {
    ws.on("open", () => ws.send(JSON.stringify({ type: "auth", token: TOKEN, extensionVersion: BRIDGE_VERSION })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      inbox.push(msg);
      if (msg.type === "auth_ok") { authOk = msg; resolve(); }
      if (msg.type === "browser_command") {
        const r = results[msg.tool];
        if (r instanceof Error) ws.send(JSON.stringify({ type: "browser_command_result", correlationId: msg.correlationId, error: r.message }));
        else ws.send(JSON.stringify({ type: "browser_command_result", correlationId: msg.correlationId, result: r ?? { ok: true } }));
      }
    });
    ws.on("error", reject);
  });
  const waitFor = async (pred, ms = 3000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await sleep(15);
    }
    throw new Error("Timed out waiting for a server message");
  };
  const send = (text, extra = {}) =>
    ws.send(JSON.stringify({ type: "chat_message", text, clientMsgId: `c_${Math.random().toString(36).slice(2)}`, tab: { id: 7, url: "https://example.com", title: "Example" }, ui_language: "en", ...extra }));
  return { ws, inbox, waitFor, send, authOk: () => authOk };
}

async function post(port, route, body) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-token": TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function mcpClient(server) {
  const mcp = createMcpServer(server, new Logger(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-v4-"))));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await mcp.connect(a);
  const client = new Client({ name: "t", version: "1" });
  await client.connect(b);
  return client;
}

describe("v4: turns, routing, plans, activity", { concurrency: 1 }, () => {
  before(() => { process.env.NODE_ENV = "test"; });
  after(() => { delete process.env.NODE_ENV; });

  test("auth_ok carries the bridge version and status reports both versions", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    assert.equal(ext.authOk().bridgeVersion, BRIDGE_VERSION);
    const st = await (await fetch(`http://127.0.0.1:${port}/status`, { headers: { "x-bridge-token": TOKEN } })).json();
    assert.equal(st.version, BRIDGE_VERSION);
    assert.equal(st.extensionVersion, BRIDGE_VERSION);
    ext.ws.close();
    await server.stop();
  });

  test("a turn reports started and ended with a summary; tools leave the state on thinking, not idle", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port, { read_page: { elements: [], header: { title: "x" } } });
    ext.send("read it");
    const msg = await server.waitForUserMessage(2);
    assert.ok(msg);
    const started = await ext.waitFor((m) => m.type === "turn_started");
    assert.equal(started.fromUser, true);
    await server.executeBrowserCommand("read_page", { tabId: 7, intent: "Reading the page" });
    await sleep(60);
    const states = ext.inbox.filter((m) => m.type === "task_state").map((m) => m.state);
    assert.equal(states[states.length - 1], "thinking");
    assert.ok(!states.includes("idle"));
    server.sendReply("All done", "final");
    const ended = await ext.waitFor((m) => m.type === "turn_ended", 3000);
    assert.equal(ended.summary.turnId, started.turnId);
    assert.equal(ended.summary.finalSent, true);
    assert.equal(ended.summary.tools, 1);
    assert.equal(ended.summary.errors, 0);
    ext.ws.close();
    await server.stop();
  });

  test("activity events carry correlationId, duration, a light result and a redacted summary", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port, {
      click: { clicked: { x: 1, y: 2 }, target: "Save" },
      screenshot: { dataUrl: "data:image/jpeg;base64," + "A".repeat(4000) },
      execute_javascript: new Error("ReferenceError: foo is not defined"),
    });
    server.connectPanel();
    await server.executeBrowserCommand("click", { tabId: 7, ref: "e1" });
    const ok = await ext.waitFor((m) => m.type === "activity_event" && m.event.tool === "click" && m.event.status === "success");
    assert.match(ok.event.correlationId, /^cmd_/);
    assert.equal(ok.event.result.target, "Save");
    assert.ok(typeof ok.event.durationMs === "number");
    const running = ext.inbox.find((m) => m.type === "activity_event" && m.event.status === "running");
    assert.equal(running.event.correlationId, ok.event.correlationId);

    await server.executeBrowserCommand("screenshot", { tabId: 7 });
    const shot = await ext.waitFor((m) => m.type === "activity_event" && m.event.tool === "screenshot" && m.event.status === "success");
    assert.doesNotMatch(shot.event.resultSummary, /base64/);
    assert.match(shot.event.resultSummary, /\[image \d+ KB\]/);

    await assert.rejects(server.executeBrowserCommand("execute_javascript", { tabId: 7, code: "foo" }), /foo is not defined/);
    const err = await ext.waitFor((m) => m.type === "activity_event" && m.event.status === "error");
    assert.match(err.event.error, /foo is not defined/);
    ext.ws.close();
    await server.stop();
  });

  test("summarizeResult and lightResult keep things small", () => {
    assert.equal(summarizeResult(undefined), "");
    assert.match(summarizeResult({ dataUrl: "data:image/png;base64,QUJD" }), /\[image 0 KB\]/);
    assert.ok(summarizeResult("x".repeat(5000)).length <= 1500);
    const light = lightResult({ text: "hello world", dataUrl: "data:...", finalUrl: "https://a.b", elements: [1, 2], scroll: { moved: 300, atEnd: false } });
    assert.deepEqual(light, { textLength: 11, finalUrl: "https://a.b", scroll: { moved: 300, atEnd: false } });
    assert.deepEqual(lightResult([1, 2, 3]), { count: 3 });
  });

  test("connect_side_panel without a Stop hook ends the turn at once, so the next message wakes the agent", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    server.connectPanel(CID); // links; waker online, no hooks: the turn must not stay busy
    assert.equal(server.getAgentStatus().busy, false);
    ext.send("first message after /mychrome");
    const job = await (await pending).json();
    assert.match(job.prompt, /first message after \/mychrome/);
    ext.ws.close();
    await server.stop();
  });

  test("without a Stop hook, a long-quiet turn is presumed idle and the next message wakes the agent", async () => {
    const { server, port } = await makeServer({ presumedIdleMs: 150 });
    const ext = await connectExtension(port);
    let pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    server.connectPanel(CID);
    ext.send("task one");
    let job = await (await pending).json();
    await post(port, "/waker/result", { jobId: job.jobId, ok: true });
    await ext.waitFor((m) => m.type === "message_ack");
    assert.equal(server.getAgentStatus().busy, true);
    // The agent ends its turn silently (no final, no hook). After the quiet window, a new message must wake it.
    await sleep(250);
    pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
    await sleep(50);
    ext.send("are you there?");
    job = await (await pending).json();
    assert.match(job.prompt, /are you there\?/);
    const ended = await ext.waitFor((m) => m.type === "turn_ended" && m.summary.reason === "presumed idle");
    assert.equal(ended.summary.finalSent, false);
    ext.ws.close();
    await server.stop();
  });

  test("Stop from the panel ends the turn right away and marks it stopped", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    ext.send("long task");
    await server.waitForUserMessage(2);
    ext.ws.send(JSON.stringify({ type: "user_action", action: "stop" }));
    const ended = await ext.waitFor((m) => m.type === "turn_ended");
    assert.equal(ended.summary.stoppedByUser, true);
    assert.equal(server.getAgentStatus().busy, false);
    await assert.rejects(server.executeBrowserCommand("click", { tabId: 7 }), /stopped_by_user/);
    ext.ws.close();
    await server.stop();
  });

  test("update_plan broadcasts the checklist to the panel", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    const client = await mcpClient(server);
    const tools = (await client.listTools()).tools.map((t) => t.name);
    assert.ok(tools.includes("update_plan"));
    const r = await client.callTool({
      name: "update_plan",
      arguments: { steps: [{ title: "Open profile", status: "done" }, { title: "Read About", status: "in_progress" }, { title: "Write review", status: "pending" }] },
    });
    assert.match(r.content[0].text, /Plan shown/);
    const plan = await ext.waitFor((m) => m.type === "plan_update");
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[1].status, "in_progress");
    await client.close();
    ext.ws.close();
    await server.stop();
  });

  test("the agent prompt asks for intents in the panel language", async () => {
    const { server } = await makeServer();
    const en = server.formatMessagesForAgent([{ messageId: 1, text: "hi", tab: { id: 1, url: "u", title: "t" }, ui_language: "en", timestamp: 0 }]);
    assert.match(en, /Panel language: English/);
    const ar = server.formatMessagesForAgent([{ messageId: 2, text: "هاي", tab: { id: 1, url: "u", title: "t" }, ui_language: "ar", timestamp: 0 }]);
    assert.match(ar, /Panel language: Arabic/);
    await server.stop();
  });

  test("switching the panel language mid-task reaches the agent in the next tool result", async () => {
    const { server, port } = await makeServer();
    const ext = await connectExtension(port);
    const client = await mcpClient(server);
    ext.send("start", { ui_language: "ar" });
    await server.waitForUserMessage(2);
    ext.ws.send(JSON.stringify({ type: "ui_language", lang: "en" }));
    await sleep(80);
    const r = await client.callTool({ name: "reply_to_user", arguments: { text: "working", kind: "progress" } });
    const all = r.content.map((c) => c.text).join("\n");
    assert.match(all, /switched the side panel to English/);
    const again = await client.callTool({ name: "reply_to_user", arguments: { text: "still working", kind: "progress" } });
    assert.doesNotMatch(again.content.map((c) => c.text).join("\n"), /switched the side panel/);
    await client.close();
    ext.ws.close();
    await server.stop();
  });

  test("hook self-test reaches the bridge without counting as a real Stop hook", async () => {
    const { server, port } = await makeServer();
    const r = await post(port, "/hook/stop", { selfTest: true });
    assert.equal(r.json.decision, "stop");
    const st = await (await fetch(`http://127.0.0.1:${port}/status`, { headers: { "x-bridge-token": TOKEN } })).json();
    assert.equal(st.hooks, false);
    assert.ok(st.hookSelfTestAt > 0);
    await server.stop();
  });

  test("stop-hook.js writes one trace line per run", async () => {
    const { server, port } = await makeServer();
    const trace = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "trace-")), "hook-trace.log");
    const out = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(BRIDGE_ROOT, "dist", "stop-hook.js")], {
        env: { ...process.env, BRIDGE_PORT: String(port), MYCHROME_HOOK_TRACE: trace },
      });
      let s = "";
      child.stdout.on("data", (d) => (s += d));
      child.on("close", () => resolve(JSON.parse(s)));
      child.stdin.end(JSON.stringify({ conversationId: CID, terminationReason: "model_stop" }));
    });
    assert.deepEqual(out, { decision: "stop" });
    const lines = fs.readFileSync(trace, "utf-8").trim().split("\n");
    assert.equal(lines.length, 1);
    assert.match(lines[0], /conversation=11111111 reason=model_stop -> stop/);
    await server.stop();
  });
});
