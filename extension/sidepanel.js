// sidepanel.js - Antigravity side panel v4
// Talks to background.js over a runtime port. background.js talks to the bridge over WebSocket.

import {
  createTurn,
  applyActivity,
  applyProgress,
  applyPlan,
  findStepByCorrelation,
  countSteps,
  fromLegacyEntry,
} from "./shared/turn-model.js";

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Icons (line icons, 24px grid, drawn with currentColor)
// ---------------------------------------------------------------------------
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  "arrow-up": '<path d="m5 12 7-7 7 7M12 19V5"/>',
  "arrow-down": '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-check": '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pointer: '<path d="M12.586 12.586 19 19M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>',
  keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  scroll: '<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  list: '<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  log: '<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1.2"/>',
  telegram: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
};

function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const PANEL_BUILD = "5.2.0";
const QUIET_AFTER_MS = 90000;

const params = new URLSearchParams(location.search);
const BOUND_TAB = params.has("tab") ? parseInt(params.get("tab"), 10) : null;

const defaultLang = (chrome.i18n?.getUILanguage?.() || "").toLowerCase().startsWith("ar") ? "ar" : "en";

const state = {
  lang: localStorage.getItem("ag_lang") || defaultLang,
  theme: document.documentElement.getAttribute("data-theme") || "light",
  locales: {},
  port: null,
  connected: false,
  listening: false,
  agentStatus: null,
  taskState: "idle",
  taskLabel: "",
  currentTab: null,
  attachShot: false,
  attachments: [], // [{ name, mime, size, data, thumb, isImage }]
  history: [],
  live: null, // { model, el, ...ui refs }
  media: {}, // correlationId -> data URL
  question: null,
  stick: true,
  versions: { background: null, bridge: null },
  log: { recording: false, startedAt: null, stoppedAt: null, count: 0, verbose: false },
  logEvents: [],
  logFilter: "all",
  bridgeLines: [],
  waiters: new Map(),
  synced: false,
};

const SUGGESTIONS = [
  { key: "s1", tone: "pink", icon: "file-text", chip: "chipReads" },
  { key: "s2", tone: "peach", icon: "message", chip: "chipReads" },
  { key: "s3", tone: "lilac", icon: "pencil", chip: "chipActs" },
  { key: "s4", tone: "mint", icon: "scale", chip: "chipReads" },
];

const uiDir = () => (state.lang === "ar" ? "rtl" : "ltr");
const reduceMotion = () =>
  document.documentElement.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Shared turn model (same reducer as the background worker)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Labels: everything the panel writes follows the panel language
// ---------------------------------------------------------------------------
function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return t("sec", { s: total });
  return t("minsec", { m: Math.floor(total / 60), s: total % 60 });
}

function hostOf(url) {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return String(url || "").slice(0, 40);
  }
}

function clipText(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** "Opened linkedin.com", "Captured page", "Scrolled down"... in the panel language. */
function stepLabel(step) {
  const a = step.args || {};
  const r = step.result || {};
  const running = step.status === "running";
  const k = (name) => `lbl_${name}_${running ? "run" : "done"}`;
  let label;
  switch (step.tool) {
    case "navigate": {
      const u = String(a.url || "");
      if (u === "back" || u === "forward" || u === "reload") label = t(k(u));
      else label = t(k("navigate"), { host: hostOf(r.finalUrl || u) });
      break;
    }
    case "scroll":
      label = t(k(`scroll_${a.direction || "down"}`));
      break;
    case "wait":
      if (a.condition === "time") label = t(k("wait_time"), { s: fmtElapsed(a.timeout_ms || 1000) });
      else if (a.condition === "load") label = t(k("wait_load"));
      else label = t(k("wait_other"));
      break;
    case "find":
      label = t(k("find"), { q: clipText(a.query, 30) });
      break;
    case "press_key":
      label = t(k("press_key"), { keys: String(a.keys || "").toLowerCase() });
      break;
    case "click":
      label = !running && r.target ? t("lbl_click_done_named", { name: clipText(r.target, 34) }) : t(k("click"));
      break;
    case "type":
      label = !running && a.text && String(a.text).length <= 40 ? t("lbl_type_done_text", { text: clipText(a.text, 30) }) : t(k("type"));
      break;
    case "tabs_create":
      label = !running && a.url ? t("lbl_tabs_create_done_host", { host: hostOf(a.url) }) : t(k("tabs_create"));
      break;
    default: {
      const key = k(step.tool);
      const v = t(key);
      label = v === key ? t(k("generic"), { tool: step.tool }) : v;
    }
  }
  if (step.status === "error") label = t("lbl_failed", { label });
  return label;
}

function phaseLabel(phase) {
  return t(`phase_${phase}`) || t("phase_thinking");
}

// ---------------------------------------------------------------------------
// Status helpers used by the status pill
// ---------------------------------------------------------------------------
function isLive() {
  return Boolean(state.live && !state.live.done);
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pdf",
  ".txt", ".md", ".csv", ".json", ".html", ".xml",
  ".docx", ".xlsx", ".pptx",
]);

function isAllowedFile(file) {
  const name = file.name || "";
  const extMatch = name.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  if (ALLOWED_EXTS.has(ext)) return true;
  if (file.type) {
    const t = file.type.toLowerCase();
    if (t.startsWith("image/") || t.startsWith("text/") || t === "application/pdf") return true;
    if (t.includes("officedocument") || t.includes("word") || t.includes("excel") || t.includes("powerpoint")) return true;
  }
  return false;
}

async function downscaleImageIfNeeded(dataUrl, mime = "image/jpeg") {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 2000;
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      let w = img.width;
      let h = img.height;
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(mime.includes("png") ? "image/png" : "image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function createThumbnail(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const ox = (size - sw) / 2;
      const oy = (size - sh) / 2;
      ctx.drawImage(img, ox, oy, sw, sh);
      const thumb = canvas.toDataURL("image/jpeg", 0.6);
      resolve(thumb.length <= 8192 ? thumb : null);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    if (state.attachments.length >= MAX_ATTACHMENTS) {
      toast(t("attachMaxFiles"), "alert");
      break;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast(t("attachMaxSize"), "alert");
      continue;
    }
    if (!isAllowedFile(file)) {
      toast(t("attachInvalidType"), "alert");
      continue;
    }
    try {
      let dataUrl = await readFileAsDataUrl(file);
      const isImg = file.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      let thumb = null;
      if (isImg) {
        dataUrl = await downscaleImageIfNeeded(dataUrl, file.type || "image/jpeg");
        thumb = await createThumbnail(dataUrl);
      }
      state.attachments.push({
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        data: dataUrl,
        thumb,
        isImage: isImg,
      });
    } catch (err) {
      console.warn("Failed to process attachment", file.name, err);
    }
  }
  renderAttachmentTray();
  renderSendButton();
}

async function captureTabScreenshot() {
  if (state.attachments.length >= MAX_ATTACHMENTS) {
    toast(t("attachMaxFiles"), "alert");
    return;
  }
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(state.currentTab?.windowId ?? null, { format: "jpeg", quality: 85 });
    if (!dataUrl) return;
    const downscaled = await downscaleImageIfNeeded(dataUrl, "image/jpeg");
    const thumb = await createThumbnail(downscaled);
    const commaIdx = downscaled.indexOf(",");
    const rawB64 = commaIdx !== -1 ? downscaled.slice(commaIdx + 1) : downscaled;
    const size = Math.round((rawB64.length * 3) / 4);
    const name = `screenshot-${Date.now().toString().slice(-4)}.jpg`;
    state.attachments.push({
      name,
      mime: "image/jpeg",
      size,
      data: downscaled,
      thumb,
      isImage: true,
    });
    renderAttachmentTray();
    renderSendButton();
  } catch (err) {
    console.warn("captureVisibleTab failed", err);
  }
}

function renderAttachmentTray() {
  const tray = $("attachmentTray");
  if (!tray) return;
  if (!state.attachments || !state.attachments.length) {
    tray.hidden = true;
    tray.innerHTML = "";
    return;
  }
  tray.hidden = false;
  tray.innerHTML = state.attachments
    .map((att, idx) => {
      const isImg = att.isImage || att.mime?.startsWith("image/");
      const thumbHtml = att.thumb || (isImg && att.data)
        ? `<img src="${esc(att.thumb || att.data)}" class="attach-chip-thumb" alt="">`
        : `<span class="attach-chip-icon">${icon("file-text")}</span>`;
      return `
        <div class="attach-chip" data-idx="${idx}">
          ${thumbHtml}
          <span class="attach-chip-name" title="${esc(att.name)}">${esc(att.name)}</span>
          <span class="attach-chip-size">${formatBytes(att.size)}</span>
          <button type="button" class="attach-chip-remove" data-remove="${idx}" aria-label="Remove">
            ${icon("x")}
          </button>
        </div>`;
    })
    .join("");

  tray.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.remove, 10);
      state.attachments.splice(idx, 1);
      renderAttachmentTray();
      renderSendButton();
    });
  });
}

function renderSendButton() {
  const hasText = Boolean($("input").value.trim());
  const hasAttachments = Boolean(state.attachments?.length);
  const working = isWorking();
  const send = $("sendBtn");
  send.disabled = !hasText && !hasAttachments;
  send.title = t("send");
  send.setAttribute("aria-label", t("send"));
  const stop = $("stopBtn");
  stop.hidden = !working;
  stop.title = t("stop");
  stop.setAttribute("aria-label", t("stop"));
}

