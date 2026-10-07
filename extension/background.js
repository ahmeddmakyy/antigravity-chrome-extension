// background.js - MyChrome v5 service worker
// Bridge connection (WebSocket), browser tools over CDP, the per-tab side panel, the chat history
// and the live turn that every open panel mirrors.

import {
  createTurn,
  applyActivity,
  applyProgress,
  applyPlan,
  applyFinal,
  closeTurn,
  toHistoryEntry,
} from "./shared/turn-model.js";
import {
  readPageScript,
  findScript,
  pageTextScript,
  resolveClickScript,
  refCenterScript,
  scrollProbeScript,
  scrollToRefScript,
  typeSafetyScript,
  formInputScript,
  selectorExistsScript,
} from "./bg/page-scripts.js";

const BUILD = "5.2.0";
const PANEL_PORT = "antigravity-sidepanel";
const BACKOFF_STEPS = [2000, 5000, 15000, 30000, 60000];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let ws = null;
let wsConnecting = false;
let reconnectTimer = null;
let pingInterval = null;
let offlineSince = null;
let failedAttempts = 0;
let bridgeVersion = null;
let authFailed = false;

let currentToken = "";
const defaultUiLang = ((chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : "en").toLowerCase().startsWith("ar")) ? "ar" : "en";
let currentUiLanguage = defaultUiLang;
let blocklistDomains = [];
let lastAgentStatus = null;
let isListeningState = false;

let currentTaskTabId = null;
let currentTaskState = "idle";
let currentTaskLabel = "";
let currentTurnId = null;

/** port -> { tabId, build } */
const panels = new Map();

const activeDebuggers = new Set();
const consoleLogsByTab = new Map();
const networkLogsByTab = new Map();
const activeDialogsByTab = new Map();
let detachTimer = null;

// Chat history and the live turn
let history = [];
let historyLoaded = false;
let historySaveTimer = null;
let live = null;
let pendingQuestion = null;
const media = new Map(); // correlationId -> preview data URL (memory only)
let turnOrigin = { tabId: null, agentTab: null };

// ---------------------------------------------------------------------------
// Event log (recording on/off, ring buffer of 3000 events)
// ---------------------------------------------------------------------------
let eventLog = [];
let eventSeq = 0;
let isVerboseMode = false;
let logSaveTimeout = null;
let isStorageLoaded = false;
let isRecording = false;
let logSession = { startedAt: null, stoppedAt: null };

const storageInitPromise = new Promise((resolve) => {
  chrome.storage.local.get(
    ["eventLog", "eventSeq", "isVerboseMode", "logRecording", "logSession", "chatHistory", "uiLanguage", "pairingToken", "blocklist"],
    (res) => {
      if (Array.isArray(res.eventLog)) eventLog = res.eventLog;
      if (typeof res.eventSeq === "number") eventSeq = res.eventSeq;
      if (typeof res.isVerboseMode === "boolean") isVerboseMode = res.isVerboseMode;
      if (typeof res.logRecording === "boolean") isRecording = res.logRecording;
      if (res.logSession && typeof res.logSession === "object") logSession = res.logSession;
      if (Array.isArray(res.chatHistory)) history = res.chatHistory;
      if (res.uiLanguage) currentUiLanguage = res.uiLanguage;
      currentToken = res.pairingToken || "";
      blocklistDomains = parseBlocklist(res.blocklist);
      historyLoaded = true;
      isStorageLoaded = true;
      resolve();
    }
  );
});

function parseBlocklist(v) {
  return String(v || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function logStateMessage() {
  return {
    type: "log_state",
    recording: isRecording,
    startedAt: logSession.startedAt,
    stoppedAt: logSession.stoppedAt,
    count: eventLog.length,
    verbose: isVerboseMode,
  };
}

async function setRecording(on) {
  if (!isStorageLoaded) await storageInitPromise;
  if (on === isRecording) {
    notifyPanels(logStateMessage());
    return;
  }
  if (on) {
    eventLog = [];
    eventSeq = 0;
    logSession = { startedAt: Date.now(), stoppedAt: null };
    isRecording = true;
    chrome.storage.local.set({ logRecording: true, logSession });
    logEvent("background", "recording_started", {
      build: BUILD,
      bridgeVersion,
      wsState: ws ? ws.readyState : "none",
      agentStatus: lastAgentStatus,
      taskState: currentTaskState,
      uiLanguage: currentUiLanguage,
      verbose: isVerboseMode,
      panels: [...panels.values()].map((p) => ({ tabId: p.tabId, build: p.build })),
    });
  } else {
    logEvent("background", "recording_stopped", { events: eventLog.length });
    isRecording = false;
    logSession = { ...logSession, stoppedAt: Date.now() };
    chrome.storage.local.set({ logRecording: false, logSession, eventLog, eventSeq });
  }
  notifyPanels(logStateMessage());
}

function scheduleLogSave() {
  if (logSaveTimeout) clearTimeout(logSaveTimeout);
  logSaveTimeout = setTimeout(() => {
    logSaveTimeout = null;
    chrome.storage.local.set({ eventLog, eventSeq });
  }, 400);
}

const IMAGE_RE = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g;

function redactString(s) {
  if (typeof s !== "string") return s;
  return s.replace(IMAGE_RE, (m) => `[image ${Math.round(m.length / 1024)} KB]`);
}

function sanitizeData(data, depth = 0) {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") return redactString(data);
  if (typeof data !== "object") return data;
  if (depth > 6) return "[nested]";
  if (Array.isArray(data)) return data.slice(0, 50).map((item) => sanitizeData(item, depth + 1));
  const clone = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("token") || lowerKey.includes("password")) {
      clone[key] = "[REDACTED]";
    } else if ((lowerKey === "screenshot" || lowerKey === "dataurl" || lowerKey === "image") && typeof value === "string") {
      clone[key] = `[image ~${Math.round(value.length / 1024)} KB]`;
    } else if (lowerKey === "text" && (data.isPassword || data.isCard || data.isSensitive)) {
      clone[key] = "[REDACTED]";
    } else if (!isVerboseMode && (lowerKey === "pagetext" || (lowerKey === "text" && typeof value === "string" && value.length > 500))) {
      clone[key] = `[Length: ${value.length} chars]`;
    } else {
      clone[key] = sanitizeData(value, depth + 1);
    }
  }
  return clone;
}

function logEvent(source, type, data = {}) {
  if (!isRecording) return;
  const entry = {
    seq: ++eventSeq,
    time: new Date().toISOString(),
    source, // "panel" | "background" | "bridge" | "agent"
    type,
    turn: currentTurnId || undefined,
    data: sanitizeData(data),
  };
  eventLog.push(entry);
  if (eventLog.length > 3000) eventLog.shift();
  scheduleLogSave();
  notifyPanels({ type: "new_log_event", event: entry });
}

