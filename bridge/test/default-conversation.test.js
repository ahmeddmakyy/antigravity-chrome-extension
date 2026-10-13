import { TEST_ROOT, writeTestToken } from "./setup.js";
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { BridgeWSServer } from "../dist/ws-server.js";
import { Logger } from "../dist/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
process.env.MYCHROME_ALLOWED_ORIGINS = ORIGIN;
const CID = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";

const TOKEN = (() => {
  const f = path.join(BRIDGE_ROOT, ".token");
  if (!fs.existsSync(f)) fs.writeFileSync(f, "test_token_default_conv_0123456789abcdef");
  const tok = fs.readFileSync(f, "utf-8").trim();
  writeTestToken(tok);
  return tok;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let portSeq = 9970;

async function makeServer(opts = {}) {
  const port = portSeq++;
  const stateDir = fs.mkdtempSync(path.join(TEST_ROOT, "mychrome-state-"));
  const logger = new Logger(path.join(stateDir, "logs"));
  const server = new BridgeWSServer(port, TOKEN, logger, { stateDir, holdSeconds: 0, ...opts });
  await server.start();
  return { server, port, stateDir };
}

async function connectExtension(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: ORIGIN } });
  const inbox = [];
  try {
    await new Promise((resolve, reject) => {
      ws.on("open", () => ws.send(JSON.stringify({ type: "auth", token: TOKEN })));
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        inbox.push(msg);
        if (msg.type === "auth_ok") resolve();
      });
      ws.on("error", reject);
    });
  } catch (err) {
    ws.close();
    throw err;
  }
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