async function updateTab() {
  try {
    let tab = null;
    if (BOUND_TAB !== null && !Number.isNaN(BOUND_TAB)) tab = await chrome.tabs.get(BOUND_TAB).catch(() => null);
    if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    state.currentTab = tab;
    let domain = "";
    try {
      domain = new URL(tab.url).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
    $("tabDomain").textContent = domain || tab.title || "tab";
    $("contextPill").title = `${t("focusTab")}: ${tab.title || ""}`;
    const fav = $("tabFavicon");
    fav.src = tab.favIconUrl && /^https?:|^data:/.test(tab.favIconUrl) ? tab.favIconUrl : "icons/icon32.png";
    fav.onerror = () => {
      fav.src = "icons/icon32.png";
    };
  } catch (err) {
    console.warn("tab query failed", err);
  }
}

async function send(override) {
  const input = $("input");
  const text = (override ?? input.value).trim();
  const attachmentsToSend = [...(state.attachments || [])];
  if ((!text && !attachmentsToSend.length) || !state.port) return;

  let screenshot = null;
  const shotAtt = attachmentsToSend.find((a) => a.isImage && a.name.startsWith("screenshot-"));
  if (shotAtt) {
    screenshot = shotAtt.data;
  }

  const st = computeStatus();
  const msg = {
    type: "chat_message",
    clientMsgId: `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: text || "",
    tab: state.currentTab ? { id: state.currentTab.id, url: state.currentTab.url, title: state.currentTab.title } : null,
    screenshot,
    attachments: attachmentsToSend.map((a) => ({
      name: a.name,
      mime: a.mime,
      size: a.size,
      thumb: a.thumb,
      data: a.data,
    })),
    ui_language: state.lang,
    queued: !["ready", "working"].includes(st),
  };
  if (override === undefined) {
    input.value = "";
    autosize();
  }
  state.attachments = [];
  renderAttachmentTray();
  state.stick = true;
  state.port.postMessage(msg);
  renderSendButton();
}

function stopAgent() {
  state.port?.postMessage({ type: "user_action", action: "stop" });
  if (state.live) setPhase("stopping");
}

// ---------------------------------------------------------------------------
// User messages
// ---------------------------------------------------------------------------
function tickIcon(status) {
  if (status === "answered" || status === "delivered") return icon("check-check");
  if (status === "failed") return icon("alert");
  return icon("check");
}
function tickTitle(status) {
  return { answered: t("answeredTitle"), delivered: t("deliveredTitle"), failed: t("failedNote") }[status] || t("sentTitle");
}

function renderUser(entry, { animate = true } = {}) {
  const row = document.createElement("div");
  row.className = "u-row";
  if (!animate) row.style.animation = "none";
  row.dataset.cmid = entry.clientMsgId || "";

  let attachChipsHtml = "";
  if (entry.attachments && entry.attachments.length > 0) {
    attachChipsHtml = `<div class="u-attach-chips">${entry.attachments
      .map((a) => {
        const isImg = a.mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(a.name);
        const thumbHtml = a.thumb
          ? `<img src="${esc(a.thumb)}" class="u-attach-chip-thumb" alt="">`
          : (isImg ? icon("image") : icon("file-text"));
        return `<div class="u-attach-chip" title="${esc(a.name)}">${thumbHtml}<span class="u-attach-chip-name">${esc(a.name)}</span><span class="u-attach-chip-size">${formatBytes(a.size)}</span></div>`;
      })
      .join("")}</div>`;
  }

  row.innerHTML = `
    <div class="u-bubble" dir="auto"></div>
    ${attachChipsHtml}
    ${entry.hasShot && (!entry.attachments || !entry.attachments.length) ? `<span class="u-shot-chip">${icon("image")}<span>${esc(t("shotAttached"))}</span></span>` : ""}
    <div class="u-meta"><span>${formatTime(entry.timestamp)}</span><span class="tick" data-st="${entry.status}" title="${esc(tickTitle(entry.status))}">${tickIcon(entry.status)}</span></div>`;

  const bubble = row.querySelector(".u-bubble");
  if (entry.text) {
    bubble.textContent = entry.text;
  } else {
    bubble.style.display = "none";
  }

  if (entry.attachments?.length) {
    row.querySelectorAll(".u-attach-chip").forEach((chip, i) => {
      const att = entry.attachments[i];
      if (att && att.thumb) {
        chip.style.cursor = "pointer";
        chip.addEventListener("click", () => openLightbox(att.thumb, att.name));
      }
    });
  }

  if (entry.status === "failed") addFlag(row, "failed");
  else if (entry.queued && entry.status === "sent") addFlag(row, "queued");
  else if (entry.status === "sent" && isLive() && state.live.model.userCmid !== entry.clientMsgId) addFlag(row, "busy");
  $("thread").appendChild(row);
  return row;
}

function addFlag(row, kind) {
  row.querySelector(".u-flag")?.remove();
  row.dataset.flag = kind;
  const flag = document.createElement("div");
  flag.className = "u-flag";
  flag.dataset.kind = kind;
  if (kind === "failed") {
    flag.innerHTML = `${icon("alert")}<span dir="auto">${esc(t("failedNote"))}</span><button type="button" class="link-btn">${esc(t("retry"))}</button>`;
    flag.querySelector("button").addEventListener("click", () => {
      const text = row.querySelector(".u-bubble").textContent;
      state.port?.postMessage({ type: "remove_message", clientMsgId: row.dataset.cmid });
      row.remove();
      send(text);
    });
  } else {
    flag.innerHTML = `${icon("clock")}<span dir="auto">${esc(t(kind === "busy" ? "queuedBusy" : "queuedNote"))}</span>`;
  }
  row.appendChild(flag);
}

function setUserStatus(cmid, status) {
  const h = state.history.find((x) => x.clientMsgId === cmid);
  if (h) h.status = status;
  const row = document.querySelector(`.u-row[data-cmid="${CSS.escape(cmid)}"]`);
  if (!row) return;
  const tick = row.querySelector(".tick");
  tick.dataset.st = status;
  tick.title = tickTitle(status);
  tick.innerHTML = tickIcon(status);
  if (status !== "sent") {
    row.querySelector(".u-flag")?.remove();
    delete row.dataset.flag;
  }
}

// ---------------------------------------------------------------------------
// Agent turns
// ---------------------------------------------------------------------------
/** Build the DOM shell of a turn. */
function turnShell(id) {
  const el = document.createElement("div");
  el.className = "a-turn";
  el.dataset.id = id;
  el.dir = uiDir();
  el.innerHTML = `
    <div class="segs"></div>
    <div class="status-line" hidden><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="s-label shimmer"></span><span class="s-time"></span></div>
    <div class="quiet-hint" dir="auto" hidden></div>
    <div class="prose final" hidden></div>
    <div class="outcome-slot"></div>
    <div class="a-actions" hidden>
      <button class="act-btn" type="button" data-act="copy">${icon("copy")}</button>
      <button class="act-btn" type="button" data-act="retry">${icon("refresh")}</button>
      <span class="a-time"></span>
    </div>`;
  el.querySelector('[data-act="copy"]').addEventListener("click", () => copyText(el.querySelector(".prose.final").innerText));
  el.querySelector('[data-act="retry"]').addEventListener("click", () => {
    const cmid = el.dataset.user;
    const u = state.history.find((h) => h.clientMsgId === cmid);
    if (u) send(u.text);
  });
  return el;
}

function actionTitles(el) {
  el.querySelector('[data-act="copy"]').title = t("copy");
  el.querySelector('[data-act="copy"]').setAttribute("aria-label", t("copy"));
  el.querySelector('[data-act="retry"]').title = t("retry");
  el.querySelector('[data-act="retry"]').setAttribute("aria-label", t("retry"));
}

/** A tool group card. */
function groupCard(group, { live = false, open = live } = {}) {
  const card = document.createElement("div");
  card.className = "group-card";
  card.dataset.gid = group.id;
  card.dataset.live = String(live);
  card.dataset.open = String(open);
  card.innerHTML = `
    <button class="g-head" type="button" aria-expanded="${open}">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="g-ic">${icon("globe")}</span>
      <span class="g-label"></span>
      <span class="g-time"></span>
      ${icon("chevron-down", "chev")}
      <span class="g-shots" hidden></span>
    </button>
    <div class="g-body"><div class="g-inner"></div></div>`;
  card.querySelector(".g-head").addEventListener("click", (e) => {
    if (e.target.closest(".g-shots")) return;
    const now = card.dataset.open !== "true";
    card.dataset.open = String(now);
    card.querySelector(".g-head").setAttribute("aria-expanded", String(now));
  });
  return card;
}

function renderGroupHead(card, group, { live, startedAt }) {
  const { n, shots } = countGroup(group);
  const label = card.querySelector(".g-label");
  const time = card.querySelector(".g-time");
  card.dataset.live = String(Boolean(live));
  if (live) {
    const phase = state.live?.model.phase === "working" ? "working" : state.live?.model.phase || "working";
    const text = phase === "working" ? t("groupLive") : phaseLabel(phase === "sending" ? "thinking" : phase);
    setSwapText(label, text);
    label.classList.add("shimmer");
    time.textContent = fmtElapsed(Date.now() - startedAt);
  } else {
    label.classList.remove("shimmer");
    label.textContent = `${t("groupDone")} · ${n === 1 ? t("stepsOne") : t("stepsCount", { n })}`;
    time.textContent = group.ms && group.ms >= 1000 ? fmtElapsed(group.ms) : "";
  }
  // Thumbnail of the latest screenshot (visible when the card is collapsed)
  const shotsEl = card.querySelector(".g-shots");
  const shotSteps = group.steps.filter((s) => s.shot && state.media[s.correlationId]);
  if (shotSteps.length) {
    const last = shotSteps[shotSteps.length - 1];
    const src = state.media[last.correlationId];
    shotsEl.hidden = false;
    shotsEl.innerHTML = `<img class="g-thumb" alt="" src="${src}">${shotSteps.length > 1 ? `<span class="g-more">+${shotSteps.length - 1}</span>` : ""}<img class="g-preview" alt="" src="${src}">`;
    shotsEl.querySelector(".g-thumb").onclick = (e) => {
      e.stopPropagation();
      openLightbox(src, stepLabel(last));
    };
  } else if (shots === 0) {
    shotsEl.hidden = true;
    shotsEl.innerHTML = "";
  }
}

function groupWallMs(g) {
  const starts = g.steps.map((s) => s.start).filter(Boolean);
  const ends = g.steps.map((s) => s.end || Date.now()).filter(Boolean);
  if (!starts.length) return g.steps.reduce((a, s) => a + (s.ms || 0), 0);
  return Math.max(...ends) - Math.min(...starts);
}

/** Position of an element inside the scrolling chat area. */
function posInChat(el) {
  const chat = $("chat");
  return el.getBoundingClientRect().top - chat.getBoundingClientRect().top + chat.scrollTop;
}

function countGroup(group) {
  let n = 0;
  let shots = 0;
  for (const s of group.steps) {
    n += 1;
    if (s.shot) shots += 1;
  }
  return { n, shots };
}

/** Syntax-colored JSON for the Request / Response boxes. */
function jsonHTML(value) {
  let text;
  if (typeof value === "string") {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return esc(value);
    }
  } else text = JSON.stringify(value ?? null, null, 2);
  return esc(text)
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s(&quot;.*?&quot;)/g, ': <span class="s">$1</span>')
    .replace(/:\s(-?\d+(?:\.\d+)?|true|false|null)/g, ': <span class="n">$1</span>');
}

/** One row per browser action: label, the agent's intent while it runs, details on click. */
function stepRow(step, { animate = true } = {}) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.sid = step.id;
  row.dataset.open = "false";
  if (!animate) row.style.animation = "none";
  row.innerHTML = `
    <button class="row-head" type="button">
      <span class="row-label" dir="auto"></span>
      <span class="row-state"></span>
      ${icon("chevron-down", "chev")}
    </button>
    <span class="row-intent" dir="auto" hidden></span>
    <div class="row-media"></div>
    <div class="row-detail"><div class="row-detail-inner"></div></div>`;
  row.querySelector(".row-head").addEventListener("click", () => {
    const open = row.dataset.open !== "true";
    row.dataset.open = String(open);
    if (open) fillDetail(row, step);
  });
  updateStepRow(row, step, { animate });
  return row;
}

function fillDetail(row, step) {
  const box = row.querySelector(".row-detail-inner");
  const parts = [];
  if (step.intent) parts.push(`<div class="kv"><div class="kv-title">${esc(t("why"))}</div><pre dir="auto" style="direction:auto;text-align:start;font-family:var(--font)">${esc(step.intent)}</pre></div>`);
  parts.push(`<div class="kv"><div class="kv-title">${esc(t("req"))}</div><pre>${jsonHTML(step.args || {})}</pre></div>`);
  if (step.status !== "running") {
    const res = step.error ? { error: step.error } : step.summary || step.result || null;
    parts.push(`<div class="kv"><div class="kv-title">${esc(t("res"))}</div><pre>${jsonHTML(res)}</pre></div>`);
  }
  box.innerHTML = parts.join("");
}

function updateStepRow(row, step, { animate = true } = {}) {
  row.dataset.status = step.status;
  const label = row.querySelector(".row-label");
  const text = stepLabel(step);
  if (label.textContent !== text) {
    label.textContent = text;
    if (animate && !reduceMotion()) {
      label.classList.remove("swap");
      void label.offsetWidth;
      label.classList.add("swap");
    }
  }
  label.classList.toggle("shimmer", step.status === "running");
  row.querySelector(".row-state").innerHTML = step.status === "error" ? icon("alert") : "";
  const intentEl = row.querySelector(".row-intent");
  if (step.status === "running" && step.intent) {
    intentEl.hidden = false;
    if (intentEl.dataset.text !== step.intent) {
      intentEl.dataset.text = step.intent;
      typeText(intentEl, step.intent, { animate });
    }
  } else {
    intentEl.hidden = true;
  }
  // Screenshot preview, shown under the row
  const mediaEl = row.querySelector(".row-media");
  if (step.shot && step.status !== "error") {
    const src = state.media[step.correlationId];
    if (src && !mediaEl.querySelector("img")) {
      mediaEl.innerHTML = `<button class="row-shot" type="button"><img alt=""></button>`;
      const img = mediaEl.querySelector("img");
      img.src = src;
      mediaEl.querySelector("button").onclick = () => openLightbox(src, text);
    } else if (!src && step.status === "running" && !mediaEl.firstChild) {
      mediaEl.innerHTML = `<div class="row-shot loading"></div>`;
    } else if (!src && step.status !== "running") {
      mediaEl.innerHTML = "";
    }
  }
  if (row.dataset.open === "true") fillDetail(row, step);
}

/** Type text out, character by character, with a blinking caret. */
function typeText(el, text, { animate = true, cps = 90 } = {}) {
  if (el._typing) cancelAnimationFrame(el._typing);
  if (!animate || reduceMotion()) {
    el.textContent = text;
    return;
  }
  let i = 0;
  const per = Math.max(1, Math.round(cps / 60));
  const caret = document.createElement("span");
  caret.className = "caret";
  const step = () => {
    i = Math.min(text.length, i + per);
    el.textContent = text.slice(0, i);
    if (i < text.length) {
      el.appendChild(caret);
      el._typing = requestAnimationFrame(step);
    } else el._typing = null;
  };
  step();
}

/** Swap a label with a short slide when its text changes. */
function setSwapText(el, text) {
  if (el.textContent === text) return;
  el.textContent = text;
  if (reduceMotion()) return;
  el.classList.remove("swap");
  void el.offsetWidth;
  el.classList.add("swap");
}

/**
 * Reveal rendered HTML progressively (the "Writing" effect). Text nodes fill in a few characters
 * per frame; top-level blocks fade in when the text reaches them. Resolves when done.
 */
function streamReveal(container, { onFrame, maxMs = 4200 } = {}) {
  return new Promise((resolve) => {
    if (reduceMotion()) {
      resolve();
      return;
    }
    const blocks = [...container.children];
    // Fix "auto" directions before the text is emptied, so list markers do not jump sides
    container.querySelectorAll('[dir="auto"]').forEach((el) => {
      el.dir = strongDir(el.textContent);
    });
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let total = 0;
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.nodeValue) continue;
      let top = n.parentElement;
      while (top && top.parentElement !== container) top = top.parentElement;
      nodes.push({ n, full: n.nodeValue, top });
      total += n.nodeValue.length;
      n.nodeValue = "";
    }
    if (!total) {
      resolve();
      return;
    }
    container.classList.add("streaming");
    blocks.forEach((b) => b.classList.add("pending"));
    const durMs = Math.min(maxMs, Math.max(700, total * 6));
    const perFrame = Math.max(2, Math.ceil(total / (durMs / 16.7)));
    let i = 0;
    let pos = 0;
    const frame = () => {
      let budget = perFrame;
      while (budget > 0 && i < nodes.length) {
        const cur = nodes[i];
        if (cur.top) {
          // Reveal every block up to this one (also blocks without text, like images or rules)
          for (const b of blocks) {
            b.classList.remove("pending");
            if (b === cur.top) break;
          }
        }
        const take = Math.min(budget, cur.full.length - pos);
        pos += take;
        // Stop at a word boundary for a calmer effect
        if (pos < cur.full.length) {
          const sp = cur.full.indexOf(" ", pos);
          if (sp !== -1 && sp - pos < 8) pos = sp;
        }
        cur.n.nodeValue = cur.full.slice(0, pos);
        budget -= take;
        if (pos >= cur.full.length) {
          i += 1;
          pos = 0;
        }
      }
      onFrame?.();
      if (i < nodes.length) requestAnimationFrame(frame);
      else {
        blocks.forEach((b) => b.classList.remove("pending"));
        container.classList.remove("streaming");
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

function noteEl(note, { animate = true } = {}) {
  const el = document.createElement("div");
  el.className = "note-seg prose";
  el.dataset.nid = note.id;
  el.innerHTML = renderMarkdown(note.text);
  wireProse(el);
  if (animate) streamReveal(el, { onFrame: () => scrollToEnd(), maxMs: 1600 });
  return el;
}

// ---------------------------------------------------------------------------
// Rendering a whole turn (history and replay) and updating the live one
// ---------------------------------------------------------------------------
function renderStoredTurn(rawEntry) {
  const entry = fromLegacyEntry(rawEntry);
  const el = turnShell(entry.id || `h_${entry.timestamp}`);
  actionTitles(el);
  if (entry.userCmid) el.dataset.user = entry.userCmid;
  else {
    const prevUser = [...state.history].reverse().find((h) => h.sender === "user" && h.timestamp <= entry.timestamp);
    if (prevUser) el.dataset.user = prevUser.clientMsgId;
  }
  const segs = el.querySelector(".segs");
  if (entry.plan && entry.plan.length) segs.appendChild(planSegment(entry.plan));
  for (const seg of entry.segments || []) {
    if (seg.kind === "note") segs.appendChild(noteEl(seg, { animate: false }));
    else {
      const totalMs = seg.ms || seg.steps.reduce((a, s) => a + (s.ms || 0), 0);
      const g = { ...seg, ms: totalMs };
      const card = groupCard(g, { live: false, open: false });
      const inner = card.querySelector(".g-inner");
      seg.steps.forEach((s) => inner.appendChild(stepRow(s, { animate: false })));
      renderGroupHead(card, g, { live: false });
      segs.appendChild(card);
    }
  }
  if (entry.text) {
    const prose = el.querySelector(".prose.final");
    prose.hidden = false;
    prose.innerHTML = renderMarkdown(entry.text);
    wireProse(prose);
    showActions(el, entry.timestamp);
  }
  if (entry.outcome && entry.outcome !== "final" && !entry.text) renderOutcome(el, entry.outcome);
  $("thread").appendChild(el);
  return el;
}

function showActions(el, ts) {
  const a = el.querySelector(".a-actions");
  a.hidden = false;
  a.querySelector(".a-time").textContent = formatTime(ts);
}

function renderOutcome(el, outcome) {
  const slot = el.querySelector(".outcome-slot");
  slot.innerHTML = "";
  const box = document.createElement("div");
  box.className = "outcome";
  box.dataset.kind = outcome;
  if (outcome === "stopped") {
    box.innerHTML = `${icon("x")}<div class="o-body" dir="auto">${esc(t("outcomeStopped"))}</div>`;
  } else {
    box.innerHTML = `${icon("alert")}<div class="o-body" dir="auto"><div>${esc(t("outcomeNoReply"))}</div><div style="opacity:.8;font-size:12px;margin-top:2px">${esc(t("outcomeNoReplyHint"))}</div><div class="o-actions"><button type="button" class="solid-btn">${esc(t("askToFinish"))}</button></div></div>`;
    box.querySelector("button").addEventListener("click", () => send(t("finishPrompt")));
  }
  slot.appendChild(box);
}

/** Start (or replay) the live turn in the thread. */
function mountLive(model, { replay = false } = {}) {
  if (state.live && state.live.model.id === model.id) return state.live;
  if (state.live && !state.live.done) finishLiveUI(state.live, { outcome: null, quiet: true });
  // Only the newest turn keeps the extra space that lets the user message sit at the top.
  document.querySelectorAll(".a-turn.anchor").forEach((x) => {
    x.classList.remove("anchor");
    x.style.minHeight = "";
  });
  const el = turnShell(model.id);
  actionTitles(el);
  if (model.userCmid) el.dataset.user = model.userCmid;
  el.classList.add("anchor");
  $("thread").appendChild(el);
  const live = { model, el, done: false, cards: new Map(), rows: new Map(), timer: null, lastEventAt: Date.now() };
  state.live = live;
  showHero(false);

  // Replay what already happened (panel opened mid-task)
  const segs = el.querySelector(".segs");
  for (const seg of model.segments) {
    if (seg.kind === "note") segs.appendChild(noteEl(seg, { animate: false }));
    else {
      const card = groupCard(seg, { live: false, open: true });
      live.cards.set(seg.id, card);
      seg.steps.forEach((s) => {
        const r = stepRow(s, { animate: false });
        live.rows.set(s.id, r);
        card.querySelector(".g-inner").appendChild(r);
      });
      segs.appendChild(card);
    }
  }
  if (model.plan) renderPlanDock(model.plan, { animate: !replay });
  if (state.question) renderQuestion(state.question);

  // Anchor: the user's message goes to the top and the answer grows below it
  const userRow = model.userCmid ? document.querySelector(`.u-row[data-cmid="${CSS.escape(model.userCmid)}"]`) : null;
  if (userRow && !replay) {
    const chat = $("chat");
    el.style.minHeight = Math.max(0, chat.clientHeight - userRow.offsetHeight - 40) + "px";
    requestAnimationFrame(() => {
      chat.scrollTo({ top: posInChat(userRow) - 8, behavior: reduceMotion() ? "auto" : "smooth" });
    });
  } else scrollToEnd(true, true);

  maybeShowTip(el);
  tickLive();
  live.timer = setInterval(tickLive, 1000);
  renderStatus();
  return live;
}

/** Re-render the parts of the live turn that depend on time and phase. */
function tickLive() {
  const live = state.live;
  if (!live || live.done) return;
  const m = live.model;
  const el = live.el;
  const lastSeg = m.segments[m.segments.length - 1];
  const groupIsTail = lastSeg && lastSeg.kind === "group";
  const quiet = Date.now() - live.lastEventAt > QUIET_AFTER_MS && m.phase !== "waiting" && m.phase !== "writing";

  // Which element shows the live status: the tail group header, or the status line below
  live.cards.forEach((card, gid) => {
    const g = m.segments.find((s) => s.id === gid);
    if (!g) return;
    const isTail = groupIsTail && g === lastSeg && m.phase !== "writing";
    renderGroupHead(card, g, { live: isTail, startedAt: m.startedAt });
    // Ghost "Thinking" row at the end of the live card while the agent thinks between tools
    const inner = card.querySelector(".g-inner");
    let ghost = inner.querySelector(".ghost-row");
    const running = g.steps.some((s) => s.status === "running");
    if (isTail && !running && (m.phase === "thinking" || m.phase === "working")) {
      if (!ghost) {
        ghost = document.createElement("div");
        ghost.className = "ghost-row";
        ghost.innerHTML = `<span class="shimmer">${esc(t("rowThinking"))}</span>`;
        inner.appendChild(ghost);
      } else ghost.querySelector("span").textContent = t("rowThinking");
    } else if (ghost) ghost.remove();
  });

  const line = el.querySelector(".status-line");
  const showLine = !groupIsTail || m.phase === "writing" || m.phase === "waiting" || m.phase === "stopping";
  line.hidden = !showLine;
  line.dataset.phase = m.phase;
  if (showLine) {
    const label = line.querySelector(".s-label");
    setSwapText(label, phaseLabel(quiet ? "quiet" : m.phase === "working" ? "thinking" : m.phase));
    label.classList.toggle("shimmer", m.phase !== "waiting");
    line.querySelector(".s-time").textContent = fmtElapsed(Date.now() - m.startedAt);
  }
  const hint = el.querySelector(".quiet-hint");
  if (quiet) {
    hint.hidden = false;
    hint.textContent = t("quietHint", { t: fmtElapsed(Date.now() - live.lastEventAt) });
  } else hint.hidden = true;
}

function setPhase(phase) {
  if (!state.live) return;
  state.live.model.phase = phase;
  tickLive();
  renderStatus();
}

function liveEvent() {
  if (state.live) state.live.lastEventAt = Date.now();
}

function onActivity(ev) {
  if (!state.live || state.live.done) {
    // Event for a turn this panel did not see start: create it from the event
    mountLive(createTurn({ turnId: ev.turnId }), { replay: true });
  }
  const live = state.live;
  liveEvent();
  const { step, group, isNew, newGroup } = applyActivity(live.model, ev);
  let card = live.cards.get(group.id);
  if (newGroup || !card) {
    card = groupCard(group, { live: true, open: true });
    live.cards.set(group.id, card);
    live.el.querySelector(".segs").appendChild(card);
  }
  let row = live.rows.get(step.id);
  if (isNew || !row) {
    row = stepRow(step);
    live.rows.set(step.id, row);
    const inner = card.querySelector(".g-inner");
    const ghost = inner.querySelector(".ghost-row");
    inner.insertBefore(row, ghost || null);
  } else updateStepRow(row, step);
  tickLive();
  scrollToEnd();
}

function onStepMedia(correlationId, image) {
  state.media[correlationId] = image;
  if (!state.live) return;
  const hit = findStepByCorrelation(state.live.model, correlationId);
  if (!hit) return;
  const row = state.live.rows.get(hit.step.id);
  if (row) updateStepRow(row, hit.step);
  tickLive();
  scrollToEnd();
}

function onProgress(note) {
  if (!state.live || state.live.done) mountLive(createTurn({}), { replay: true });
  const live = state.live;
  liveEvent();
  if (!live.model.segments.find((s) => s.id === note.id)) live.model.segments.push(note);
  live.model.phase = "thinking";
  live.el.querySelector(".segs").appendChild(noteEl(note));
  tickLive();
  scrollToEnd();
}

async function onFinal(text) {
  if (!state.live || state.live.done) mountLive(createTurn({}), { replay: true });
  const live = state.live;
  liveEvent();
  live.model.final = text;
  live.model.phase = "writing";
  // Keep the tool cards where they are while the answer is written; they fold away once it is done,
  // with the scroll position compensated so nothing on screen jumps.
  live.cards.forEach((card, gid) => {
    const g = live.model.segments.find((s) => s.id === gid);
    if (g) g.ms = groupWallMs(g);
    card.querySelector(".g-inner .ghost-row")?.remove();
  });
  tickLive();
  const prose = live.el.querySelector(".prose.final");
  prose.hidden = false;
  prose.innerHTML = renderMarkdown(text);
  wireProse(prose);
  await streamReveal(prose, { onFrame: () => scrollToEnd() });
  finishLiveUI(live, { outcome: "final" });
}

/**
 * Remember where the answer sits on screen; the returned function puts it back after the layout
 * above it changed (cards folded, plan added, status line hidden), so nothing visibly jumps.
 */
function keepViewAt(live) {
  const chat = $("chat");
  const ref = live.el.querySelector(".prose.final:not([hidden])") || live.el.querySelector(".outcome-slot") || live.el;
  const before = ref.getBoundingClientRect().top;
  return () => {
    const delta = ref.getBoundingClientRect().top - before;
    if (Math.abs(delta) > 1) chat.scrollTop += delta;
  };
}

function foldCards(live) {
  live.cards.forEach((card) => {
    card.classList.add("no-anim");
    card.dataset.open = "false";
  });
  requestAnimationFrame(() => requestAnimationFrame(() => live.cards.forEach((card) => card.classList.remove("no-anim"))));
}

function finishLiveUI(live, { outcome, quiet = false } = {}) {
  if (!live || live.done) return;
  const restoreView = keepViewAt(live);
  live.done = true;
  clearInterval(live.timer);
  const m = live.model;
  live.cards.forEach((card, gid) => {
    const g = m.segments.find((s) => s.id === gid);
    if (!g) return;
    g.steps.forEach((s) => {
      if (s.status === "running") {
        s.status = "error";
        s.error = s.error || (outcome === "stopped" ? "stopped_by_user" : "did not finish");
        const r = live.rows.get(s.id);
        if (r) updateStepRow(r, s, { animate: false });
      }
    });
    if (!g.ms) g.ms = groupWallMs(g);
    card.querySelector(".g-inner .ghost-row")?.remove();
    renderGroupHead(card, g, { live: false });
  });
  foldCards(live);
  live.el.querySelector(".status-line").hidden = true;
  live.el.querySelector(".quiet-hint").hidden = true;
  if (m.plan && m.plan.length) live.el.querySelector(".segs").prepend(planSegment(m.plan));
  clearPlanDock(m.plan);
  if (outcome === "final") showActions(live.el, Date.now());
  else if (!quiet && outcome && !m.final) renderOutcome(live.el, outcome);
  if (state.live === live) state.live = null;
  $("jumpBtn").dataset.live = "false";
  renderStatus();
  restoreView();
  scrollToEnd();
}

// ---------------------------------------------------------------------------
// Plan (checklist pinned above the composer while the agent works)
// ---------------------------------------------------------------------------
function planListHTML(steps) {
  return steps
    .map(
      (s, i) => `<li class="plan-item" data-st="${s.status}" style="animation-delay:${Math.min(i, 8) * 40}ms">
        <span class="p-ic">${s.status === "done" ? icon("check") : ""}</span><span class="p-text" dir="auto">${esc(s.title)}</span></li>`
    )
    .join("");
}

function planHeadHTML(steps) {
  const d = steps.filter((s) => s.status === "done").length;
  const n = steps.length;
  return `<span class="p-title">${esc(t("planTitle"))}</span><span class="p-count">${esc(t("planCount", { d, n }))}</span>
    <span class="plan-bar"><i style="--p:${n ? Math.round((d / n) * 100) : 0}%"></i></span>${icon("chevron-down", "chev")}`;
}

function renderPlanDock(steps, { animate = true } = {}) {
  const dock = $("planDock");
  if (!steps || !steps.length) return;
  let card = dock.querySelector(".plan-card");
  if (!card) {
    dock.classList.remove("leaving");
    dock.innerHTML = `<div class="plan-card" data-open="false"><button class="plan-head" type="button"></button><div class="plan-current" dir="auto"></div><div class="plan-body"><ul class="plan-list"></ul></div></div>`;
    card = dock.querySelector(".plan-card");
    card.querySelector(".plan-head").addEventListener("click", () => {
      card.dataset.open = String(card.dataset.open !== "true");
    });
  }
  card.querySelector(".plan-head").innerHTML = planHeadHTML(steps);
  const list = card.querySelector(".plan-list");
  // Update in place so only changed items animate
  const items = [...list.children];
  steps.forEach((s, i) => {
    let li = items[i];
    if (!li) {
      list.insertAdjacentHTML("beforeend", planListHTML([s]));
      li = list.lastElementChild;
      if (!animate) li.style.animation = "none";
      return;
    }
    if (li.dataset.st !== s.status) {
      li.dataset.st = s.status;
      li.querySelector(".p-ic").innerHTML = s.status === "done" ? icon("check") : "";
    }
    const tx = li.querySelector(".p-text");
    if (tx.textContent !== s.title) tx.textContent = s.title;
  });
  items.slice(steps.length).forEach((li) => li.remove());
  const cur = steps.find((s) => s.status === "in_progress") || steps.find((s) => s.status === "pending");
  const curEl = card.querySelector(".plan-current");
  if (curEl) {
    const txt = cur ? cur.title : "";
    if (curEl.dataset.text !== txt) {
      curEl.dataset.text = txt;
      curEl.innerHTML = cur ? `<span class="p-ic"></span><span class="p-text shimmer"></span>` : "";
      if (cur) typeText(curEl.querySelector(".p-text"), txt, { animate });
    }
  }
  dock.dir = uiDir();
  dock.hidden = false;
}

function clearPlanDock() {
  const dock = $("planDock");
  if (dock.hidden) return;
  if (reduceMotion()) {
    dock.hidden = true;
    dock.innerHTML = "";
    return;
  }
  dock.classList.add("leaving");
  setTimeout(() => {
    dock.hidden = true;
    dock.innerHTML = "";
    dock.classList.remove("leaving");
  }, 340);
}

function planSegment(steps) {
  const wrap = document.createElement("div");
  wrap.className = "plan-seg plan-card";
  wrap.dir = uiDir();
  wrap.dataset.open = "false";
  wrap.innerHTML = `<button class="plan-head" type="button">${planHeadHTML(steps)}</button><div class="plan-body"><ul class="plan-list">${planListHTML(steps)}</ul></div>`;
  wrap.querySelectorAll(".plan-item").forEach((li) => (li.style.animation = "none"));
  wrap.querySelector(".plan-head").addEventListener("click", () => {
    wrap.dataset.open = String(wrap.dataset.open !== "true");
  });
  return wrap;
}

// ---------------------------------------------------------------------------
// Tip, questions, notes
// ---------------------------------------------------------------------------
function maybeShowTip(turnEl) {
  if (localStorage.getItem("ag_tip_plan_done") === "1") return;
  const count = Number(localStorage.getItem("ag_tip_plan_seen") || "0");
  if (count >= 3) return;
  localStorage.setItem("ag_tip_plan_seen", String(count + 1));
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.innerHTML = `<span dir="auto">${esc(t("tipPlan"))}</span><button type="button" class="link-btn">${esc(t("tipAdd"))}</button><button type="button" class="tip-x" aria-label="${esc(t("close"))}">${icon("x")}</button>`;
  tip.querySelector(".link-btn").addEventListener("click", () => {
    const input = $("input");
    input.value = (input.value ? input.value.trim() + "\n" : "") + t("tipPlanText");
    autosize();
    renderSendButton();
    input.focus();
    localStorage.setItem("ag_tip_plan_done", "1");
    tip.remove();
  });
  tip.querySelector(".tip-x").addEventListener("click", () => {
    localStorage.setItem("ag_tip_plan_done", "1");
    tip.remove();
  });
  turnEl.querySelector(".status-line").after(tip);
  setTimeout(() => tip.remove(), 15000);
}

function note(text, tone = "", ic = "") {
  const el = document.createElement("div");
  el.className = "note";
  if (tone) el.dataset.tone = tone;
  el.innerHTML = `${ic ? icon(ic) : ""}<span dir="auto"></span>`;
  el.querySelector("span").textContent = text;
  $("thread").appendChild(el);
  showHero(false);
  scrollToEnd();
}

function renderQuestion(q) {
  const host = state.live ? state.live.el.querySelector(".segs") : $("thread");
  if (document.querySelector(`.card[data-cid="${CSS.escape(q.correlationId)}"]`)) return;
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.cid = q.correlationId;
  if (q.type === "request_confirmation") {
    card.dataset.kind = "confirm";
    card.innerHTML = `<div class="card-top"><span class="circle">${icon("shield")}</span><span class="card-title">${esc(t("confirmationTitle"))}</span></div>
      <div class="card-body" dir="auto"></div>
      <div class="btn-row"><button type="button" class="solid-btn" data-a="approve">${icon("check")}<span>${esc(t("approve"))}</span></button><button type="button" class="ghost-btn" data-a="deny">${esc(t("deny"))}</button></div>`;
    card.querySelector(".card-body").textContent = q.summary;
    card.querySelectorAll("[data-a]").forEach((b) =>
      b.addEventListener("click", () => {
        state.port?.postMessage({ type: "user_action", action: b.dataset.a, correlationId: q.correlationId });
        card.classList.add("done");
      })
    );
  } else {
    card.dataset.kind = "ask";
    card.innerHTML = `<div class="card-top"><span class="circle">${icon("message")}</span><span class="card-title">${esc(t("askTitle"))}</span></div>
      <div class="card-body" dir="auto"></div><div class="btn-row"></div>`;
    card.querySelector(".card-body").textContent = q.question;
    const row = card.querySelector(".btn-row");
    (q.options && q.options.length ? q.options : [t("approve"), t("deny")]).forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = i === 0 ? "solid-btn" : "ghost-btn";
      b.textContent = opt;
      b.dir = "auto";
      b.addEventListener("click", () => {
        state.port?.postMessage({ type: "user_action", action: "answer", correlationId: q.correlationId, value: opt });
        card.classList.add("done");
      });
      row.appendChild(b);
    });
  }
  host.appendChild(card);
  setPhase("waiting");
  scrollToEnd(true);
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function openLightbox(src, caption) {
  $("lbImg").src = src;
  $("lbCaption").textContent = caption || t("lbCaption");
  openLayer("lightbox");
}

// ---------------------------------------------------------------------------
// Whole-thread rendering (boot, language change, new chat)
// ---------------------------------------------------------------------------
function rebuildThread() {
  const thread = $("thread");
  const liveModel = state.live && !state.live.done ? state.live.model : null;
  if (state.live) clearInterval(state.live.timer);
  state.live = null;
  thread.classList.add("restoring");
  thread.innerHTML = "";
  for (const item of state.history) {
    if (item.sender === "user") renderUser(item, { animate: false });
    else if (item.sender === "agent") renderStoredTurn(item);
  }
  showHero(!state.history.length && !liveModel);
  if (liveModel) mountLive(liveModel, { replay: true });
  scrollToEnd(true, true);
  requestAnimationFrame(() => thread.classList.remove("restoring"));
}

function checkVersions() {
  const banner = $("versionBanner");
  const { background, bridge } = state.versions;
  let text = "";
  if (background && background !== PANEL_BUILD) text = t("versionPanelMismatch", { b: background, p: PANEL_BUILD });
  else if (bridge && bridge !== PANEL_BUILD && !/^5\./.test(bridge)) text = t("versionBridgeOld", { v: bridge });
  if (text) {
    banner.innerHTML = `${icon("alert")}<span dir="auto"></span>`;
    banner.querySelector("span").textContent = text;
    banner.hidden = false;
  } else banner.hidden = true;
  $("versionText").textContent = t("versionsLine", { p: PANEL_BUILD, b: background || "?", r: bridge || "?" });
}

function compareVersions(a, b) {
  const pa = String(a || "").replace(/^v/, "").split(".").map(Number);
  const pb = String(b || "").replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function checkGitHubUpdates(manual = false) {
  const updateBtn = $("checkUpdateBtn");
  if (manual && updateBtn) {
    updateBtn.disabled = true;
    const label = updateBtn.querySelector("span:last-child");
    if (label) label.textContent = t("checkingUpdates");
  }
  try {
    const cached = await new Promise((res) => chrome.storage.local.get(["lastUpdateCheck", "cachedRelease"], res));
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let release = cached.cachedRelease;
    if (manual || !release || !cached.lastUpdateCheck || (now - cached.lastUpdateCheck > DAY_MS)) {
      const resp = await fetch("https://api.github.com/repos/ahmeddmakyy/antigravity-chrome-extension/releases/latest", {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (resp.ok) {
        release = await resp.json();
        chrome.storage.local.set({ lastUpdateCheck: now, cachedRelease: release });
      } else if (manual) {
        toast(t("updateCheckFailed"));
        return;
      }
    }

    if (release && release.tag_name) {
      const latestVer = release.tag_name.replace(/^v/, "").trim();
      const isNewer = compareVersions(latestVer, PANEL_BUILD) > 0;
      if (isNewer) {
        const banner = $("versionBanner");
        banner.innerHTML = `${icon("sparkles")}<div style="flex:1;min-width:0"><strong>${esc(t("updateAvailable", { v: latestVer }))}</strong></div><a href="${esc(release.html_url || "https://github.com/ahmeddmakyy/antigravity-chrome-extension/releases/latest")}" target="_blank" rel="noopener noreferrer" class="pill-btn compact" style="margin-left:auto;text-decoration:none">${esc(t("viewRelease"))}</a>`;
        banner.hidden = false;
        if (manual) toast(t("updateAvailable", { v: latestVer }));
      } else {
        if (manual) toast(t("upToDate", { v: PANEL_BUILD }));
      }
    }
  } catch (err) {
    if (manual) toast(t("updateCheckFailed"));
  } finally {
    if (manual && updateBtn) {
      updateBtn.disabled = false;
      const label = updateBtn.querySelector("span:last-child");
      if (label) label.textContent = t("checkForUpdates");
    }
  }
}