self.addEventListener("error", (e) => {
  logEvent("background", "window_error", { message: e.message, filename: e.filename, lineno: e.lineno });
});
self.addEventListener("unhandledrejection", (e) => {
  logEvent("background", "unhandledrejection", { reason: String(e.reason) });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.pairingToken) currentToken = changes.pairingToken.newValue || "";
  if (changes.uiLanguage) {
    currentUiLanguage = changes.uiLanguage.newValue || "ar";
    sendToBridge({ type: "ui_language", lang: currentUiLanguage });
    if (currentTaskTabId && currentTaskState !== "idle") setOverlayStateOnTab(currentTaskTabId, currentTaskState, currentTaskLabel);
  }
  if (changes.blocklist) blocklistDomains = parseBlocklist(changes.blocklist.newValue);
  if (changes.pairingToken || changes.bridgePort) {
    authFailed = false;
    reconnectDelay = 1000;
    dropSocket();
    connectBridgeWebSocket();
  }
});

// ---------------------------------------------------------------------------
// Side panel: only on the tab where the user opened it
// ---------------------------------------------------------------------------
const panelPath = (tabId) => `sidepanel.html?tab=${tabId}`;

async function rememberPanelTab(tabId, on) {
  try {
    const { panelTabs = [] } = await chrome.storage.session.get("panelTabs");
    const set = new Set(panelTabs);
    if (on) set.add(tabId);
    else set.delete(tabId);
    await chrome.storage.session.set({ panelTabs: [...set] });
  } catch {}
}

async function initSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch {}
  try {
    // No panel anywhere by default. Tabs get one when the user clicks the toolbar icon.
    await chrome.sidePanel.setOptions({ enabled: false });
  } catch {}
  try {
    const { panelTabs = [] } = await chrome.storage.session.get("panelTabs");
    for (const tabId of panelTabs) {
      chrome.sidePanel.setOptions({ tabId, path: panelPath(tabId), enabled: true }).catch(() => rememberPanelTab(tabId, false));
    }
  } catch {}
}
initSidePanel();

function panelOpenOn(tabId) {
  for (const p of panels.values()) if (p.tabId === tabId) return true;
  return false;
}

/** Must run synchronously inside the click handler so Chrome treats it as a user gesture. */
function openPanelFor(tab) {
  if (!tab || typeof tab.id !== "number") return;
  const tabId = tab.id;
  chrome.sidePanel.setOptions({ tabId, path: panelPath(tabId), enabled: true }).catch(() => {});
  chrome.sidePanel.open({ tabId }).catch((err) => logEvent("background", "panel_open_failed", { tabId, error: err.message }));
  rememberPanelTab(tabId, true);
  logEvent("background", "panel_open", { tabId });
}

function closePanelFor(tabId) {
  for (const [port, p] of panels) {
    if (p.tabId === tabId) {
      try {
        port.postMessage({ type: "close_panel" });
      } catch {}
    }
  }
  if (typeof chrome.sidePanel.close === "function") chrome.sidePanel.close({ tabId }).catch(() => {});
}

chrome.action.onClicked.addListener((tab) => {
  if (panelOpenOn(tab.id)) closePanelFor(tab.id);
  else openPanelFor(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  rememberPanelTab(tabId, false);
  consoleLogsByTab.delete(tabId);
  networkLogsByTab.delete(tabId);
  activeDialogsByTab.delete(tabId);
  activeDebuggers.delete(tabId);
});

// ---------------------------------------------------------------------------
// Alarms & Disk Manifest Watcher (auto-reloads extension when files change on disk)
// ---------------------------------------------------------------------------
async function checkDiskManifest() {
  try {
    const res = await fetch(chrome.runtime.getURL(`manifest.json?_t=${Date.now()}`));
    if (!res.ok) return;
    const diskManifest = await res.json();
    const loadedVersion = chrome.runtime.getManifest().version;
    if (diskManifest.version && diskManifest.version !== loadedVersion) {
      logEvent("background", "manifest_updated_on_disk", { from: loadedVersion, to: diskManifest.version });
      console.log(`[MyChrome] Manifest changed on disk: ${loadedVersion} -> ${diskManifest.version}. Reloading extension...`);
      chrome.runtime.reload();
    }
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("bridge_watchdog", { periodInMinutes: 1 });
  chrome.alarms.create("manifest_watchdog", { periodInMinutes: 1 });
  initSidePanel();
  checkDiskManifest();
});
chrome.runtime.onStartup.addListener(() => {
  initSidePanel();
  checkDiskManifest();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "bridge_watchdog" && (!ws || ws.readyState !== WebSocket.OPEN)) connectBridgeWebSocket();
  if (alarm.name === "manifest_watchdog") checkDiskManifest();
});
setInterval(checkDiskManifest, 30000);

// ---------------------------------------------------------------------------
// CDP events
// ---------------------------------------------------------------------------
chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  if (!tabId) return;
  if (method === "Console.messageAdded") {
    const list = consoleLogsByTab.get(tabId) || [];
    const m = params.message || {};
    list.push({ level: m.level, text: String(m.text || "").slice(0, 500), url: m.url, line: m.line, time: Date.now() });
    if (list.length > 200) list.shift();
    consoleLogsByTab.set(tabId, list);
  } else if (method === "Network.responseReceived" || method === "Network.loadingFailed") {
    const list = networkLogsByTab.get(tabId) || [];
    if (method === "Network.responseReceived") {
      const r = params.response || {};
      list.push({ url: String(r.url || "").slice(0, 300), status: r.status, type: params.type, mime: r.mimeType, time: Date.now() });
    } else {
      list.push({ url: "", failed: true, error: params.errorText, type: params.type, time: Date.now() });
    }
    if (list.length > 200) list.shift();
    networkLogsByTab.set(tabId, list);
  } else if (method === "Network.requestWillBeSent") {
    const list = networkLogsByTab.get(tabId) || [];
    list.lastRequestAt = Date.now();
    networkLogsByTab.set(tabId, list);
  } else if (method === "Page.javascriptDialogOpening") {
    activeDialogsByTab.set(tabId, params);
  } else if (method === "Page.javascriptDialogClosed") {
    activeDialogsByTab.delete(tabId);
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (!source.tabId) return;
  activeDebuggers.delete(source.tabId);
  logEvent("background", "debugger_detach", { tabId: source.tabId, reason: reason || "detached" });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete" && tabId === currentTaskTabId && currentTaskState !== "idle") {
    await setOverlayStateOnTab(tabId, currentTaskState, currentTaskLabel, { quiet: true });
  }
});

// Messages from the in-page overlay
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "STOP_SESSION") {
    logEvent("background", "stop_from_page", { tabId: sender.tab?.id });
    sendToBridge({ type: "user_action", action: "stop" });
    setOverlayStateOnTab(currentTaskTabId, "idle", "");
    updateTabGroupWorkingStatus(false);
  } else if (msg?.type === "OPEN_PANEL_HERE" && sender.tab) {
    openPanelFor(sender.tab);
  }
});

