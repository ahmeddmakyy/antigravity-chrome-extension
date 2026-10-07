// content.js - MyChrome v5 in-page overlay (Shadow DOM)
// A soft glow around the page while the agent works, a "Stop Antigravity" pill at the bottom,
// a caption above it that types out what the agent is doing, and click / scroll cues.

(function () {
  if (!window.__antigravityRefs) {
    window.__antigravityRefs = { elemToRef: new WeakMap(), refToElem: new Map(), counter: 1 };
  }
  if (window.__antigravityOverlayV4) return;
  window.__antigravityOverlayV4 = true;

  // An older overlay (v3) may still be on this page after an update: remove it.
  try {
    document.querySelectorAll("antigravity-overlay-host").forEach((el) => el.remove());
  } catch {}

  const TEXT = {
    en: { stop: "Stop Antigravity", panel: "Open the side panel here", thinking: "Thinking", waiting: "Waiting for you in the side panel", stopped: "Stopped" },
    ar: { stop: "إيقاف Antigravity", panel: "افتح الشريط الجانبي هنا", thinking: "بيفكر", waiting: "مستنيك في الشريط الجانبي", stopped: "اتوقف" },
  };

  const host = document.createElement("antigravity-overlay-v4");
  Object.assign(host.style, { position: "fixed", inset: "0", width: "0", height: "0", zIndex: "2147483647", pointerEvents: "none" });
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root {
      --amber: #FFB23E; --lilac: #B892FF; --mint: #5EEAD4; --ink: #1B1230;
      font-family: "Segoe UI", system-ui, -apple-system, "Noto Sans Arabic", Tahoma, sans-serif;
    }

    /* Glow: a soft inner light on the edges, a little stronger at the bottom where the pill sits */
    .glow {
      position: fixed; inset: 0; pointer-events: none; opacity: 0;
      transition: opacity .6s cubic-bezier(.22,1,.36,1);
    }
    .glow::before {
      content: ""; position: absolute; inset: 0;
      box-shadow:
        inset 0 0 0 1.5px color-mix(in srgb, var(--lilac) 55%, transparent),
        inset 0 0 26px 2px color-mix(in srgb, var(--lilac) 32%, transparent),
        inset 0 0 70px 8px color-mix(in srgb, var(--amber) 18%, transparent);
      animation: breathe 3.2s ease-in-out infinite;
    }
    .glow::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 140px;
      background: radial-gradient(60% 100% at 50% 100%, color-mix(in srgb, var(--amber) 22%, transparent), transparent 70%);
      animation: breathe 3.2s ease-in-out infinite reverse;
    }
    .root[data-state="thinking"] .glow { opacity: .55; }
    .root[data-state="acting"] .glow { opacity: 1; }
    .root[data-state="waiting"] .glow { opacity: .9; }
    .root[data-state="waiting"] .glow::before {
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--amber) 70%, transparent), inset 0 0 40px 6px color-mix(in srgb, var(--amber) 30%, transparent);
    }
    .root[data-state="done"] .glow { opacity: 0; transition-duration: 1.1s; }
    @keyframes breathe { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }

    /* Dock at the bottom center: caption above, pill below */
    .dock {
      position: fixed; left: 50%; bottom: 22px; transform: translate(-50%, 18px);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      opacity: 0; pointer-events: none;
      transition: opacity .35s ease, transform .5s cubic-bezier(.22,1,.36,1);
    }
    .root.show .dock { opacity: 1; transform: translate(-50%, 0); }
    .root.show .pill { pointer-events: auto; }

    .caption {
      max-width: min(460px, 86vw); padding: 6px 12px; border-radius: 10px;
      background: rgba(27, 18, 48, .82); color: #FFF9F0; font-size: 12.5px; line-height: 1.45;
      backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%);
      box-shadow: 0 6px 22px rgba(0,0,0,.18);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      opacity: 0; transform: translateY(6px); transition: opacity .3s ease, transform .4s cubic-bezier(.22,1,.36,1);
    }
    .caption.on { opacity: 1; transform: none; }
    .caption .dots { display: inline-flex; gap: 3px; margin-inline-end: 7px; vertical-align: middle; }
    .caption .dots i { width: 5px; height: 5px; border-radius: 50%; display: block; animation: hop 1.2s ease-in-out infinite; }
    .caption .dots i:nth-child(1) { background: var(--amber); }
    .caption .dots i:nth-child(2) { background: var(--lilac); animation-delay: .15s; }
    .caption .dots i:nth-child(3) { background: var(--mint); animation-delay: .3s; }
    .caption .txt.shimmer {
      background: linear-gradient(90deg, rgba(255,249,240,.55) 0%, #fff 45%, rgba(255,249,240,.55) 90%);
      background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: shimmer 1.8s linear infinite;
    }
    .caption .caret { display: inline-block; width: 1px; height: 1em; background: #fff; margin-inline-start: 2px; vertical-align: -2px; animation: blink 1s steps(1) infinite; }
    @keyframes hop { 0%, 60%, 100% { transform: translateY(0); opacity: .55; } 30% { transform: translateY(-3px); opacity: 1; } }
    @keyframes shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
    @keyframes blink { 50% { opacity: 0; } }

    .pill {
      display: flex; align-items: stretch; border-radius: 12px; overflow: hidden;
      background: rgba(255, 255, 255, .94); color: var(--ink);
      border: 1px solid rgba(27, 18, 48, .12);
      box-shadow: 0 1px 2px rgba(27,18,48,.08), 0 10px 30px rgba(27,18,48,.16);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    }
    .pill button {
      all: unset; cursor: pointer; display: flex; align-items: center; gap: 9px;
      font-size: 14px; font-weight: 600; letter-spacing: -.005em; color: var(--ink);
      transition: background-color .2s ease;
    }
    .pill .stop { padding: 9px 16px 9px 13px; }
    .pill .stop:hover { background: rgba(27, 18, 48, .06); }
    .pill .stop:active { background: rgba(27, 18, 48, .1); }
    .pill .stop svg { width: 18px; height: 18px; flex: none; }
    .pill .side { padding: 0 11px; border-inline-start: 1px solid rgba(27, 18, 48, .1); }
    .pill .side:hover { background: rgba(27, 18, 48, .06); }
    .pill .side svg { width: 16px; height: 16px; opacity: .75; }
    .pill button:focus-visible { outline: 2px solid var(--lilac); outline-offset: -2px; }
    .root.stopping .pill .stop { opacity: .55; pointer-events: none; }

    /* Click cue */
    .cursor {
      position: fixed; width: 22px; height: 22px; border-radius: 50%;
      background: rgba(255,255,255,.4); border: 2px solid var(--lilac);
      box-shadow: 0 0 14px color-mix(in srgb, var(--lilac) 60%, transparent);
      pointer-events: none; opacity: 0;
      transition: transform .35s cubic-bezier(.16,1,.3,1), opacity .2s;
    }
    .cursor.on { opacity: 1; }
    .ripple {
      position: fixed; width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid var(--amber); pointer-events: none;
      transform: translate(-50%, -50%) scale(.2); animation: ripple .6s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes ripple { to { transform: translate(-50%, -50%) scale(1.6); opacity: 0; } }

    /* Scroll cue: a small chevron on the right edge */
    .scrollcue {
      position: fixed; right: 18px; top: 50%; width: 30px; height: 30px; margin-top: -15px; border-radius: 50%;
      background: rgba(27, 18, 48, .78); color: #fff; display: grid; place-items: center;
      opacity: 0; transform: scale(.8); transition: opacity .2s, transform .3s cubic-bezier(.22,1,.36,1);
    }
    .scrollcue.on { opacity: 1; transform: scale(1); }
    .scrollcue svg { width: 16px; height: 16px; }

    @media (prefers-reduced-motion: reduce) {
      .glow::before, .glow::after, .caption .dots i, .caption .txt.shimmer, .caption .caret { animation: none !important; }
      .dock, .cursor, .caption { transition: none !important; }
    }
  `;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "root";
  root.dataset.state = "idle";
  root.innerHTML = `
    <div class="glow"></div>
    <div class="dock" role="region" aria-label="Antigravity">
      <div class="caption" aria-live="polite"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="txt"></span></div>
      <div class="pill">
        <button class="stop" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.2" fill="currentColor" stroke="none"/></svg>
          <span class="stop-label"></span>
        </button>
        <button class="side" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16"/></svg>
        </button>
      </div>
    </div>
    <div class="cursor"></div>
    <div class="scrollcue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>
  `;
  shadow.appendChild(root);

  const caption = root.querySelector(".caption");
  const captionTxt = root.querySelector(".caption .txt");
  const stopBtn = root.querySelector(".stop");
  const stopLabel = root.querySelector(".stop-label");
  const sideBtn = root.querySelector(".side");
  const cursor = root.querySelector(".cursor");
  const scrollcue = root.querySelector(".scrollcue");

  let lang = "ar";
  let typeTimer = null;
  let shownText = "";
  let hideTimer = null;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  stopBtn.addEventListener("click", () => {
    root.classList.add("stopping");
    typeCaption(TEXT[lang].stopped, false);
    try { chrome.runtime.sendMessage({ type: "STOP_SESSION" }); } catch {}
  });
  sideBtn.addEventListener("click", () => {
    try { chrome.runtime.sendMessage({ type: "OPEN_PANEL_HERE" }); } catch {}
  });

  function applyLang(l) {
    lang = l === "en" ? "en" : "ar";
    stopLabel.textContent = TEXT[lang].stop;
    sideBtn.title = TEXT[lang].panel;
    sideBtn.setAttribute("aria-label", TEXT[lang].panel);
    caption.dir = lang === "ar" ? "rtl" : "ltr";
  }
  applyLang(lang);

  /** Type the caption text out, a few characters per frame. */
  function typeCaption(text, live) {
    text = String(text || "").replace(/\.{3}$|…$/, "");
    if (text === shownText) {
      captionTxt.classList.toggle("shimmer", Boolean(live));
      return;
    }
    shownText = text;
    if (typeTimer) cancelAnimationFrame(typeTimer);
    caption.classList.toggle("on", Boolean(text));
    captionTxt.classList.remove("shimmer");
    if (!text) { captionTxt.textContent = ""; return; }
    if (reduced()) { captionTxt.textContent = text; captionTxt.classList.toggle("shimmer", Boolean(live)); return; }
    let i = 0;
    const per = Math.max(1, Math.ceil(text.length / 28));
    const caret = document.createElement("span");
    caret.className = "caret";
    const step = () => {
      i = Math.min(text.length, i + per);
      captionTxt.textContent = text.slice(0, i);
      if (i < text.length) {
        captionTxt.appendChild(caret);
        typeTimer = requestAnimationFrame(step);
      } else {
        typeTimer = null;
        captionTxt.classList.toggle("shimmer", Boolean(live));
      }
    };
    step();
  }

  function setState(state, message, l) {
    if (l) applyLang(l);
    clearTimeout(hideTimer);
    if (!state || state === "idle") {
      root.dataset.state = "idle";
      root.classList.remove("show", "stopping");
      typeCaption("", false);
      return;
    }
    root.dataset.state = state;
    if (state === "done") {
      root.classList.remove("stopping");
      hideTimer = setTimeout(() => setState("idle"), 900);
      return;
    }
    root.classList.add("show");
    if (state === "waiting") typeCaption(message || TEXT[lang].waiting, false);
    else if (state === "thinking") typeCaption(message || TEXT[lang].thinking, true);
    else typeCaption(message || "", true);
  }

  function showClickCue(x, y) {
    cursor.style.transform = `translate(${x - 11}px, ${y - 11}px)`;
    cursor.classList.add("on");
    setTimeout(() => {
      cursor.classList.remove("on");
      const r = document.createElement("div");
      r.className = "ripple";
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      root.appendChild(r);
      setTimeout(() => r.remove(), 650);
    }, 320);
  }

  function highlight(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      const o = el.style.outline;
      const t = el.style.transition;
      el.style.transition = "outline-color .3s ease";
      el.style.outline = "2.5px solid #B892FF";
      setTimeout(() => { el.style.outline = o; el.style.transition = t; }, 700);
    } catch {}
  }

  function showScrollCue(direction) {
    const rot = { up: 180, down: 0, left: 90, right: -90 }[direction] ?? 0;
    scrollcue.firstElementChild.style.transform = `rotate(${rot}deg)`;
    scrollcue.classList.add("on");
    setTimeout(() => scrollcue.classList.remove("on"), 650);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg?.type) {
      case "PING": sendResponse({ ok: true, v: 4 }); return true;
      case "SET_OVERLAY_STATE": setState(msg.state, msg.message, msg.lang); break;
      case "HIDE_FOR_SCREENSHOT": host.style.display = "none"; break;
      case "RESTORE_AFTER_SCREENSHOT": host.style.display = ""; break;
      case "SHOW_CLICK_CUE": showClickCue(msg.x, msg.y); break;
      case "HIGHLIGHT_ELEMENT": highlight(msg.selector); break;
      case "SHOW_SCROLL_CUE": showScrollCue(msg.direction); break;
      default: return false;
    }
    sendResponse({ success: true });
    return true;
  });
})();