// ---------------------------------------------------------------------------
// Port to background.js
// ---------------------------------------------------------------------------
function connectPort() {
  try {
    const port = chrome.runtime.connect({ name: "antigravity-sidepanel" });
    state.port = port;
    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(() => {
      state.port = null;
      state.connected = false;
      renderStatus();
      setTimeout(connectPort, 1200);
    });
    port.postMessage({ type: "hello", tabId: BOUND_TAB, build: PANEL_BUILD });
  } catch {
    setTimeout(connectPort, 2000);
  }
}

function onPortMessage(msg) {
  const waiter = state.waiters.get(msg.type);
  if (waiter) {
    state.waiters.delete(msg.type);
    waiter(msg);
  }

  switch (msg.type) {
    case "state_sync": {
      state.versions.background = msg.build || "3.x";
      state.versions.bridge = msg.bridgeVersion || null;
      state.connected = Boolean(msg.connected);
      state.listening = Boolean(msg.listening);
      state.agentStatus = msg.agentStatus;
      state.taskState = msg.taskState || "idle";
      state.taskLabel = msg.taskLabel || "";
      state.history = Array.isArray(msg.history) ? msg.history : [];
      state.media = { ...state.media, ...(msg.liveMedia || {}) };
      state.question = msg.question || null;
      if (msg.log) Object.assign(state.log, { recording: msg.log.recording, startedAt: msg.log.startedAt, stoppedAt: msg.log.stoppedAt, count: msg.log.count, verbose: msg.log.verbose });
      state.synced = true;
      rebuildThread();
      if (msg.live) {
        // rebuildThread mounted nothing (state.live was cleared); mount the replay now
        mountLive(msg.live, { replay: true });
      }
      checkVersions();
      renderLogState();
      renderStatus();
      break;
    }
    case "connection":
      state.connected = Boolean(msg.connected);
      state.listening = Boolean(msg.listening);
      if (msg.bridgeVersion) state.versions.bridge = msg.bridgeVersion;
      if (!state.connected) state.agentStatus = null;
      checkVersions();
      renderStatus();
      break;
    case "agent_status":
      state.agentStatus = msg.status;
      state.connected = true;
      renderStatus();
      break;
    case "history_append": {
      const e = msg.entry;
      state.history.push(e);
      if (e.sender === "user") {
        showHero(false);
        renderUser(e);
        scrollToEnd(true);
      } else if (e.sender === "agent") {
        // Already shown live in this panel? Then just keep the data.
        if (!document.querySelector(`.a-turn[data-id="${CSS.escape(e.id)}"]`)) renderStoredTurn(e);
        if (e.outcome === "final") {
          state.history.forEach((h) => {
            if (h.sender === "user" && (h.status === "sent" || h.status === "delivered")) setUserStatus(h.clientMsgId, "answered");
          });
        }
      }
      renderStatus();
      break;
    }
    case "history_removed":
      state.history = state.history.filter((h) => h.clientMsgId !== msg.clientMsgId);
      document.querySelector(`.u-row[data-cmid="${CSS.escape(msg.clientMsgId)}"]`)?.remove();
      break;
    case "history_cleared":
      state.history = [];
      if (state.live) clearInterval(state.live.timer);
      state.live = null;
      $("thread").innerHTML = "";
      clearPlanDock();
      showHero(true);
      renderSuggestions();
      renderStatus();
      break;
    case "live_started":
      mountLive(msg.live);
      break;
    case "live_cancelled":
      if (state.live && !state.live.model.segments.length) {
        clearInterval(state.live.timer);
        state.live.el.remove();
        state.live = null;
        renderStatus();
      }
      break;
    case "live_finished":
      if (state.live && state.live.model.id === msg.id && !state.live.model.final) finishLiveUI(state.live, { outcome: msg.outcome });
      break;
    case "late_final": {
      const el = document.querySelector(`.a-turn[data-id="${CSS.escape(msg.id)}"]`);
      if (el) {
        const prose = el.querySelector(".prose.final");
        prose.hidden = false;
        prose.innerHTML = renderMarkdown(msg.text);
        wireProse(prose);
        streamReveal(prose, { onFrame: () => scrollToEnd() });
        showActions(el, Date.now());
      }
      break;
    }
    case "turn_started":
      liveEvent();
      break;
    case "turn_ended":
      break;
    case "task_state":
      state.taskState = msg.state;
      if (msg.label) state.taskLabel = msg.label;
      if (state.live && msg.phase && !state.live.model.final) {
        state.live.model.phase = msg.phase;
        liveEvent();
        tickLive();
      }
      renderStatus();
      break;
    case "stopping":
      setPhase("stopping");
      break;
    case "message_ack":
      setUserStatus(msg.clientMsgId, "delivered");
      if (state.live && ["sending", "waking"].includes(state.live.model.phase)) setPhase("thinking");
      break;
    case "activity_event":
      onActivity(msg.event);
      break;
    case "step_media":
      onStepMedia(msg.correlationId, msg.image);
      break;
    case "agent_progress":
      onProgress(msg.note);
      break;
    case "agent_final":
      onFinal(msg.text);
      break;
    case "plan_update":
      if (state.live) {
        applyPlan(state.live.model, msg.steps);
        liveEvent();
      }
      renderPlanDock(msg.steps);
      break;
    case "ask_user":
    case "request_confirmation":
      state.question = msg;
      renderQuestion(msg);
      break;
    case "question_resolved":
      state.question = null;
      document.querySelector(`.card[data-cid="${CSS.escape(msg.correlationId)}"]`)?.classList.add("done");
      if (state.live) setPhase("thinking");
      break;
    case "system_note":
      if (msg.code === "linked") note(t("noteLinked"), "ok", "link");
      else if (msg.code === "queued_asleep" || msg.code === "queued_not_linked") {
        const last = [...state.history].reverse().find((h) => h.sender === "user" && h.status === "sent");
        const row = last && document.querySelector(`.u-row[data-cmid="${CSS.escape(last.clientMsgId)}"]`);
        if (row && !row.querySelector(".u-flag")) addFlag(row, "queued");
      }
      break;
    case "delivery_error":
      (msg.clientMsgIds || []).forEach((id) => {
        const row = document.querySelector(`.u-row[data-cmid="${CSS.escape(id)}"]`);
        if (row) addFlag(row, "queued");
      });
      note(t("noteDeliveryError", { e: msg.error || "" }), "err", "alert");
      break;
    case "auth_error":
      note(t("noteAuthError"), "err", "alert");
      break;
    case "close_panel":
      window.close();
      break;
    case "log_state":
      Object.assign(state.log, { recording: Boolean(msg.recording), startedAt: msg.startedAt, stoppedAt: msg.stoppedAt, count: msg.count || 0, verbose: Boolean(msg.verbose) });
      renderLogState();
      break;
    case "new_log_event":
      state.log.count += 1;
      if ($("logLayer").dataset.open === "true") {
        state.logEvents.push(msg.event);
        scheduleLogRender();
      }
      renderLogMeta();
      break;
    case "event_log_data":
      state.logEvents = msg.events || [];
      state.log.count = state.logEvents.length;
      renderLogList();
      renderLogMeta();
      break;
    case "bridge_log":
      state.bridgeLines = msg.lines || [];
      break;
    default:
      break;
  }
}