// ---------------------------------------------------------------------------
// WebSocket to the bridge (127.0.0.1:8765)
// ---------------------------------------------------------------------------
function sendToBridge(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

function dropSocket() {
  const s = ws;
  ws = null;
  if (s) {
    try {
      s.close();
    } catch {}
  }
}

async function pingBridge(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/ping`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function connectBridgeWebSocket() {
  if (wsConnecting) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  wsConnecting = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  chrome.storage.local.get(["bridgePort", "pairingToken"], async (res) => {
    const port = res.bridgePort || 8765;
    if (res.pairingToken) currentToken = res.pairingToken;

    // Ping pre-check: verify bridge HTTP is reachable before opening WebSocket to prevent net::ERR_CONNECTION_REFUSED
    const pingOk = await pingBridge(port);
    if (!pingOk) {
      wsConnecting = false;
      onSocketDown("ping_failed");
      return;
    }

    const url = `ws://127.0.0.1:${port}`;
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      wsConnecting = false;
      onSocketDown(err.message);
      return;
    }
    ws = socket;
    wsConnecting = false;

    socket.onopen = () => {
      if (ws !== socket) {
        try {
          socket.close();
        } catch {}
        return;
      }
      socket.send(JSON.stringify({ type: "auth", token: currentToken, extensionId: chrome.runtime.id, extensionVersion: BUILD }));
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws === socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 20000);
    };

    socket.onmessage = async (evt) => {
      if (ws !== socket) return;
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        logEvent("background", "ws_parse_error", { error: e.message });
        return;
      }
      try {
        await handleServerMessage(msg);
      } catch (e) {
        logEvent("background", "server_message_error", { type: msg?.type, error: e.message });
      }
    };

    socket.onclose = (evt) => {
      if (ws !== socket) return;
      ws = null;
      if (pingInterval) clearInterval(pingInterval);
      lastAgentStatus = null;
      bridgeVersion = null;
      notifyPanels({ type: "connection", connected: false, listening: false });
      updateTabGroupWorkingStatus(false);
      if (evt.code === 4003) authFailed = true;
      onSocketDown(evt.code ? `closed (${evt.code})` : "closed", evt.code);
    };

    socket.onerror = () => {
      // onclose follows and handles reconnecting
    };
  });
}

function onSocketDown(reason, code) {
  failedAttempts += 1;
  if (!offlineSince) {
    offlineSince = Date.now();
    logEvent("background", "bridge_offline", { reason, note: "Retries are silent until the bridge is back." });
  }
  // Wrong token or another window took over: retry slowly instead of hammering.
  const slow = authFailed || code === 4000;
  scheduleReconnect(slow ? 30000 : undefined);
}

function scheduleReconnect(fixedDelay) {
  if (reconnectTimer) return;
  const backoffIdx = Math.min(Math.max(0, failedAttempts - 1), BACKOFF_STEPS.length - 1);
  const delay = fixedDelay || BACKOFF_STEPS[backoffIdx];
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridgeWebSocket();
  }, delay);
}

connectBridgeWebSocket();

/** Skip the backoff and try right now (a panel opened, or the helper asked for us). */
function connectNow(reason) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  logEvent("background", "connect_now", { reason });
  failedAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connectBridgeWebSocket();
}

function isBridgeConnected() {
  return Boolean(ws && ws.readyState === WebSocket.OPEN && bridgeVersion !== null);
}

async function waitForBridge(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (isBridgeConnected()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return isBridgeConnected();
}

// The helper opens http://127.0.0.1:8765/connect when it needs Chrome (for example after /mychrome).
// That page wakes this service worker; we connect, then tidy the tab away.
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "mychrome_wake") return false;
  connectNow("wake_page");
  sendResponse({ ok: true, version: BUILD });
  const fromConnectPage = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/connect/.test(sender.url || "");
  const tabId = sender.tab?.id;
  if (fromConnectPage && typeof tabId === "number") {
    waitForBridge(10000).then(async (ok) => {
      if (!ok) return;
      try {
        const tab = await chrome.tabs.get(tabId);
        const siblings = await chrome.tabs.query({ windowId: tab.windowId });
        // Closing the only tab would close the window (and maybe Chrome): turn it into a new tab instead.
        if (siblings.length > 1) await chrome.tabs.remove(tabId);
        else await chrome.tabs.update(tabId, { url: "chrome://newtab/" });
      } catch {}
    });
  }
  return false;
});

// ---------------------------------------------------------------------------
// Panels (one per tab that has the side panel open)
// ---------------------------------------------------------------------------
function notifyPanels(msg) {
  for (const port of panels.keys()) {
    try {
      port.postMessage(msg);
    } catch {}
  }
}

function stateSync() {
  return {
    type: "state_sync",
    build: BUILD,
    bridgeVersion,
    connected: Boolean(ws && ws.readyState === WebSocket.OPEN && bridgeVersion !== null),
    listening: isListeningState,
    agentStatus: lastAgentStatus,
    taskState: currentTaskState,
    taskLabel: currentTaskLabel,
    history,
    live,
    liveMedia: live ? Object.fromEntries([...media].filter(([cid]) => liveHasCorrelation(cid))) : {},
    question: pendingQuestion,
    log: logStateMessage(),
  };
}

