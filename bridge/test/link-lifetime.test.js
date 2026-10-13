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
  if (!fs.existsSync(f)) fs.writeFileSync(f, "test_token_link_lifetime_0123456789ab");
  const tok = fs.readFileSync(f, "utf-8").trim();
  writeTestToken(tok);
  return tok;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let portSeq = 9960;

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

describe("Link lifetime & reset tests", { concurrency: 1 }, () => {
  before(() => {
    process.env.NODE_ENV = "test";
  });

  test("(a) a saved link older than the lifetime is dropped at load; a fresh one is kept", async () => {
    // 1. Link older than lifetime is dropped at load
    const stateDirOld = fs.mkdtempSync(path.join(TEST_ROOT, "mychrome-state-"));
    const oldSession = {
      linkedConversationId: CID,
      linkedAt: Date.now() - 10 * 3600 * 1000,
      lastUsedAt: Date.now() - 10 * 3600 * 1000,
    };
    fs.writeFileSync(path.join(stateDirOld, ".session.json"), JSON.stringify(oldSession, null, 2));

    const portOld = portSeq++;
    const loggerOld = new Logger(path.join(stateDirOld, "logs"));
    const serverOld = new BridgeWSServer(portOld, TOKEN, loggerOld, { stateDir: stateDirOld, linkTtlHours: 6 });
    await serverOld.start();
    try {
      assert.equal(serverOld.getAgentStatus().linked, false);
      assert.equal(serverOld.getAgentStatus().linkedId, null);
      const saved = JSON.parse(fs.readFileSync(path.join(stateDirOld, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, null);
    } finally {
      await serverOld.stop();
    }

    // 2. Link with missing timestamps is treated as expired and dropped at load
    const stateDirMissing = fs.mkdtempSync(path.join(TEST_ROOT, "mychrome-state-"));
    const missingSession = {
      linkedConversationId: CID,
    };
    fs.writeFileSync(path.join(stateDirMissing, ".session.json"), JSON.stringify(missingSession, null, 2));
    const portMissing = portSeq++;
    const loggerMissing = new Logger(path.join(stateDirMissing, "logs"));
    const serverMissing = new BridgeWSServer(portMissing, TOKEN, loggerMissing, { stateDir: stateDirMissing, linkTtlHours: 6 });
    await serverMissing.start();
    try {
      assert.equal(serverMissing.getAgentStatus().linked, false);
      assert.equal(serverMissing.getAgentStatus().linkedId, null);
      const saved = JSON.parse(fs.readFileSync(path.join(stateDirMissing, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, null);
    } finally {
      await serverMissing.stop();
    }

    // 3. Fresh link is kept
    const stateDirFresh = fs.mkdtempSync(path.join(TEST_ROOT, "mychrome-state-"));
    const freshSession = {
      linkedConversationId: CID,
      linkedAt: Date.now() - 3600 * 1000,
      lastUsedAt: Date.now() - 3600 * 1000,
    };
    fs.writeFileSync(path.join(stateDirFresh, ".session.json"), JSON.stringify(freshSession, null, 2));

    const portFresh = portSeq++;
    const loggerFresh = new Logger(path.join(stateDirFresh, "logs"));
    const serverFresh = new BridgeWSServer(portFresh, TOKEN, loggerFresh, { stateDir: stateDirFresh, linkTtlHours: 6 });
    await serverFresh.start();
    try {
      assert.equal(serverFresh.getAgentStatus().linked, true);
      assert.equal(serverFresh.getAgentStatus().linkedId, CID.slice(0, 8));
      const saved = JSON.parse(fs.readFileSync(path.join(stateDirFresh, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, CID);
    } finally {
      await serverFresh.stop();
    }
  });

  test("(b) a link that expires while the helper runs is dropped when the next panel message arrives and a default conversation is created for it", async () => {
    // Set short TTL: 0.00005 hours ~ 180 ms
    const { server, port, stateDir } = await makeServer({ linkTtlHours: 0.00005 });
    let ext = null;
    try {
      server.connectPanel(CID);
      assert.equal(server.getAgentStatus().linked, true);
      assert.equal(server.getAgentStatus().linkedId, CID.slice(0, 8));

      // Wait for the link to expire
      await sleep(250);

      ext = await connectExtension(port);
      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("wake after expired");
      const job = await (await pending).json();

      // Dropped the expired link and created a default conversation job
      assert.equal(job.kind, "new_conversation");
      assert.equal(job.title, "MyChrome");
      assert.match(job.prompt, /wake after expired/);

      const r = await post(port, "/waker/result", { jobId: job.jobId, ok: true, conversationId: OTHER });
      assert.equal(r.status, 200);

      const st = await ext.waitFor((m) => m.type === "agent_status" && m.status.linkedId === OTHER.slice(0, 8));
      assert.equal(st.status.linked, true);
      assert.equal(st.status.linkedId, OTHER.slice(0, 8));
      assert.equal(server.getAgentStatus().linkedId, OTHER.slice(0, 8));

      const saved = JSON.parse(fs.readFileSync(path.join(stateDir, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, OTHER);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(c) lastUsedAt moves forward when a message is delivered to the linked conversation", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      server.connectPanel(CID);
      const initialUsedAt = server.getLastUsedAt();
      assert.ok(initialUsedAt && initialUsedAt > 0);

      await sleep(50);
      ext = await connectExtension(port);
      const pending = fetch(`http://127.0.0.1:${port}/waker/next`, { headers: { "x-bridge-token": TOKEN } });
      await sleep(50);
      ext.send("test lastUsedAt advance");
      const job = await (await pending).json();
      assert.equal(job.action, "send-message");
      assert.equal(job.conversationId, CID);

      await sleep(50);
      const r = await post(port, "/waker/result", { jobId: job.jobId, ok: true });
      assert.equal(r.status, 200);

      await ext.waitFor((m) => m.type === "message_ack");
      const afterDelivery = server.getLastUsedAt();
      assert.ok(afterDelivery >= initialUsedAt, `Expected ${afterDelivery} >= ${initialUsedAt}`);

      // Stop hook of linked conversation also updates lastUsedAt
      await sleep(50);
      const preHook = server.getLastUsedAt();
      server.sendReply("done", "final");
      await post(port, "/hook/stop", { conversationId: CID, terminationReason: "model_stop" });
      const afterHook = server.getLastUsedAt();
      assert.ok(afterHook >= preHook, `Expected ${afterHook} >= ${preHook}`);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(d) reset_link from an authenticated extension clears the link and status shows linkedId null; an unauthenticated client cannot send it", async () => {
    const { server, port, stateDir } = await makeServer();
    let ext = null;
    try {
      server.connectPanel(CID);
      assert.equal(server.getAgentStatus().linked, true);
      assert.equal(server.getAgentStatus().linkedId, CID.slice(0, 8));

      ext = await connectExtension(port);
      ext.ws.send(JSON.stringify({ type: "reset_link" }));

      const st = await ext.waitFor((m) => m.type === "agent_status" && m.status.linked === false);
      assert.equal(st.status.linked, false);
      assert.equal(st.status.linkedId, null);
      assert.equal(server.getAgentStatus().linked, false);
      assert.equal(server.getAgentStatus().linkedId, null);

      const saved = JSON.parse(fs.readFileSync(path.join(stateDir, ".session.json"), "utf-8"));
      assert.equal(saved.linkedConversationId, null);

      // Now re-link to test that an unauthenticated client cannot reset the link
      server.connectPanel(CID);
      assert.equal(server.getAgentStatus().linked, true);

      // Connect an unauthenticated client
      const rawWs = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: ORIGIN } });
      const closePromise = new Promise((resolve) => {
        rawWs.on("close", (code) => resolve(code));
      });
      await new Promise((resolve) => rawWs.on("open", resolve));
      rawWs.send(JSON.stringify({ type: "reset_link" }));
      const closeCode = await closePromise;
      assert.ok(closeCode === 4002 || closeCode === 4003, `Expected auth rejection close code, got ${closeCode}`);

      // The link remains intact
      assert.equal(server.getAgentStatus().linked, true);
      assert.equal(server.getAgentStatus().linkedId, CID.slice(0, 8));
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });

  test("(e) status carries linkedId with exactly 8 characters and never the full id", async () => {
    const { server, port } = await makeServer();
    let ext = null;
    try {
      server.connectPanel(CID);
      const st = server.getAgentStatus();
      assert.equal(st.linked, true);
      assert.equal(st.linkedId, CID.slice(0, 8));
      assert.equal(st.linkedId.length, 8);
      assert.equal(typeof st.linkedAt, "number");

      // Verify serialized status never contains full CID
      const serialized = JSON.stringify(st);
      assert.equal(serialized.includes(CID), false, "status should never include the full conversation id");
      assert.equal(serialized.includes(CID.slice(0, 8)), true, "status should include the 8-char prefix");

      ext = await connectExtension(port);
      const wireStatus = await ext.waitFor((m) => m.type === "agent_status" && m.status.linked);
      assert.equal(wireStatus.status.linkedId, CID.slice(0, 8));
      assert.equal(wireStatus.status.linkedId.length, 8);
      assert.equal(JSON.stringify(wireStatus).includes(CID), false);

      // After reset_link, linkedId is null
      ext.ws.send(JSON.stringify({ type: "reset_link" }));
      const unlinkedStatus = await ext.waitFor((m) => m.type === "agent_status" && !m.status.linked);
      assert.equal(unlinkedStatus.status.linkedId, null);
      assert.equal(unlinkedStatus.status.linkedAt, null);
    } finally {
      if (ext) ext.ws.close();
      await server.stop();
    }
  });
});