function request(type, responseType, extra = {}, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!state.port) return resolve(null);
    const timer = setTimeout(() => {
      state.waiters.delete(responseType);
      resolve(null);
    }, timeoutMs);
    state.waiters.set(responseType, (m) => {
      clearTimeout(timer);
      resolve(m);
    });
    state.port.postMessage({ type, ...extra });
  });
}


// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
async function loadLocales() {
  for (const lang of ["ar", "en"]) {
    try {
      const res = await fetch(chrome.runtime.getURL(`locales/${lang}.json`));
      state.locales[lang] = await res.json();
    } catch (err) {
      console.error("Locale load failed", lang, err);
      state.locales[lang] = {};
    }
  }
}
function t(key, params = {}) {
  let v = state.locales[state.lang]?.[key] ?? state.locales.en?.[key] ?? key;
  for (const [k, val] of Object.entries(params)) v = v.replaceAll(`{${k}}`, String(val));
  return v;
}

function applyLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("ag_lang", lang);
  chrome.storage.local.set({ uiLanguage: lang });
  const html = document.documentElement;
  html.setAttribute("lang", lang);
  html.setAttribute("dir", "ltr");
  $("langLabel").textContent = lang === "ar" ? "EN" : "ع";
  $("langBtn").title = t("toggleLang");
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $("fineText").dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", t(el.dataset.i18nTitle));
  });
  renderSuggestions();
  renderTheme();
  renderStatus();
  renderLogState();
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function renderTheme() {
  const dark = state.theme === "dark";
  const holder = $("themeIcon");
  holder.dataset.icon = dark ? "sun" : "moon";
  holder.innerHTML = icon(holder.dataset.icon);
  const label = dark ? t("themeToLight") : t("themeToDark");
  $("themeBtn").title = label;
  $("themeBtn").setAttribute("aria-label", label);
}
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem("ag_theme", state.theme);
  chrome.storage.local.set({ theme: state.theme });
  const btn = $("themeBtn");
  btn.classList.remove("spin-once");
  void btn.offsetWidth;
  btn.classList.add("spin-once");
  setTimeout(() => btn.classList.remove("spin-once"), 600);
  renderTheme();
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
function isWorking() {
  if (!state.connected) return false;
  if (isLive()) return true;
  return ["thinking", "acting", "waiting"].includes(state.taskState) && Boolean(state.agentStatus?.busy);
}