function liveHasCorrelation(cid) {
  if (!live) return false;
  return live.segments.some((seg) => seg.kind === "group" && seg.steps.some((s) => s.correlationId === cid));
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PANEL_PORT) return;
  panels.set(port, { tabId: null, build: null });

  // When a side panel opens, try reconnecting immediately if offline
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    failedAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    connectBridgeWebSocket();
  }

  port.onMessage.addListener(async (msg) => {
    const quiet = ["get_event_log", "get_bridge_log", "get_log_state", "set_log_recording", "clear_event_log", "toggle_verbose", "hello"];
    if (!quiet.includes(msg.type)) {
      logEvent("panel", `panel_msg_${msg.type}`, {
        clientMsgId: msg.clientMsgId,
        action: msg.action,
        hasScreenshot: Boolean(msg.screenshot),
        textLen: typeof msg.text === "string" ? msg.text.length : undefined,
      });
    }

    if (msg.type === "hello") {
      panels.set(port, { tabId: msg.tabId ?? null, build: msg.build || null });
      logEvent("background", "panel_connected", { tabId: msg.tabId, panelBuild: msg.build, match: msg.build === BUILD });
      if (!isBridgeConnected()) connectNow("panel_opened");
      if (msg.build && msg.build !== BUILD) {
        sendToBridge({ type: "client_event", name: "version_mismatch", data: { panel: msg.build, background: BUILD } });
      }
      await storageInitPromise;
      port.postMessage(stateSync());
      return;
    }

    if (msg.type === "chat_message") {
      await storageInitPromise;
      onPanelChatMessage(msg);
    } else if (msg.type === "user_action") {
      if (msg.action === "stop") {
        if (live) live.phase = "stopping";
        notifyPanels({ type: "stopping" });
      } else if (pendingQuestion && msg.correlationId === pendingQuestion.correlationId) {
        pendingQuestion = null;
        notifyPanels({ type: "question_resolved", correlationId: msg.correlationId, action: msg.action, value: msg.value });
      }
      sendToBridge(msg);
    } else if (msg.type === "remove_message") {
      history = history.filter((h) => h.clientMsgId !== msg.clientMsgId);
      saveHistory();
      notifyPanels({ type: "history_removed", clientMsgId: msg.clientMsgId });
    } else if (msg.type === "clear_history") {
      history = [];
      saveHistory(true);
      notifyPanels({ type: "history_cleared" });
    } else if (msg.type === "get_event_log") {
      if (!isStorageLoaded) await storageInitPromise;
      port.postMessage({ type: "event_log_data", events: eventLog, isVerbose: isVerboseMode });
    } else if (msg.type === "clear_event_log") {
      eventLog = [];
      eventSeq = 0;
      if (!isRecording) logSession = { startedAt: null, stoppedAt: null };
      chrome.storage.local.set({ eventLog: [], eventSeq: 0, logSession });
      notifyPanels({ type: "event_log_data", events: [], isVerbose: isVerboseMode });
      notifyPanels(logStateMessage());
    } else if (msg.type === "set_log_recording") {
      await setRecording(Boolean(msg.recording));
    } else if (msg.type === "get_log_state") {
      if (!isStorageLoaded) await storageInitPromise;
      port.postMessage(logStateMessage());
    } else if (msg.type === "toggle_verbose") {
      isVerboseMode = Boolean(msg.verbose);
      chrome.storage.local.set({ isVerboseMode });
      notifyPanels(logStateMessage());
    } else if (msg.type === "get_bridge_log") {
      if (!sendToBridge({ type: "get_bridge_log" })) port.postMessage({ type: "bridge_log", lines: ["Bridge is not connected."] });
    }
  });

  port.onDisconnect.addListener(() => {
    const p = panels.get(port);
    panels.delete(port);
    logEvent("background", "panel_disconnected", { tabId: p?.tabId });
  });
});

// ---------------------------------------------------------------------------
// History and the live turn
// ---------------------------------------------------------------------------
function saveHistory(now = false) {
  if (historySaveTimer) clearTimeout(historySaveTimer);
  const write = () => {
    historySaveTimer = null;
    if (history.length > 80) history = history.slice(-80);
    chrome.storage.local.set({ chatHistory: history });
  };
  if (now) write();
  else historySaveTimer = setTimeout(write, 300);
}

function appendHistory(entry) {
  history.push(entry);
  saveHistory();
  notifyPanels({ type: "history_append", entry });
}

function setUserStatus(cmid, status) {
  const h = history.find((x) => x.clientMsgId === cmid);
  if (h && h.status !== status) {
    h.status = status;
    saveHistory();
  }
}

function onPanelChatMessage(msg) {
  const connected = Boolean(ws && ws.readyState === WebSocket.OPEN);
  const entry = {
    sender: "user",
    clientMsgId: msg.clientMsgId,
    text: String(msg.text || ""),
    timestamp: Date.now(),
    status: connected ? "sent" : "failed",
    queued: Boolean(msg.queued) && connected,
    hasShot: Boolean(msg.screenshot),
    attachments: (msg.attachments || []).map((a) => ({
      name: a.name,
      mime: a.mime,
      size: a.size,
      thumb: a.thumb || null,
    })),
    tab: msg.tab || null,
  };
  appendHistory(entry);
  if (!connected) return;

  if (msg.tab && msg.tab.id) {
    ensureTabInGroup(msg.tab.id);
    if (!live || live.phase === "done") turnOrigin = { tabId: msg.tab.id, agentTab: null };
  }
  // A new request gets its own turn in the panel unless the agent is mid-task (then it rides along).
  if (!entry.queued && (!live || live.final || live.phase === "done")) {
    startLive({ userCmid: entry.clientMsgId });
  }
  ws.send(
    JSON.stringify({
      type: "chat_message",
      clientMsgId: msg.clientMsgId,
      text: entry.text,
      tab: msg.tab,
      screenshot: msg.screenshot,
      attachments: msg.attachments,
      ui_language: msg.ui_language || currentUiLanguage,
    })
  );
}

function startLive({ userCmid = null, turnId = null } = {}) {
  live = createTurn({ userCmid, turnId });
  live.phase = userCmid ? "sending" : "thinking";
  for (const k of [...media.keys()]) if (media.size > 40) media.delete(k);
  notifyPanels({ type: "live_started", live });
  return live;
}

function finishLive(outcome) {
  if (!live) return;
  const turn = live;
  closeTurn(turn, outcome);
  const entry = toHistoryEntry(turn);
  live = null;
  pendingQuestion = null;
  history.forEach((h) => {
    if (h.sender === "user" && (h.status === "sent" || h.status === "delivered") && h.timestamp <= turn.endedAt) h.status = entry.outcome === "final" ? "answered" : h.status;
  });
  appendHistory(entry);
  notifyPanels({ type: "live_finished", id: turn.id, outcome: entry.outcome, seconds: entry.seconds });
  maybeReturnToPanelTab();
}

/** The agent brought another tab to the front during the turn: bring the user back to their panel. */
async function maybeReturnToPanelTab() {
  const { tabId, agentTab } = turnOrigin;
  turnOrigin = { tabId, agentTab: null };
  if (!tabId || !agentTab || tabId === agentTab) return;
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active && active.id === agentTab) {
      await chrome.tabs.update(tabId, { active: true });
      logEvent("background", "returned_to_panel_tab", { from: agentTab, to: tabId });
    }
  } catch {}
}

function noteAgentActivated(tabId) {
  if (turnOrigin.tabId && tabId !== turnOrigin.tabId) turnOrigin.agentTab = tabId;
}