describe("Default conversation creation (when unlinked)", { concurrency: 1 }, () => {
  before(() => {
    process.env.NODE_ENV = "test";
  });

  test("(a) panel message with no link and fake waker online creates default conversation", async () => {
    const { server, port, stateDir } = await makeServer();
    let ext = null;
    try {
      ext = await connectExtension(port);
      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("حلل المقال دا");
      const job = await (await pending).json();

      assert.equal(job.kind, "new_conversation");
      assert.equal(job.title, "MyChrome");
      assert.equal(job.projectId, "default-cli-project");
      assert.match(job.prompt, /حلل المقال دا/);

      const r = await post(port, "/waker/result", { jobId: job.jobId, ok: true, conversationId: CID });
      assert.equal(r.status, 200);

      const st = await ext.waitFor((m) => m.type === "agent_status" && m.status.linked);
      assert.equal(st.status.linked, true);
      assert.equal(server.getAgentStatus().linked, true);

      const saved = JSON.parse(fs.readFileSync(path.join(stateDir, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, CID);

      await ext.waitFor((m) => m.type === "message_ack");
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(b) second panel message afterwards produces a normal send-message wake and no second creation", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      ext = await connectExtension(port);
      // First message creates conversation
      let pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("الرسالة الأولى");
      const job1 = await (await pending).json();
      assert.equal(job1.kind, "new_conversation");
      await post(port, "/waker/result", { jobId: job1.jobId, ok: true, conversationId: CID });
      await ext.waitFor((m) => m.type === "agent_status" && m.status.linked);

      // End turn so agent is idle and ready for next wake
      server.sendReply("تم الانتهاء", "final");
      await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });

      // Second message
      pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("الرسالة الثانية");
      const job2 = await (await pending).json();

      assert.equal(job2.action, "send-message");
      assert.equal(job2.conversationId, CID);
      assert.notEqual(job2.kind, "new_conversation");
      assert.match(job2.prompt, /الرسالة الثانية/);

      await post(port, "/waker/result", { jobId: job2.jobId, ok: true });
      await ext.waitFor((m) => m.type === "message_ack");
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(c) when a link exists no creation job is ever queued", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      ext = await connectExtension(port);
      // Link exists via connectPanel + stop hook
      server.connectPanel(CID);
      await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });

      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("رسالة مع وجود ربط");
      const job = await (await pending).json();

      assert.equal(job.action, "send-message");
      assert.equal(job.conversationId, CID);
      assert.notEqual(job.kind, "new_conversation");
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(d) backoff prevents immediate retry, and after 3 failures no further job is queued", async () => {
    const BACKOFF = 250;
    const { server, port } = await makeServer({ defaultConversationBackoffMs: BACKOFF });
    let ext = null;
    try {
      ext = await connectExtension(port);

      // Attempt 1
      let pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("محاولة 1");
      const job1 = await (await pending).json();
      assert.equal(job1.kind, "new_conversation");
      await post(port, "/waker/result", { jobId: job1.jobId, ok: false, error: "failure 1" });

      // Immediate poll & message before backoff expires: no job should be produced
      const controller1 = new AbortController();
      const immediatePoll = fetch(`http://127.0.0.1:${port}/waker/next`, {
        headers: { "x-bridge-token": TOKEN },
        signal: controller1.signal,
      });
      await sleep(30);
      ext.send("محاولة مبكرة");
      const immediateRes = await Promise.race([
        immediatePoll.then((r) => r.json()).catch(() => "aborted"),
        sleep(100).then(() => "timed_out"),
      ]);
      assert.equal(immediateRes, "timed_out");
      controller1.abort();

      // Wait until backoff expires
      await sleep(BACKOFF + 50);

      // Attempt 2
      pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("محاولة 2");
      const job2 = await (await pending).json();
      assert.equal(job2.kind, "new_conversation");
      await post(port, "/waker/result", { jobId: job2.jobId, ok: false, error: "failure 2" });

      // Wait until backoff expires
      await sleep(BACKOFF + 50);

      // Attempt 3
      pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("محاولة 3");
      const job3 = await (await pending).json();
      assert.equal(job3.kind, "new_conversation");
      await post(port, "/waker/result", { jobId: job3.jobId, ok: false, error: "failure 3" });

      // Wait until backoff expires
      await sleep(BACKOFF + 50);

      // Attempt 4: 3 failures in a row, should NOT queue any further job
      const controller4 = new AbortController();
      const finalPoll = fetch(`http://127.0.0.1:${port}/waker/next`, {
        headers: { "x-bridge-token": TOKEN },
        signal: controller4.signal,
      });
      await sleep(50);
      ext.send("محاولة 4");
      const finalRes = await Promise.race([
        finalPoll.then((r) => r.json()).catch(() => "aborted"),
        sleep(150).then(() => "no_job"),
      ]);
      assert.equal(finalRes, "no_job");
      controller4.abort();

      assert.equal(server.getAgentStatus().linked, false);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(e) invalid conversationId in result is rejected and does not link", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      ext = await connectExtension(port);
      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("مرحبا");
      const job = await (await pending).json();
      assert.equal(job.kind, "new_conversation");

      const r = await post(port, "/waker/result", { jobId: job.jobId, ok: true, conversationId: "not-a-valid-uuid" });
      assert.equal(r.status, 400);
      assert.equal(server.getAgentStatus().linked, false);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(f) link that appears while creation is in flight wins and new id is discarded", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      ext = await connectExtension(port);
      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("مرحبا");
      const job = await (await pending).json();
      assert.equal(job.kind, "new_conversation");

      // While creation is in flight, an explicit link arrives
      server.connectPanel(OTHER);
      await post(port, "/hook/stop", { conversationId: OTHER, terminationReason: "model_stop" });

      // Now waker reports new conversation created
      const r = await post(port, "/waker/result", { jobId: job.jobId, ok: true, conversationId: CID });
      assert.equal(r.status, 200);

      // OTHER wins, CID is discarded
      assert.equal(server.getAgentStatus().linked, true);
      const status = await (await fetch(`http://127.0.0.1:${port}/status`, { headers: { "x-bridge-token": TOKEN } })).json();
      assert.equal(status.linkedConversationId, OTHER);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });
});