function computeStatus() {
  if (!state.connected) return "offline";
  if (isWorking()) return "working";
  if (state.listening) return "ready";
  const s = state.agentStatus;
  if (!s) return "unlinked";
  if (["push", "hold", "legacy"].includes(s.mode) || s.busy) return "ready";
  if (!s.setupDone && !s.hooks && !s.waker) return "setup";
  if (!s.linked) return s.linkPending ? "ready" : "unlinked";
  return "asleep";
}

const STATUS_TEXT = { offline: "statusOffline", working: "statusWorking", ready: "statusReady", setup: "statusSetup", unlinked: "statusUnlinked", asleep: "statusAsleep" };
const STATUS_DOT = { offline: "var(--pink-ink)", working: "var(--lilac-ink)", ready: "var(--mint-ink)", setup: "var(--peach-ink)", unlinked: "var(--peach-ink)", asleep: "var(--lilac-ink)" };

function wakeLabel() {
  const s = state.agentStatus;
  if (state.listening || s?.mode === "legacy") return [t("wakeLegacy"), false];
  if (!s) return [t("wakeNone"), false];
  if (s.waker) return [t("wakePush"), true];
  if (s.mode === "hold") return [t("wakeHold"), true];
  return [t("wakeNone"), false];
}

function checksHTML() {
  const s = state.agentStatus;
  const [wake, wakeOk] = wakeLabel();
  const linked = s?.linked ? t("linkedYes") : s?.linkPending ? t("linkedPending") : t("linkedNo");
  const rows = [
    ["plug", t("checkBridge"), state.connected ? t("connectedYes") : t("connectedNo"), state.connected],
    ["zap", t("checkWake"), wake, wakeOk],
    ["link", t("checkLinked"), linked, Boolean(s?.linked)],
  ];
  return rows
    .map(([ic, name, val, ok]) => `<li data-ok="${ok}"><span class="check-ic">${icon(ic)}</span><span class="check-name">${esc(name)}</span><span class="check-val">${esc(val)}</span></li>`)
    .join("");
}