// ---------------------------------------------------------------------------
// Messages from the bridge
// ---------------------------------------------------------------------------
async function handleServerMessage(msg) {
  switch (msg.type) {
    case "pong":
      return;

    case "bridge_log_event":
      if (msg.level === "DEBUG" && !isVerboseMode && !/\[Hook\]/.test(msg.message || "")) return;
      logEvent("bridge", msg.level || "INFO", {
        message: msg.message,
        ...(msg.data && typeof msg.data === "object" ? msg.data : msg.data ? { rawData: msg.data } : {}),
      });
      return;

    case "auth_ok": {
      bridgeVersion = msg.bridgeVersion || "3.x";
      isListeningState = Boolean(msg.listening);
      authFailed = false;
      logEvent("background", "ws_connected", {
        bridgeVersion,
        build: BUILD,
        afterAttempts: failedAttempts,
        offlineMs: offlineSince ? Date.now() - offlineSince : 0,
      });
      offlineSince = null;
      failedAttempts = 0;
      reconnectDelay = 1000;
      sendToBridge({ type: "ui_language", lang: currentUiLanguage });
      notifyPanels({ type: "connection", connected: true, listening: isListeningState, bridgeVersion });
      return;
    }

    case "auth_error":
      authFailed = true;
      logEvent("bridge", "auth_error", { error: msg.error });
      notifyPanels({ type: "auth_error", error: msg.error });
      return;

    case "listening_state":
      isListeningState = Boolean(msg.listening);
      notifyPanels({ type: "connection", connected: true, listening: isListeningState, bridgeVersion });
      return;

    case "agent_status": {
      const prev = lastAgentStatus ? JSON.stringify(lastAgentStatus) : "";
      lastAgentStatus = msg.status;
      if (prev !== JSON.stringify(msg.status)) logEvent("bridge", "agent_status", msg.status || {});
      notifyPanels(msg);
      return;
    }

    case "turn_started":
      currentTurnId = msg.turnId;
      if (detachTimer) {
        clearTimeout(detachTimer);
        detachTimer = null;
      }
      logEvent("bridge", "turn_started", { turnId: msg.turnId, fromUser: msg.fromUser });
      if (!live || live.phase === "done") startLive({ turnId: msg.turnId });
      else if (!live.turnId) live.turnId = msg.turnId;
      notifyPanels({ type: "turn_started", turnId: msg.turnId, liveId: live?.id });
      return;

    case "turn_ended": {
      const s = msg.summary || {};
      logEvent("bridge", "turn_ended", s);
      if (live && (!live.turnId || live.turnId === s.turnId)) {
        if (live.final) {
          // already finished by the final reply
        } else {
          finishLive(s.stoppedByUser ? "stopped" : "no_reply");
        }
      }
      notifyPanels({ type: "turn_ended", summary: s });
      currentTurnId = null;
      scheduleDebuggerDetach();
      return;
    }

    case "activity_event": {
      const ev = msg.event || {};
      logEvent("agent", `tool_${ev.status || "action"}`, {
        tool: ev.tool,
        intent: ev.intent,
        status: ev.status,
        durationMs: ev.durationMs,
        summary: ev.resultSummary ? ev.resultSummary.slice(0, 300) : undefined,
        error: ev.error,
        args: ev.args,
      });
      if (!live || live.phase === "done") startLive({ turnId: ev.turnId || currentTurnId });
      applyActivity(live, ev);
      notifyPanels(msg);
      return;
    }

    case "agent_reply":
      logEvent("agent", `reply_${msg.kind}`, {
        kind: msg.kind,
        text: msg.kind === "progress" ? msg.text : typeof msg.text === "string" ? msg.text.slice(0, 300) : "",
        length: typeof msg.text === "string" ? msg.text.length : 0,
      });
      if (!live || live.phase === "done") {
        // A late answer after Stop belongs to the turn that was stopped.
        const last = history[history.length - 1];
        if (msg.kind === "final" && last && last.sender === "agent" && last.outcome === "stopped" && !last.text) {
          last.text = msg.text;
          saveHistory();
          notifyPanels({ type: "late_final", id: last.id, text: msg.text });
          return;
        }
        startLive({ turnId: msg.turnId || currentTurnId });
      }
      if (msg.kind === "progress") {
        const note = applyProgress(live, msg.text);
        notifyPanels({ type: "agent_progress", liveId: live.id, note });
      } else {
        applyFinal(live, msg.text);
        notifyPanels({ type: "agent_final", liveId: live.id, text: msg.text });
        finishLive("final");
      }
      return;

    case "plan_update": {
      const steps = Array.isArray(msg.steps) ? msg.steps : [];
      logEvent("agent", "plan_update", { done: steps.filter((s) => s.status === "done").length, total: steps.length });
      if (!live || live.phase === "done") startLive({ turnId: msg.turnId || currentTurnId });
      applyPlan(live, steps);
      notifyPanels({ type: "plan_update", liveId: live.id, steps: live.plan });
      return;
    }

    case "ask_user":
    case "request_confirmation":
      logEvent("agent", msg.type, { question: msg.question, summary: msg.summary, options: msg.options });
      pendingQuestion = { ...msg };
      notifyPanels(msg);
      return;

    case "message_ack":
      setUserStatus(msg.clientMsgId, "delivered");
      if (live && (live.phase === "sending" || live.phase === "waking")) live.phase = "thinking";
      logEvent("bridge", "message_ack", { clientMsgId: msg.clientMsgId });
      notifyPanels(msg);
      return;

    case "task_state":
      logEvent("bridge", "task_state", { state: msg.state, label: msg.label, tabId: msg.tabId });
      currentTaskState = msg.state;
      currentTaskLabel = msg.label || "";
      if (msg.tabId) currentTaskTabId = msg.tabId;
      if (live && live.phase !== "done" && !live.final) {
        if (msg.state === "acting") live.phase = "working";
        else if (msg.state === "waiting") live.phase = "waiting";
        else if (msg.state === "thinking") live.phase = live.phase === "sending" ? "waking" : "thinking";
        live.lastEventAt = Date.now();
      }
      if (currentTaskTabId) {
        if (msg.state === "thinking" || msg.state === "acting" || msg.state === "waiting") await updateTabGroupWorkingStatus(true);
        else await updateTabGroupWorkingStatus(false);
        await setOverlayStateOnTab(currentTaskTabId, msg.state, msg.label);
      }
      notifyPanels({ ...msg, phase: live?.phase });
      return;

    case "delivery_error":
      logEvent("bridge", "delivery_error", { error: msg.error, count: (msg.clientMsgIds || []).length });
      (msg.clientMsgIds || []).forEach((id) => setUserStatus(id, "sent"));
      if (live && !live.segments.length && !live.final) {
        live = null;
        notifyPanels({ type: "live_cancelled" });
      }
      notifyPanels(msg);
      return;

    case "system_note":
      logEvent("bridge", "system_note", { code: msg.code });
      if ((msg.code === "queued_asleep" || msg.code === "queued_not_linked") && live && !live.segments.length && !live.final) {
        live = null;
        notifyPanels({ type: "live_cancelled" });
      }
      notifyPanels(msg);
      return;

    case "task_incomplete":
    case "bridge_log":
      notifyPanels(msg);
      return;

    case "browser_command":
      await executeBrowserCommand(msg.correlationId, msg.tool, msg.params || {});
      return;

    default:
      logEvent("bridge", `ws_msg_${msg.type}`, { type: msg.type });
  }
}

// ---------------------------------------------------------------------------
// Overlay and tab group
// ---------------------------------------------------------------------------
async function setOverlayStateOnTab(tabId, state, message, { quiet = false } = {}) {
  if (!tabId) return;
  const ok = await ensureContentScript(tabId);
  if (!ok) return;
  try {
    if (!quiet) logEvent("background", "overlay_state", { tabId, state });
    await chrome.tabs.sendMessage(tabId, { type: "SET_OVERLAY_STATE", state, message, lang: currentUiLanguage });
  } catch {}
}

async function getMyChromeGroup() {
  try {
    const groups = await chrome.tabGroups.query({});
    const existing = groups.find((g) => g.title && (g.title.startsWith("MyChrome") || g.title.startsWith("Antigravity")));
    return existing ? existing.id : null;
  } catch {
    return null;
  }
}
const getAntigravityGroup = getMyChromeGroup;