function renderStatus() {
  const st = computeStatus();
  const pill = $("statusPill");
  pill.dataset.state = st;
  $("statusText").textContent = t(STATUS_TEXT[st]);

  // Popover content
  const pop = $("statusPopover");
  pop.style.setProperty("--dot", STATUS_DOT[st]);
  const s = state.agentStatus;
  let title = "", body = "";
  const actions = [];
  if (st === "offline") { title = t("popOfflineTitle"); body = t("popOfflineBody"); actions.push(["settings", t("openSettings"), openSettings]); }
  else if (st === "setup") { title = t("popSetupTitle"); body = t("popSetupBody"); actions.push(["copy", t("copyMychrome"), () => copyText("/mychrome")]); }
  else if (st === "unlinked") { title = t("popUnlinkedTitle"); body = t("popUnlinkedBody"); actions.push(["copy", t("copyMychrome"), () => copyText("/mychrome")]); }
  else if (st === "asleep") { title = t("popAsleepTitle"); body = t("popAsleepBody"); actions.push(["copy", t("copyMychrome"), () => copyText("/mychrome")]); }
  else if (st === "working") { title = t("popWorkingTitle"); body = state.taskLabel || t("thinking"); actions.push(["x", t("stop"), stopAgent]); }
  else {
    title = t("popReadyTitle");
    body = state.listening || s?.mode === "legacy" ? t("popReadyLegacy") : s?.mode === "hold" ? t("popReadyHold") : t("popReadyPush");
    if (state.listening || s?.mode === "legacy") actions.push(["copy", t("copyMychrome"), () => copyText("/mychrome")]);
  }
  $("popTitle").textContent = title;
  $("popBody").textContent = body;
  $("popChecks").innerHTML = checksHTML();
  const box = $("popActions");
  box.innerHTML = "";
  actions.forEach(([ic, label, fn], i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === 0 ? "solid-btn" : "ghost-btn";
    b.innerHTML = `${icon(ic)}<span>${esc(label)}</span>`;
    b.addEventListener("click", () => { fn(); if (ic !== "copy" && ic !== "terminal") closePopover(); });
    box.appendChild(b);
  });
  $("healthChecks").innerHTML = checksHTML();

  renderWelcomeCard(st);
  renderSetupCard(st);
  renderBanner(st);
  renderSendButton();
}

function renderWelcomeCard(st) {
  const card = $("welcomeCard");
  if (!card) return;

  const helperOk = state.connected;
  const linkedOk = Boolean(state.agentStatus?.linked);
  const readyOk = helperOk && linkedOk;

  // 1. Badge
  const badge = $("welcomeBadge");
  if (badge) {
    if (readyOk) {
      badge.dataset.state = "ready";
      badge.textContent = t("welcomeAllReady");
    } else if (helperOk) {
      badge.dataset.state = "pending";
      badge.textContent = t("welcomePending");
    } else {
      badge.dataset.state = "offline";
      badge.textContent = t("statusOffline");
    }
  }

  // 2. Item 1: Helper running
  const item1 = $("welcomeHelperItem");
  const ic1 = $("welcomeHelperIc");
  const sub1 = $("welcomeHelperSub");
  const act1 = $("welcomeHelperAction");
  if (item1 && ic1 && sub1) {
    item1.dataset.ok = helperOk ? "true" : "offline";
    ic1.innerHTML = icon(helperOk ? "check" : "plug");
    sub1.textContent = helperOk ? t("checkHelperOk") : t("checkHelperOffline");
    if (!helperOk && act1) {
      act1.innerHTML = `<button type="button" class="pill-btn compact">${icon("settings")}<span>${esc(t("openSettings"))}</span></button>`;
      act1.querySelector("button")?.addEventListener("click", openSettings);
    } else if (act1) {
      act1.innerHTML = "";
    }
  }

  // 3. Item 2: Linked to Antigravity
  const item2 = $("welcomeLinkedItem");
  const ic2 = $("welcomeLinkedIc");
  const sub2 = $("welcomeLinkedSub");
  const act2 = $("welcomeLinkedAction");
  if (item2 && ic2 && sub2) {
    const isPending = Boolean(state.agentStatus?.linkPending);
    item2.dataset.ok = linkedOk ? "true" : "false";
    ic2.innerHTML = icon(linkedOk ? "check" : "link");
    sub2.textContent = linkedOk ? t("checkLinkedOk") : isPending ? t("checkLinkedPending") : t("checkLinkedNo");
    if (act2) {
      if (!linkedOk) {
        act2.innerHTML = `<button type="button" class="pill-btn compact" id="welcomeCopyBtn">${icon("copy")}<span>${esc(t("copyMychrome"))}</span></button>`;
        act2.querySelector("button")?.addEventListener("click", () => copyText("/mychrome"));
      } else {
        act2.innerHTML = "";
      }
    }
  }

  // 4. Item 3: Ready
  const item3 = $("welcomeReadyItem");
  const ic3 = $("welcomeReadyIc");
  const sub3 = $("welcomeReadySub");
  if (item3 && ic3 && sub3) {
    item3.dataset.ok = readyOk ? "true" : "false";
    ic3.innerHTML = icon(readyOk ? "check" : "clock");
    sub3.textContent = readyOk ? t("checkReadyOk") : t("checkReadyWait");
  }
}