async function updateTabGroupWorkingStatus(isWorking) {
  try {
    const groupId = await getMyChromeGroup();
    if (groupId) await chrome.tabGroups.update(groupId, { title: isWorking ? "MyChrome ●" : "MyChrome", color: "purple" });
  } catch {}
}

async function ensureTabInGroup(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    let groupId = await getMyChromeGroup();
    if (!groupId) {
      groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, { title: "MyChrome", color: "purple" });
    } else if (tab.groupId !== groupId) {
      await chrome.tabs.group({ tabIds: [tabId], groupId });
    }
  } catch {}
}

/** Inject content.js only when it is not already there. Returns false on pages we cannot touch. */
async function ensureContentScript(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isRestrictedUrl(tab.url)) return false;
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
      if (pong && pong.ok) return true;
    } catch {}
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    logEvent("background", "content_script_injected", { tabId });
    return true;
  } catch {
    return false;
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:") ||
    (url.startsWith("about:") && url !== "about:blank") ||
    url.includes("chromewebstore.google.com") ||
    url.toLowerCase().endsWith(".pdf")
  );
}

function isDomainBlocked(url) {
  if (!url || blocklistDomains.length === 0) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return blocklistDomains.some((b) => host === b || host.endsWith("." + b) || host.split(".").includes(b));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CDP helpers
// ---------------------------------------------------------------------------
async function attachDebugger(tabId) {
  if (activeDebuggers.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    activeDebuggers.add(tabId);
    logEvent("background", "debugger_attach", { tabId });
  } catch (err) {
    if (err.message && err.message.includes("Another debugger is already attached")) {
      activeDebuggers.add(tabId);
    } else {
      logEvent("background", "debugger_attach_failed", { tabId, error: err.message });
      throw err;
    }
  }
  try {
    await chrome.debugger.sendCommand({ tabId }, "Console.enable");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    await chrome.debugger.sendCommand({ tabId }, "Page.enable");
  } catch {}
}

async function sendCDP(tabId, method, params = {}) {
  await attachDebugger(tabId);
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

/** Detach shortly after a turn ends, so Chrome's "started debugging" bar goes away between tasks. */
function scheduleDebuggerDetach() {
  if (detachTimer) clearTimeout(detachTimer);
  detachTimer = setTimeout(async () => {
    detachTimer = null;
    if (live && live.phase !== "done") return;
    for (const tabId of [...activeDebuggers]) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch {}
      activeDebuggers.delete(tabId);
    }
  }, 15000);
}

async function activateIfNeeded(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) {
    await chrome.tabs.update(tabId, { active: true });
    noteAgentActivated(tabId);
    await new Promise((r) => setTimeout(r, 250));
  }
  return tab;
}

function waitForTabComplete(tabId, timeoutMs) {
  let listener = null;
  let timer = null;
  const promise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") resolve(true);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return promise.finally(() => {
    clearTimeout(timer);
    chrome.tabs.onUpdated.removeListener(listener);
  });
}

async function runInPage(tabId, func, args = []) {
  const exec = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return exec[0]?.result;
}

/** Screenshot preview for the side panel (memory only). */
async function makePreview(base64) {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    const scale = Math.min(1, 960 / bmp.width);
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.74 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return `data:image/jpeg;base64,${btoa(s)}`;
  } catch {
    return `data:image/jpeg;base64,${base64}`;
  }
}

const KEY_TABLE = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Esc: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
  Delete: { key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 },
  Space: { key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
  Home: { key: "Home", code: "Home", windowsVirtualKeyCode: 36 },
  End: { key: "End", code: "End", windowsVirtualKeyCode: 35 },
  PageUp: { key: "PageUp", code: "PageUp", windowsVirtualKeyCode: 33 },
  PageDown: { key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 },
};
const MODIFIERS = [
  { names: ["alt", "option"], bit: 1, key: "Alt", code: "AltLeft", vk: 18 },
  { names: ["control", "ctrl"], bit: 2, key: "Control", code: "ControlLeft", vk: 17 },
  { names: ["meta", "command", "cmd", "win"], bit: 4, key: "Meta", code: "MetaLeft", vk: 91 },
  { names: ["shift"], bit: 8, key: "Shift", code: "ShiftLeft", vk: 16 },
];