function renderSetupCard(st) {
  const card = $("setupCard");
  if (!["setup", "unlinked", "asleep", "offline"].includes(st)) { card.hidden = true; return; }
  const map = {
    offline: ["pink", "plug", "popOfflineTitle", "popOfflineBody", "settings", "openSettings", openSettings],
    setup: ["peach", "terminal", "popSetupTitle", "popSetupBody", "copy", "copyMychrome", () => copyText("/mychrome")],
    unlinked: ["peach", "link", "popUnlinkedTitle", "popUnlinkedBody", "copy", "copyMychrome", () => copyText("/mychrome")],
    asleep: ["lilac", "moon", "popAsleepTitle", "popAsleepBody", "copy", "copyMychrome", () => copyText("/mychrome")],
  };
  const [tone, ic, tk, bk, aic, ak, fn] = map[st];
  card.dataset.tone = tone;
  card.innerHTML = `<span class="circle">${icon(ic)}</span><div class="setup-text"><h3 dir="auto">${esc(t(tk))}</h3><p dir="auto">${esc(t(bk))}</p><button type="button" class="solid-btn">${icon(aic)}<span>${esc(t(ak))}</span></button></div>`;
  card.querySelector("button").addEventListener("click", fn);
  // Hide fallback setupCard in favor of welcomeCard in hero
  card.hidden = Boolean($("welcomeCard"));
}

function renderBanner(st) {
  const banner = $("banner");
  if (!banner) return;
  const showWhenChatting = ["setup", "unlinked", "asleep", "offline"].includes(st) && $("hero")?.hidden;
  if (!showWhenChatting) { banner.hidden = true; return; }
  const textKey = { offline: "popOfflineTitle", setup: "popSetupTitle", unlinked: "popUnlinkedBody", asleep: "popAsleepBody" }[st];
  const action = st === "offline" ? ["openSettings", openSettings] : ["copyMychrome", () => copyText("/mychrome")];
  banner.style.setProperty("--dot", STATUS_DOT[st]);
  banner.innerHTML = `<span class="dot"></span><span class="banner-text" dir="auto">${esc(t(textKey))}</span><button type="button" class="pill-btn">${esc(t(action[0]))}</button>`;
  banner.querySelector("button")?.addEventListener("click", action[1]);
  banner.hidden = false;
}

function togglePopover(force) {
  const pop = $("statusPopover");
  const open = force ?? pop.hidden;
  pop.hidden = !open;
  $("statusPill").setAttribute("aria-expanded", String(open));
  if (open) renderStatus();
}
const closePopover = () => togglePopover(false);

// ---------------------------------------------------------------------------
// Hero, suggestions, composer
// ---------------------------------------------------------------------------
function renderSuggestions() {
  const box = $("suggestions");
  box.innerHTML = SUGGESTIONS.map((s, i) => `
    <button class="s-card" type="button" data-tone="${s.tone}" data-key="${s.key}" style="--i:${i}">
      <span class="s-top"><span class="circle">${icon(s.icon)}</span><span class="s-chip">${esc(t(s.chip))}</span></span>
      <span class="s-title" dir="auto">${esc(t(s.key))}</span>
    </button>`).join("");
  box.querySelectorAll(".s-card").forEach((card) => {
    card.addEventListener("click", () => send(t(card.dataset.key)));
  });
}

function showHero(show) {
  $("hero").hidden = !show;
  renderBanner(computeStatus());
}

function autosize() {
  const el = $("input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 150) + "px";
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------
function renderMarkdown(raw) {
  if (!raw) return "";
  try {
    if (window.marked) {
      const dirty = window.marked.parse(raw, { gfm: true, breaks: true });
      const clean = window.DOMPurify ? window.DOMPurify.sanitize(dirty) : esc(raw);
      const tmp = document.createElement("div");
      tmp.innerHTML = clean;
      tmp.querySelectorAll("pre").forEach((pre) => {
        const lang = (pre.querySelector("code")?.className.match(/language-([\w-]+)/) || [])[1] || "text";
        const wrap = document.createElement("div");
        wrap.className = "code-wrap";
        wrap.innerHTML = `<div class="code-head"><span>${esc(lang)}</span><button type="button" class="code-copy">${icon("copy")}<span>${esc(t("copy"))}</span></button></div>`;
        pre.replaceWith(wrap);
        wrap.appendChild(pre);
      });
      tmp.querySelectorAll("table").forEach((table) => {
        const wrap = document.createElement("div");
        wrap.className = "table-wrap";
        table.replaceWith(wrap);
        wrap.appendChild(table);
      });
      tmp.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th").forEach((el) => el.setAttribute("dir", "auto"));
      // Containers need an explicit direction: dir="auto" skips children that set their own dir.
      tmp.querySelectorAll("ul, ol, table, blockquote").forEach((el) => el.setAttribute("dir", strongDir(el.textContent)));
      tmp.querySelectorAll("a").forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
      return tmp.innerHTML;
    }
  } catch (err) {
    console.error("markdown", err);
  }
  return `<p dir="auto">${esc(raw)}</p>`;
}

function strongDir(text) {
  const m = String(text || "").match(/[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/);
  return m && /[\u0600-\u08FF]/.test(m[0]) ? "rtl" : "ltr";
}

function wireProse(prose) {
  prose.querySelectorAll(".code-copy").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.closest(".code-wrap").querySelector("pre").innerText));
  });
}

// ---------------------------------------------------------------------------
// Diagnostic log (record toggle, viewer, export)
// ---------------------------------------------------------------------------
function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function renderLogState() {
  const rec = state.log.recording;
  for (const [btnId, labelId] of [["recToggle", "recLabel"], ["recToggleMini", "recLabelMini"]]) {
    $(btnId).setAttribute("aria-pressed", String(rec));
    $(labelId).textContent = rec ? t("recStop") : t("recStart");
  }
  $("recBadge").hidden = !rec;
  $("logRecChip").hidden = !rec;
  $("verboseSwitch").checked = state.log.verbose;
  renderLogMeta();
}

function renderLogMeta() {
  const { recording, startedAt, stoppedAt, count } = state.log;
  const elapsed = recording && startedAt ? fmtDuration(Date.now() - startedAt) : "";
  $("recTime").textContent = elapsed;
  $("logRecChipTime").textContent = elapsed;
  $("logCount").textContent = String(count);
  if (recording) $("recMeta").textContent = t("recOnMeta", { n: count });
  else if (startedAt && stoppedAt && count) $("recMeta").textContent = t("recDoneMeta", { n: count, d: fmtDuration(stoppedAt - startedAt) });
  else $("recMeta").textContent = t("recIdleMeta");
}

function toggleRecording() {
  state.port?.postMessage({ type: "set_log_recording", recording: !state.log.recording });
}

let logRenderTimer = null;
function scheduleLogRender() {
  if (logRenderTimer) return;
  logRenderTimer = setTimeout(() => { logRenderTimer = null; renderLogList(); }, 250);
}

function eventHeadline(ev) {
  const d = ev.data || {};
  return d.intent || d.message || d.summary || d.question || (typeof d.text === "string" ? d.text : "") || d.error || d.reason || (d.tool ? `tool: ${d.tool}` : "") || (d.state ? `state: ${d.state}` : "") || "";
}

function renderLogList() {
  const list = $("logList");
  const q = $("logSearch").value.trim().toLowerCase();
  const items = state.logEvents.filter((ev) => {
    if (state.logFilter !== "all" && ev.source !== state.logFilter) return false;
    if (q && !`${ev.source} ${ev.type} ${JSON.stringify(ev.data || {})}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (!items.length) {
    list.innerHTML = `<div class="empty" dir="auto">${esc(t("noEvents"))}</div>`;
    return;
  }
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.innerHTML = items.slice(-400).map((ev) => {
    const d = ev.data || {};
    const isErr = /error|fail|incomplete/i.test(ev.type) || d.status === "error" || ev.type === "ERROR";
    const time = ev.time ? new Date(ev.time).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const details = JSON.stringify(d, null, 2);
    return `<div class="log-row" data-src="${esc(ev.source || "")}" data-level="${isErr ? "error" : ""}">
      <span class="src-dot"></span>
      <div><div class="log-top"><span>${esc(time)}</span><span class="log-type">${esc(ev.type || "")}</span></div>
      <div class="log-head" dir="auto">${esc(String(eventHeadline(ev)).slice(0, 220))}</div>
      ${details && details !== "{}" ? `<details><summary>${esc(t("details"))}</summary><pre>${esc(details)}</pre></details>` : ""}</div></div>`;
  }).join("");
  if (atBottom) list.scrollTop = list.scrollHeight;
}

async function openLogViewer() {
  openLayer("logLayer");
  $("logList").innerHTML = "";
  const res = await request("get_event_log", "event_log_data");
  if (!res) renderLogList();
  state.port?.postMessage({ type: "get_bridge_log" });
}

async function buildExport() {
  const [logRes, bridgeRes] = await Promise.all([
    request("get_event_log", "event_log_data"),
    request("get_bridge_log", "bridge_log", {}, 3000),
  ]);
  const events = logRes?.events || state.logEvents;
  const lines = bridgeRes?.lines || state.bridgeLines || [];
  const { startedAt, stoppedAt, recording, verbose } = state.log;
  const from = startedAt ? startedAt - 2000 : 0;
  const to = recording ? Date.now() : stoppedAt || Date.now();
  const bridgeLog = lines.filter((line) => {
    const m = line.match(/^\[(.*?)\]/);
    const ts = m ? Date.parse(m[1]) : NaN;
    return Number.isNaN(ts) || !startedAt || (ts >= from && ts <= to + 2000);
  });
  return {
    format: "antigravity-mychrome-log/4",
    versions: { panel: PANEL_BUILD, background: state.versions.background, bridge: state.versions.bridge },
    turns: events.filter((e) => e.type === "turn_ended").map((e) => e.data),
    exportedAt: new Date().toISOString(),
    recording: {
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      stoppedAt: stoppedAt && !recording ? new Date(stoppedAt).toISOString() : null,
      stillRecording: recording,
      durationSeconds: startedAt ? Math.round((to - startedAt) / 1000) : 0,
      eventCount: events.length,
      verbose,
    },
    environment: {
      extensionVersion: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent,
      uiLanguage: state.lang,
      theme: state.theme,
      connected: state.connected,
      panelStatus: computeStatus(),
      agentStatus: state.agentStatus,
      taskState: state.taskState,
      activeTabDomain: $("tabDomain").textContent,
    },
    howToRead: [
      "Sources: panel = side panel UI, background = extension service worker (CDP, tabs, overlay), bridge = local Node bridge on 127.0.0.1, agent = tool activity and replies coming from the Antigravity agent.",
      "Every event has a 'turn' id (t1, t2...) when it belongs to an agent turn. 'turns' lists one summary per finished turn: reason, finalSent, tools, errors, durationMs, firstActivityMs (how long the agent took to start).",
      "Healthy push flow for one message: panel_msg_chat_message, bridge '[Wake] Sending', '[Wake] Delivered', message_ack, turn_started, task_state thinking/acting, agent tool_running/tool_success (each with an intent), reply_progress, reply_final, turn_ended (finalSent true).",
      "Without a working Stop hook the bridge ends a turn on the final reply, on Stop, or after 90s of silence when a new message arrives ('presumed idle'). 'versions' must all be equal; a mismatch means Chrome or Antigravity needs a restart.",
      "Hold mode replaces the Wake lines with '[Hook] Releasing the held turn'. Legacy mode shows '[MCP Tool] wait_for_user_message' lines instead.",
      "Red flags: delivery_error, '[Wake] Failed', turn_ended with finalSent false, a chat_message with no message_ack, firstActivityMs above 60000, 'Unknown browser command', bridge_offline, auth_error, panel_connected with match false.",
      "Secrets are redacted: the pairing token, password and card text, and screenshots never appear in this file.",
    ],
    transcript: state.history.map((h) => (h.sender === "agent" ? { ...h, text: h.text } : h)),
    events,
    bridgeLog,
  };
}

async function exportLog() {
  const data = await buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `antigravity-log-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyLog() {
  const data = await buildExport();
  copyText(JSON.stringify(data, null, 2));
}

async function clearLog() {
  const ok = await confirmDialog(t("confirmClearLogTitle"), t("confirmClearLogBody"), t("confirmClearLogOk"));
  if (!ok) return;
  state.port?.postMessage({ type: "clear_event_log" });
  state.logEvents = [];
  renderLogList();
}

// ---------------------------------------------------------------------------
// Layers, dialogs, toast
// ---------------------------------------------------------------------------
let lastFocus = null;
function openLayer(id) {
  lastFocus = document.activeElement;
  const layer = $(id);
  layer.dataset.open = "true";
  setTimeout(() => layer.querySelector("[data-close].icon-btn, button")?.focus({ preventScroll: true }), 50);
}
function closeLayer(id) {
  $(id).dataset.open = "false";
  lastFocus?.focus?.({ preventScroll: true });
}
function openSettings() {
  closePopover();
  renderStatus();
  renderLogState();
  openLayer("settingsLayer");
}

function confirmDialog(title, body, okLabel) {
  return new Promise((resolve) => {
    $("confirmTitle").textContent = title;
    $("confirmBody").textContent = body;
    $("confirmOk").textContent = okLabel;
    $("confirmCancel").textContent = t("cancel");
    openLayer("confirmLayer");
    const done = (v) => {
      closeLayer("confirmLayer");
      $("confirmOk").onclick = $("confirmCancel").onclick = null;
      $("confirmLayer").querySelector(".backdrop").onclick = null;
      resolve(v);
    };
    $("confirmOk").onclick = () => done(true);
    $("confirmCancel").onclick = () => done(false);
    $("confirmLayer").querySelector(".backdrop").onclick = () => done(false);
    setTimeout(() => $("confirmOk").focus(), 60);
  });
}

let toastTimer = null;
function toast(text, ic = "check") {
  const el = $("toast");
  el.innerHTML = `${icon(ic)}<span></span>`;
  el.querySelector("span").textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(t("copied"));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function loadSettings() {
  chrome.storage.local.get(["bridgePort", "pairingToken", "blocklist", "reduceMotion"], (res) => {
    $("portInput").value = res.bridgePort || 8765;
    $("tokenInput").value = res.pairingToken || "";
    $("blocklistInput").value = res.blocklist ?? "bank, paypal, stripe, checkout, account";
    $("motionSwitch").checked = Boolean(res.reduceMotion);
    applyMotion(Boolean(res.reduceMotion));
  });
  checkVersions();
}
function applyMotion(reduce) {
  document.documentElement.classList.toggle("reduce-motion", reduce);
  localStorage.setItem("ag_reduce_motion", reduce ? "1" : "0");
}
function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value }, () => toast(t("saved")));
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString(state.lang === "ar" ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// New chat, scrolling, events, boot
// ---------------------------------------------------------------------------
async function newChat() {
  const ok = await confirmDialog(t("confirmNewChatTitle"), t("confirmNewChatBody"), t("confirmNewChatOk"));
  if (!ok) return;
  state.port?.postMessage({ type: "clear_history" });
  closeLayer("settingsLayer");
}

function scrollToEnd(force = false, instant = false) {
  const chat = $("chat");
  if (!force && !state.stick) return;
  requestAnimationFrame(() => {
    // With an anchored turn, "the end" is the bottom of its content, not of the empty space below it
    const anchor = document.querySelector(".a-turn.anchor");
    let top = chat.scrollHeight;
    if (anchor && anchor.style.minHeight) {
      const visible = [...anchor.children].filter((c) => c.offsetParent && !c.hidden);
      const contentBottom = visible.reduce((m, c) => Math.max(m, posInChat(c) + c.offsetHeight), posInChat(anchor));
      const cmid = anchor.dataset.user || "";
      const userRow = cmid ? document.querySelector(`.u-row[data-cmid="${CSS.escape(cmid)}"]`) : null;
      const minTop = userRow ? posInChat(userRow) - 8 : 0;
      top = Math.max(minTop, contentBottom - chat.clientHeight + 40);
    }
    chat.scrollTo({ top, behavior: instant || reduceMotion() ? "auto" : "smooth" });
  });
}

function bindEvents() {
  $("statusPill").addEventListener("click", (e) => {
    e.stopPropagation();
    togglePopover();
  });
  document.addEventListener("click", (e) => {
    const pop = $("statusPopover");
    if (!pop.hidden && !pop.contains(e.target) && !$("statusPill").contains(e.target)) closePopover();
  });

  $("newChatBtn").addEventListener("click", newChat);
  $("themeBtn").addEventListener("click", toggleTheme);
  $("langBtn").addEventListener("click", () => {
    applyLanguage(state.lang === "ar" ? "en" : "ar");
    rebuildThread();
    checkVersions();
  });
  $("settingsBtn").addEventListener("click", openSettings);

  document.querySelectorAll(".layer [data-close]").forEach((el) => {
    el.addEventListener("click", () => {
      const layer = el.closest(".layer");
      if (layer.id !== "confirmLayer") closeLayer(layer.id);
    });
  });

  $("copySetupBtn").addEventListener("click", () => copyText("/mychrome"));
  $("checkUpdateBtn")?.addEventListener("click", () => checkGitHubUpdates(true));
  document.querySelectorAll(".social-pill, .about-actions a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (a.href) chrome.tabs.create({ url: a.href });
    });
  });
  $("recToggle").addEventListener("click", toggleRecording);
  $("recToggleMini").addEventListener("click", toggleRecording);
  $("logViewBtn").addEventListener("click", openLogViewer);
  $("logCopyBtn").addEventListener("click", copyLog);
  $("logExportBtn").addEventListener("click", exportLog);
  $("logExportBtn2").addEventListener("click", exportLog);
  $("logClearBtn").addEventListener("click", clearLog);
  $("verboseSwitch").addEventListener("change", (e) => state.port?.postMessage({ type: "toggle_verbose", verbose: e.target.checked }));
  $("portInput").addEventListener("change", (e) => saveSetting("bridgePort", parseInt(e.target.value || "8765", 10)));
  $("tokenInput").addEventListener("change", (e) => saveSetting("pairingToken", e.target.value.trim()));
  $("blocklistInput").addEventListener("change", (e) => saveSetting("blocklist", e.target.value.trim()));
  $("motionSwitch").addEventListener("change", (e) => {
    applyMotion(e.target.checked);
    saveSetting("reduceMotion", e.target.checked);
  });
  $("clearChatBtn").addEventListener("click", newChat);

  $("logFilters").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      $("logFilters").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      state.logFilter = b.dataset.filter;
      renderLogList();
    })
  );
  $("logSearch").addEventListener("input", () => renderLogList());

  const input = $("input");
  input.addEventListener("input", () => {
    autosize();
    renderSendButton();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (input.value.trim() || state.attachments.length) send();
    } else if (e.key === "Escape" && isWorking()) {
      stopAgent();
    }
  });
  input.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      addFiles(files);
    }
  });
  $("sendBtn").addEventListener("click", () => send());
  $("stopBtn").addEventListener("click", stopAgent);

  const attachBtn = $("attachBtn");
  const attachMenu = $("attachMenu");
  const attachWrap = $("attachWrap");
  if (attachBtn && attachMenu) {
    attachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = attachMenu.hidden;
      attachMenu.hidden = !open;
      attachBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (attachWrap && !attachWrap.contains(e.target)) {
        attachMenu.hidden = true;
        attachBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
  $("attachUploadBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    attachBtn?.setAttribute("aria-expanded", "false");
    $("filePicker")?.click();
  });
  $("filePicker")?.addEventListener("change", (e) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  });
  $("attachShotBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    attachBtn?.setAttribute("aria-expanded", "false");
    captureTabScreenshot();
  });

  // Drag & drop files onto side panel
  const dropOverlay = $("dropOverlay");
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    if ([...(e.dataTransfer?.types || [])].includes("Files")) {
      dragDepth++;
      if (dropOverlay) dropOverlay.hidden = false;
    }
  });
  window.addEventListener("dragleave", (e) => {
    if ([...(e.dataTransfer?.types || [])].includes("Files")) {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        if (dropOverlay) dropOverlay.hidden = true;
      }
    }
  });
  window.addEventListener("dragover", (e) => {
    if ([...(e.dataTransfer?.types || [])].includes("Files")) {
      e.preventDefault();
    }
  });
  window.addEventListener("drop", (e) => {
    dragDepth = 0;
    if (dropOverlay) dropOverlay.hidden = true;
    if (e.dataTransfer?.files?.length) {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    }
  });

  $("contextPill").addEventListener("click", () => {
    if (state.currentTab?.id) chrome.tabs.update(state.currentTab.id, { active: true });
  });

  const chat = $("chat");
  // Only the user's own scrolling may turn "follow the answer" off; our smooth scrolls must not.
  let userScrollAt = 0;
  const markUser = () => (userScrollAt = Date.now());
  chat.addEventListener("wheel", markUser, { passive: true });
  chat.addEventListener("touchmove", markUser, { passive: true });
  chat.addEventListener("keydown", markUser);
  chat.addEventListener(
    "scroll",
    () => {
      const dist = chat.scrollHeight - chat.scrollTop - chat.clientHeight;
      const byUser = Date.now() - userScrollAt < 600;
      const anchor = document.querySelector(".a-turn.anchor");
      const anchorGap = anchor && anchor.style.minHeight ? Math.max(0, chat.scrollHeight - (posInChat(anchor) + [...anchor.children].reduce((m, c) => (c.offsetParent ? Math.max(m, c.offsetTop - anchor.offsetTop + c.offsetHeight) : m), 0))) : 0;
      if (byUser || dist < 80 + anchorGap) state.stick = dist < 80 + anchorGap;
      const jump = $("jumpBtn");
      jump.hidden = dist < 200 + anchorGap;
      jump.dataset.live = String(isLive());
    },
    { passive: true }
  );
  $("jumpBtn").addEventListener("click", () => {
    state.stick = true;
    scrollToEnd(true);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (attachMenu && !attachMenu.hidden) {
      attachMenu.hidden = true;
      attachBtn?.setAttribute("aria-expanded", "false");
      return;
    }
    if ($("confirmLayer").dataset.open === "true") return;
    if ($("lightbox").dataset.open === "true") closeLayer("lightbox");
    else if ($("logLayer").dataset.open === "true") closeLayer("logLayer");
    else if ($("settingsLayer").dataset.open === "true") closeLayer("settingsLayer");
    else if (!$("statusPopover").hidden) closePopover();
  });

  chrome.tabs.onUpdated.addListener((id, info) => {
    if ((BOUND_TAB === null || id === BOUND_TAB) && (info.title || info.favIconUrl || info.status === "complete" || info.url)) updateTab();
  });
  if (BOUND_TAB === null) chrome.tabs.onActivated.addListener(updateTab);
  setInterval(() => {
    if (state.log.recording) renderLogMeta();
  }, 1000);
}

(async function boot() {
  try {
    hydrateIcons();
    await loadLocales();
    applyLanguage(state.lang);
    bindEvents();
    loadSettings();
    updateTab();
    connectPort();
    renderSendButton();
    checkGitHubUpdates(false);
  } catch (err) {
    console.error("[MyChrome] Boot failed:", err);
  }
})();