function keyInfoFor(name) {
  const found = KEY_TABLE[name] || KEY_TABLE[name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
  if (found) return found;
  if (/^F\d{1,2}$/i.test(name)) {
    const n = parseInt(name.slice(1), 10);
    return { key: `F${n}`, code: `F${n}`, windowsVirtualKeyCode: 111 + n };
  }
  if (name.length === 1) {
    const ch = name;
    const up = ch.toUpperCase();
    const code = /[a-z]/i.test(ch) ? `Key${up}` : /\d/.test(ch) ? `Digit${ch}` : "";
    return { key: ch, code, windowsVirtualKeyCode: up.charCodeAt(0), text: ch };
  }
  return { key: name, code: name, windowsVirtualKeyCode: 0 };
}

// ---------------------------------------------------------------------------
// Browser commands
// ---------------------------------------------------------------------------
const NO_PAGE_ACCESS = new Set(["tabs_list", "tabs_create", "tabs_close", "tabs_activate", "navigate", "wait"]);

async function executeBrowserCommand(correlationId, tool, params) {
  const startTime = Date.now();
  logEvent("background", "browser_command_start", { tool, correlationId });
  if (detachTimer) {
    clearTimeout(detachTimer);
    detachTimer = null;
  }
  try {
    const tabId = params.tabId;
    if (tabId) {
      currentTaskTabId = tabId;
      const tab = await chrome.tabs.get(tabId);
      if (!NO_PAGE_ACCESS.has(tool)) {
        if (isRestrictedUrl(tab.url)) {
          logEvent("background", "restricted_url_blocked", { url: tab.url, tool });
          throw new Error(
            `This tab shows a browser page (${tab.url}) that extensions cannot read or control. Use navigate on this same tab to open a website first.`
          );
        }
        if (isDomainBlocked(tab.url)) throw new Error(`The user blocked ${new URL(tab.url).hostname} in the extension settings.`);
      }
    }

    let result = null;

    if (tool === "tabs_list") {
      const tabs = await chrome.tabs.query({});
      const groupId = await getAntigravityGroup();
      const panelTabs = new Set([...panels.values()].map((p) => p.tabId));
      result = tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.active,
        inMyChromeGroup: t.groupId === groupId,
        inAntigravityGroup: t.groupId === groupId,
        hasSidePanel: panelTabs.has(t.id),
      }));
    } else if (tool === "tabs_create") {
      let url = params.url || "about:blank";
      if (url && !url.includes("://") && !url.startsWith("about:")) url = "https://" + url;
      if (isRestrictedUrl(url) && url !== "about:blank") throw new Error(`Opening ${url} is not allowed.`);
      if (isDomainBlocked(url)) throw new Error(`The user blocked ${url} in the extension settings.`);
      const active = params.active === true;
      let index;
      let windowId;
      const opener = turnOrigin.tabId ? await chrome.tabs.get(turnOrigin.tabId).catch(() => null) : null;
      if (opener) {
        index = opener.index + 1;
        windowId = opener.windowId;
      }
      const tab = await chrome.tabs.create({ url, active, index, windowId });
      if (tab.id) await ensureTabInGroup(tab.id);
      if (active) noteAgentActivated(tab.id);
      result = { id: tab.id, url: tab.pendingUrl || tab.url, title: tab.title, active, note: active ? "" : "Opened in the background. Tell the user its name." };
    } else if (tool === "tabs_close") {
      await chrome.tabs.remove(params.tabId);
      result = { closed: params.tabId };
    } else if (tool === "tabs_activate") {
      await chrome.tabs.update(params.tabId, { active: true });
      noteAgentActivated(params.tabId);
      result = { activated: params.tabId };
    } else if (tool === "navigate") {
      let url = String(params.url || "");
      const done = waitForTabComplete(tabId, 30000);
      if (url === "back") await chrome.tabs.goBack(tabId);
      else if (url === "forward") await chrome.tabs.goForward(tabId);
      else if (url === "reload") await chrome.tabs.reload(tabId);
      else {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = "https://" + url;
        if (isRestrictedUrl(url) || /^(javascript|file|data):/i.test(url)) throw new Error(`Navigating to ${url.slice(0, 60)} is not allowed.`);
        if (isDomainBlocked(url)) throw new Error(`The user blocked ${new URL(url).hostname} in the extension settings.`);
        await chrome.tabs.update(tabId, { url });
      }
      const loaded = await done;
      const t = await chrome.tabs.get(tabId);
      result = { finalUrl: t.url, title: t.title, loaded };
    } else if (tool === "read_page") {
      result = (await runInPage(tabId, readPageScript, [params.filter || "interactive"])) || { elements: [] };
    } else if (tool === "find") {
      const matches = (await runInPage(tabId, findScript, [String(params.query || "")])) || [];
      result = { query: params.query, count: matches.length, matches };
    } else if (tool === "get_page_text") {
      result = (await runInPage(tabId, pageTextScript, [params.offset || 0])) || { text: "", offset: 0, total: 0 };
    } else if (tool === "screenshot") {
      await activateIfNeeded(tabId);
      await ensureContentScript(tabId);
      try {
        await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_SCREENSHOT" });
      } catch {}
      let shot;
      try {
        shot = await sendCDP(tabId, "Page.captureScreenshot", { format: "jpeg", quality: 70 });
      } finally {
        try {
          await chrome.tabs.sendMessage(tabId, { type: "RESTORE_AFTER_SCREENSHOT" });
        } catch {}
      }
      result = { dataUrl: `data:image/jpeg;base64,${shot.data}` };
      makePreview(shot.data).then((image) => {
        media.set(correlationId, image);
        if (media.size > 40) media.delete(media.keys().next().value);
        notifyPanels({ type: "step_media", correlationId, image });
      });
    } else if (tool === "click") {
      await ensureContentScript(tabId);
      let x = params.x;
      let y = params.y;
      let target = "";
      if (params.ref) {
        const res = await runInPage(tabId, resolveClickScript, [params.ref]);
        if (!res || res.error) throw new Error(res?.error || `Element with ref '${params.ref}' not found`);
        x = res.x;
        y = res.y;
        target = res.name || res.tag || "";
      }
      if (x === undefined || y === undefined) throw new Error("Give a ref or x and y to click.");
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_CLICK_CUE", x, y });
        await new Promise((r) => setTimeout(r, 320));
      } catch {}
      const button = params.button || "left";
      const clickCount = params.clickCount || 1;
      const modifiers = params.modifiers || 0;
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers });
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount, modifiers });
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount, modifiers });
      result = { clicked: { x, y }, target };
    } else if (tool === "hover") {
      let x = params.x;
      let y = params.y;
      if (params.ref) {
        const c = await runInPage(tabId, refCenterScript, [params.ref]);
        if (!c) throw new Error(`Element with ref '${params.ref}' not found`);
        x = c.x;
        y = c.y;
      }
      if (x === undefined || y === undefined) throw new Error("Give a ref or x and y to hover.");
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      result = { hovered: { x, y } };
    } else if (tool === "scroll_to") {
      const okScroll = await runInPage(tabId, scrollToRefScript, [params.ref]);
      if (!okScroll) throw new Error(`Element with ref '${params.ref}' not found`);
      result = { scrolledTo: params.ref };
    } else if (tool === "scroll") {
      result = await doScroll(tabId, params);
    } else if (tool === "type") {
      let field = "";
      if (params.ref) {
        const safety = await runInPage(tabId, typeSafetyScript, [params.ref]);
        if (!safety || !safety.found) throw new Error(`Element with ref '${params.ref}' not found`);
        if (safety.isSensitive) throw new Error("Blocked: typing into password or card fields is not allowed. Ask the user to type it.");
        field = safety.name || "";
        try {
          await chrome.tabs.sendMessage(tabId, { type: "HIGHLIGHT_ELEMENT", selector: `[data-antigravity-ref="${params.ref}"]` });
        } catch {}
      }
      if (params.clear) {
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
      }
      if (params.slowly) {
        for (const char of String(params.text || "")) {
          await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyDown", text: char });
          await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp" });
          await new Promise((r) => setTimeout(r, 30));
        }
      } else {
        await sendCDP(tabId, "Input.insertText", { text: String(params.text || "") });
      }
      if (params.submit) {
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
        await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      }
      result = { typed: String(params.text || "").length + " characters", field, submitted: Boolean(params.submit) };
    } else if (tool === "press_key") {
      const raw = String(params.keys || "");
      const parts = raw.split("+").map((p) => p.trim()).filter(Boolean);
      const mainName = parts.pop() || "";
      const mods = MODIFIERS.filter((m) => parts.some((p) => m.names.includes(p.toLowerCase())));
      const bits = mods.reduce((a, m) => a | m.bit, 0);
      const info = keyInfoFor(mainName);
      for (const m of mods) await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: m.key, code: m.code, windowsVirtualKeyCode: m.vk, modifiers: bits });
      await sendCDP(tabId, "Input.dispatchKeyEvent", {
        type: info.text && !(bits & 2) && !(bits & 4) ? "keyDown" : "rawKeyDown",
        key: info.key,
        code: info.code,
        windowsVirtualKeyCode: info.windowsVirtualKeyCode,
        text: bits & 2 || bits & 4 ? undefined : info.text,
        modifiers: bits,
      });
      await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: info.key, code: info.code, windowsVirtualKeyCode: info.windowsVirtualKeyCode, modifiers: bits });
      for (const m of mods.reverse()) await sendCDP(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: m.key, code: m.code, windowsVirtualKeyCode: m.vk });
      result = { pressed: raw };
    } else if (tool === "drag") {
      const { from, to } = params;
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y });
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", clickCount: 1 });
      for (let i = 1; i <= 8; i++) {
        await sendCDP(tabId, "Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: Math.round(from.x + (to.x - from.x) * (i / 8)),
          y: Math.round(from.y + (to.y - from.y) * (i / 8)),
          button: "left",
        });
        await new Promise((r) => setTimeout(r, 30));
      }
      await sendCDP(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1 });
      result = { dragged: { from, to } };
    } else if (tool === "upload_file") {
      const doc = await sendCDP(tabId, "DOM.getDocument");
      const q = await sendCDP(tabId, "DOM.querySelector", { nodeId: doc.root.nodeId, selector: `[data-antigravity-ref="${params.ref}"]` });
      if (!q.nodeId) throw new Error(`Could not find the file input '${params.ref}'`);
      await sendCDP(tabId, "DOM.setFileInputFiles", { files: params.paths, nodeId: q.nodeId });
      result = { uploaded: (params.paths || []).length + " file(s)" };
    } else if (tool === "wait") {
      result = await doWait(tabId, params);
    } else if (tool === "execute_javascript") {
      result = await doEvaluate(tabId, String(params.code || ""));
    } else if (tool === "handle_dialog") {
      await sendCDP(tabId, "Page.handleJavaScriptDialog", { accept: params.accept, promptText: params.promptText });
      activeDialogsByTab.delete(tabId);
      result = { dialogHandled: true, accept: params.accept };
    } else if (tool === "read_console") {
      await attachDebugger(tabId);
      const list = consoleLogsByTab.get(tabId) || [];
      result = { count: list.length, messages: list.slice(-60) };
    } else if (tool === "read_network") {
      await attachDebugger(tabId);
      const list = (networkLogsByTab.get(tabId) || []).filter((x) => x.url || x.failed);
      const failed = list.filter((x) => x.failed || (x.status && x.status >= 400));
      result = { count: list.length, failedCount: failed.length, failed: failed.slice(-20), recent: list.slice(-40) };
    } else if (tool === "form_input") {
      const okInput = await runInPage(tabId, formInputScript, [params.ref, params.value]);
      if (!okInput) throw new Error(`Element with ref '${params.ref}' not found`);
      result = { set: true };
    } else {
      throw new Error(`Unknown browser command: ${tool}. Reload the extension if the bridge is newer.`);
    }

    const durationMs = Date.now() - startTime;
    let summary = typeof result === "string" ? result : JSON.stringify(result ?? "");
    summary = redactString(summary);
    if (summary.length > 300) summary = summary.slice(0, 300) + "...";
    logEvent("background", "browser_command", { tool, params, durationMs, success: true, summary });
    sendToBridge({ type: "browser_command_result", correlationId, result });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logEvent("background", "browser_command", { tool, params, durationMs, success: false, error: err.message });
    sendToBridge({ type: "browser_command_result", correlationId, error: err.message });
  }
}

async function doScroll(tabId, params) {
  const amount = Math.max(1, Math.abs(params.amount || 600));
  const dir = params.direction || "down";
  const axis = dir === "left" || dir === "right" ? "x" : "y";
  const sign = dir === "up" || dir === "left" ? -1 : 1;
  let x = params.x;
  let y = params.y;
  if (params.ref) {
    const c = await runInPage(tabId, refCenterScript, [params.ref]);
    if (c) {
      x = c.x;
      y = c.y;
    }
  }
  const before = await runInPage(tabId, scrollProbeScript, [x ?? -1, y ?? -1, axis, 0]);
  if (x === undefined || y === undefined) {
    x = Math.round((before?.viewport?.width || 1280) / 2);
    y = Math.round((before?.viewport?.height || 720) / 2);
  }
  const probeAt = await runInPage(tabId, scrollProbeScript, [x, y, axis, 0]);
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SHOW_SCROLL_CUE", direction: dir });
  } catch {}
  await sendCDP(tabId, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: axis === "x" ? sign * amount : 0,
    deltaY: axis === "y" ? sign * amount : 0,
  });
  await new Promise((r) => setTimeout(r, 160));
  let after = await runInPage(tabId, scrollProbeScript, [x, y, axis, 0]);
  let method = "wheel";
  if (after && probeAt && after.container === probeAt.container && after.position === probeAt.position) {
    // The page ignored the wheel: scroll the container directly.
    after = await runInPage(tabId, scrollProbeScript, [x, y, axis, sign * amount]);
    method = "direct";
  }
  const moved = after && probeAt ? after.position - probeAt.position : 0;
  const atEnd = after ? (sign > 0 ? after.position >= after.max - 2 : after.position <= 2) : false;
  return {
    scrolled: dir,
    moved: Math.abs(moved),
    container: after?.container || "page",
    position: after?.position ?? null,
    max: after?.max ?? null,
    atEnd,
    method,
  };
}

async function doWait(tabId, params) {
  const cond = params.condition;
  const timeoutMs = Math.min(Math.max(params.timeout_ms || 10000, 100), 60000);
  if (cond === "time") {
    await new Promise((r) => setTimeout(r, timeoutMs));
    return { condition: "time", waitedMs: timeoutMs };
  }
  if (cond === "load") {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return { condition: "load", waited: false, alreadyLoaded: true };
    const loaded = await waitForTabComplete(tabId, timeoutMs);
    return { condition: "load", waited: true, loaded };
  }
  if (cond === "network_idle") {
    await attachDebugger(tabId);
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const last = (networkLogsByTab.get(tabId) || {}).lastRequestAt || 0;
      if (Date.now() - last > 500) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return { condition: "network_idle", waitedMs: Date.now() - t0 };
  }
  if (cond === "selector") {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await runInPage(tabId, selectorExistsScript, [params.value])) return { condition: "selector", found: true, waitedMs: Date.now() - t0 };
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Selector '${params.value}' not found within ${timeoutMs}ms`);
  }
  throw new Error(`Unknown wait condition: ${cond}`);
}

/** Evaluate code. A top-level return/await is allowed: on that syntax error we retry inside an async function. */
async function doEvaluate(tabId, code) {
  const evalOnce = (expression) =>
    sendCDP(tabId, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  let res = await evalOnce(code);
  const desc = (r) => r.exceptionDetails?.exception?.description || r.exceptionDetails?.text || "Unknown error";
  if (res.exceptionDetails && /Illegal return statement|await is only valid|Unexpected reserved word/i.test(desc(res))) {
    res = await evalOnce(`(async () => {\n${code}\n})()`);
  }
  if (res.exceptionDetails) {
    const message = String(desc(res)).split("\n")[0].slice(0, 400);
    throw new Error(`JavaScript error: ${message}`);
  }
  const value = res.result?.value;
  if (value === undefined && res.result?.type === "object" && res.result?.subtype === "node") {
    return { value: null, note: "The code returned a DOM element. Return plain data (text, numbers, arrays) instead." };
  }
  return { value: value === undefined ? null : value, type: res.result?.type };
}
