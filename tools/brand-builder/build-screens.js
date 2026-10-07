import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function getBase64(relPath) {
  const full = path.join(ROOT, relPath);
  const ext = path.extname(full).slice(1);
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'woff2' ? 'font/woff2' : ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream';
  const data = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${data}`;
}

const fontDMSansRegular = getBase64('extension/fonts/DMSans-400.woff2');
const fontDMSansMedium = getBase64('extension/fonts/DMSans-500.woff2');
const fontDMSansSemiBold = getBase64('extension/fonts/DMSans-600.woff2');
const icon256 = getBase64('tools/brand-assets/icon256.png');
const icon32 = getBase64('extension/icons/icon32.png');
const iconLinkedIn = getBase64('docs/icons/linkedin.svg');
const iconTelegram = getBase64('docs/icons/telegram.svg');
const iconPortfolio = getBase64('docs/icons/portfolio.svg');

const fontStyles = `
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 400;
  src: url('${fontDMSansRegular}') format('woff2');
}
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 500;
  src: url('${fontDMSansMedium}') format('woff2');
}
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 600;
  src: url('${fontDMSansSemiBold}') format('woff2');
}
`;

const SVG = {
  plus: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  moon: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  settings: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  send: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 7-7 7 7M12 19V5"/></svg>',
  paperclip: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  camera: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>',
  instagram: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1.2"/></svg>',
  telegram: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  globe: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>',
  refresh: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  github: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>'
};

const panelCss = fs.readFileSync('extension/sidepanel.css', 'utf-8');

function getBrowserWrapper(panelInnerHtml, activeTabTitle = "Artificial intelligence - Wikipedia", activeUrl = "https://en.wikipedia.org/wiki/Artificial_intelligence", highlightSelector = false) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<style>
${fontStyles}
${panelCss}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* Force animations off and ensure 100% opacity for headless capture */
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}
.hero { opacity: 1 !important; transform: none !important; }
.hero-title { color: var(--text) !important; }
.hero-sub { color: var(--text-2) !important; }
.welcome-card { opacity: 1 !important; transform: none !important; }
.s-card { opacity: 1 !important; transform: none !important; }
.u-bubble { opacity: 1 !important; transform: none !important; }

body {
  width: 1280px;
  height: 800px;
  overflow: hidden;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #181920;
  display: flex;
  flex-direction: column;
}

/* Chrome Titlebar & Tabs */
.chrome-top {
  background: #121318;
  height: 42px;
  display: flex;
  align-items: flex-end;
  padding: 0 12px;
  border-bottom: 1px solid #1a1b22;
}
.tab {
  background: #1e2029;
  height: 34px;
  border-radius: 10px 10px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-size: 12px;
  color: #e2e8f0;
  max-width: 260px;
  border: 1px solid #2a2d3d;
  border-bottom: none;
}
.tab-ic {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #475569;
  flex: none;
}
.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Chrome Nav Bar */
.chrome-nav {
  background: #1e2029;
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 12px;
  border-bottom: 1px solid #282a36;
}
.nav-btn {
  color: #94a3b8;
  font-size: 14px;
  user-select: none;
}
.url-bar {
  flex: 1;
  background: #121318;
  border-radius: 999px;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 12.5px;
  color: #cbd5e1;
  border: 1px solid #2d3142;
  gap: 8px;
}
.url-lock {
  color: #10b981;
  font-size: 12px;
}
.ext-icon-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(94, 234, 212, 0.16);
  border: 1px solid rgba(94, 234, 212, 0.4);
  border-radius: 8px;
  padding: 3px 8px;
}
.ext-icon-img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

/* Browser Body Layout: Page (67%) + Side Panel (33%) */
.browser-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #ffffff;
}
.web-page {
  flex: 1;
  background: #ffffff;
  padding: 36px 48px;
  color: #202122;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  border-right: 1px solid #e2e8f0;
  position: relative;
}
.wiki-heading {
  font-family: 'Georgia', serif;
  font-size: 28px;
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 6px;
  margin-bottom: 14px;
  color: #000;
}
.wiki-p {
  font-size: 14px;
  line-height: 1.6;
  color: #202122;
  margin-bottom: 14px;
}
.wiki-box {
  float: right;
  width: 240px;
  background: #f8f9fa;
  border: 1px solid #a2a9b1;
  padding: 12px;
  font-size: 12px;
  margin: 0 0 14px 18px;
  border-radius: 4px;
  line-height: 1.5;
}
.active-highlight {
  background: rgba(94, 234, 212, 0.25);
  border-bottom: 2px solid #0d9488;
  padding: 2px 4px;
  border-radius: 3px;
}

/* Side Panel Container (exact match with extension shell) */
.side-panel {
  width: 410px;
  flex: none;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: -6px 0 20px rgba(0,0,0,0.25);
}
.side-panel .app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.side-panel .chat {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.side-panel .composer-wrap {
  flex: none;
}
</style>
</head>
<body>
  <div class="chrome-top">
    <div class="tab">
      <div class="tab-ic"></div>
      <span class="tab-title">${activeTabTitle}</span>
    </div>
  </div>
  <div class="chrome-nav">
    <span class="nav-btn">←</span>
    <span class="nav-btn">→</span>
    <span class="nav-btn">↻</span>
    <div class="url-bar">
      <span class="url-lock">🔒</span>
      <span>${activeUrl}</span>
    </div>
    <div class="ext-icon-btn">
      <img src="${icon32}" class="ext-icon-img" alt="">
    </div>
  </div>
  <div class="browser-body">
    <div class="web-page">
      <h1 class="wiki-heading">Artificial intelligence</h1>
      <div class="wiki-box">
        <strong>Overview</strong><br>
        Domain: Computer science<br>
        Subfields: Machine learning, NLP, Robotics, Computer vision
      </div>
      <p class="wiki-p">
        <strong>Artificial intelligence (AI)</strong> is the intelligence of machines or software, as opposed to the intelligence of living beings, primarily of humans. It is a field of study in computer science that develops and studies intelligent machines.
      </p>
      <p class="wiki-p">
        ${highlightSelector ? '<span class="active-highlight">AI technology is widely used throughout industry, government, and science. Some high-profile applications include advanced web search engines (e.g., Google Search), recommendation systems, and autonomous vehicles.</span>' : 'AI technology is widely used throughout industry, government, and science. Some high-profile applications include advanced web search engines (e.g., Google Search), recommendation systems, and autonomous vehicles.'}
      </p>
      <p class="wiki-p">
        As machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect.
      </p>
    </div>
    <div class="side-panel">
      ${panelInnerHtml}
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// A. panel-idle.html (Welcome Card with 3 Live Checks)
// ---------------------------------------------------------------------------
const panelIdleInner = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <img src="${icon32}" class="brand-logo" alt="" width="26" height="26">
      <span class="brand-name">MyChrome</span>
    </div>
    <button class="status-pill" data-state="ready" type="button">
      <span class="status-dot"></span>
      <span class="status-text">Ready</span>
    </button>
    <div class="topbar-actions">
      <button class="icon-btn" type="button">${SVG.plus}</button>
      <button class="icon-btn" type="button">${SVG.moon}</button>
      <button class="icon-btn" type="button">${SVG.settings}</button>
    </div>
  </header>

  <main class="chat">
    <section class="hero">
      <h1 class="hero-title">What should we do on this page?</h1>
      <p class="hero-sub">I work right here in your tab. You watch every step, and you can stop me at any time.</p>

      <div class="welcome-card" style="margin-top: 14px;">
        <div class="welcome-head">
          <div class="welcome-title-wrap">
            <span class="welcome-dot-badge"></span>
            <h2 class="welcome-title">Setup Status</h2>
          </div>
          <span class="welcome-badge" data-state="ready">All systems connected</span>
        </div>
        <ul class="welcome-list">
          <li class="welcome-item" data-ok="true">
            <div class="welcome-item-left">
              <span class="welcome-check-ic">${SVG.check}</span>
              <div class="welcome-item-text">
                <span class="welcome-item-name">Helper Service</span>
                <span class="welcome-item-sub">Running on localhost:8765</span>
              </div>
            </div>
          </li>
          <li class="welcome-item" data-ok="true">
            <div class="welcome-item-left">
              <span class="welcome-check-ic">${SVG.check}</span>
              <div class="welcome-item-text">
                <span class="welcome-item-name">Antigravity Link</span>
                <span class="welcome-item-sub">Linked to conversation</span>
              </div>
            </div>
          </li>
          <li class="welcome-item" data-ok="true">
            <div class="welcome-item-left">
              <span class="welcome-check-ic">${SVG.check}</span>
              <div class="welcome-item-text">
                <span class="welcome-item-name">Ready to browse</span>
                <span class="welcome-item-sub">Ready for requests</span>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div class="suggestions" style="margin-top: 14px;">
        <button class="s-card" data-tone="pink">
          <span class="s-top"><span class="circle">📄</span><span class="s-chip">Reads</span></span>
          <span class="s-title">Summarize this page and pull out key points</span>
        </button>
        <button class="s-card" data-tone="mint">
          <span class="s-top"><span class="circle">🔍</span><span class="s-chip">Reads</span></span>
          <span class="s-title">Find subfields of machine learning mentioned</span>
        </button>
      </div>
    </section>
  </main>

  <footer class="composer-wrap">
    <div class="composer">
      <textarea rows="1" placeholder="Ask anything about this page..."></textarea>
      <div class="composer-bar">
        <button class="context-pill" type="button">
          <span class="ctx-domain">en.wikipedia.org</span>
        </button>
        <button class="mini-btn" type="button">${SVG.paperclip}</button>
        <span class="bar-spacer"></span>
        <button class="send-btn" type="button">${SVG.send}</button>
      </div>
    </div>
    <p class="fine">Antigravity acts in your real browser. Watch it, and stop it any time.</p>
  </footer>
</div>
`;

// ---------------------------------------------------------------------------
// B. panel-working.html (Live Card in Progress)
// ---------------------------------------------------------------------------
const panelWorkingInner = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <img src="${icon32}" class="brand-logo" alt="" width="26" height="26">
      <span class="brand-name">MyChrome</span>
    </div>
    <button class="status-pill" data-state="working" type="button">
      <span class="status-dot"></span>
      <span class="status-text">Working</span>
    </button>
    <div class="topbar-actions">
      <button class="icon-btn" type="button">${SVG.plus}</button>
      <button class="icon-btn" type="button">${SVG.moon}</button>
      <button class="icon-btn" type="button">${SVG.settings}</button>
    </div>
  </header>

  <main class="chat">
    <div class="thread">
      <div class="u-row">
        <div class="u-bubble">Summarize the main subfields and extract citations from this article</div>
      </div>

      <div class="a-turn">
        <div class="status-line">
          <span class="dots"><i></i><i></i><i></i></span>
          <span class="s-label shimmer" style="color:var(--text); font-weight:500;">Working in Chrome...</span>
          <span class="s-time">2.8s</span>
        </div>

        <div class="group-card" data-open="true">
          <div class="g-head">
            <span class="g-ic"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg></span>
            <span class="g-label">Browser Actions</span>
            <span class="g-count">3 steps</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <div class="g-body">
            <div class="g-inner">
              <div class="row" data-status="done">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);">${SVG.check}</span>
                  <span class="row-label"><b>Read page</b> — extract DOM text and metadata</span>
                </div>
              </div>
              <div class="row" data-status="done">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);">${SVG.check}</span>
                  <span class="row-label"><b>Scroll to</b> — Section 2 (Applications)</span>
                </div>
              </div>
              <div class="row" data-status="running" style="background: rgba(94, 234, 212, 0.08);">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--mint-ink);"></span></span>
                  <span class="row-label" style="color:var(--mint-ink); font-weight:600;"><b>Find</b> — Subfields and references on page</span>
                </div>
                <span class="row-intent" style="color:var(--text-2); padding-bottom:8px;">Locating 4 subfield subsections in article body...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer class="composer-wrap">
    <div class="composer">
      <textarea rows="1" placeholder="Agent is working..." disabled></textarea>
      <div class="composer-bar">
        <button class="context-pill" type="button"><span class="ctx-domain">en.wikipedia.org</span></button>
        <span class="bar-spacer"></span>
        <button class="stop-btn" type="button" style="display:inline-flex; align-items:center; gap:6px; background:#ef4444; color:#fff; border-radius:8px; padding:4px 12px; border:0; font-size:12px; font-weight:600; cursor:pointer;">
          <span style="width:8px; height:8px; background:#fff; border-radius:2px;"></span> Stop
        </button>
      </div>
    </div>
    <p class="fine">Antigravity acts in your real browser. Watch it, and stop it any time.</p>
  </footer>
</div>
`;

// ---------------------------------------------------------------------------
// C. panel-plan.html (Interactive Plan Dock)
// ---------------------------------------------------------------------------
const panelPlanInner = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <img src="${icon32}" class="brand-logo" alt="" width="26" height="26">
      <span class="brand-name">MyChrome</span>
    </div>
    <button class="status-pill" data-state="working" type="button">
      <span class="status-dot"></span>
      <span class="status-text">Plan Mode</span>
    </button>
    <div class="topbar-actions">
      <button class="icon-btn" type="button">${SVG.plus}</button>
      <button class="icon-btn" type="button">${SVG.moon}</button>
      <button class="icon-btn" type="button">${SVG.settings}</button>
    </div>
  </header>

  <main class="chat">
    <div class="thread">
      <div class="u-row">
        <div class="u-bubble">Analyze the article structure and compile key sections into a summary note</div>
      </div>
      <div class="a-turn">
        <div class="note-seg" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:12px 14px; font-size:13.5px; line-height:1.6; color:var(--text);">
          <p style="margin:0 0 6px;">I reviewed the article structure. Here is the step-by-step plan I'll execute:</p>
          <div style="font-size:12.5px; color:var(--text-2);">You can adjust any step below before I proceed.</div>
        </div>
      </div>
    </div>
  </main>

  <footer class="composer-wrap">
    <!-- Interactive Plan Dock -->
    <div class="plan-dock" style="display:block; margin: 0 10px 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 14px; box-shadow: var(--shadow);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--mint-ink);"></span>
          <span style="font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:0.06em;">Execution Plan (2/4)</span>
        </div>
        <span style="font-size:11.5px; color:var(--text-3); font-weight:500;">50% complete</span>
      </div>
      <ul style="list-style:none; display:flex; flex-direction:column; gap:8px; margin:0; padding:0;">
        <li style="display:flex; align-items:center; gap:9px; font-size:13px; color:var(--text-2);">
          <span style="color:var(--mint-ink); font-weight:bold; display:grid; place-items:center; width:16px; height:16px;">✓</span>
          <span style="text-decoration:line-through; color:var(--text-2); opacity:0.8;">Read table of contents and main headings</span>
        </li>
        <li style="display:flex; align-items:center; gap:9px; font-size:13px; color:var(--text-2);">
          <span style="color:var(--mint-ink); font-weight:bold; display:grid; place-items:center; width:16px; height:16px;">✓</span>
          <span style="text-decoration:line-through; color:var(--text-2); opacity:0.8;">Extract definitions and core overview</span>
        </li>
        <li style="display:flex; align-items:center; gap:9px; font-size:13px; color:var(--mint-ink); font-weight:600; background:rgba(94, 234, 212, 0.08); padding:5px 8px; border-radius:8px;">
          <span style="width:7px; height:7px; border-radius:50%; background:var(--mint-ink); display:inline-block;"></span>
          <span>Review ethical implications & challenges</span>
        </li>
        <li style="display:flex; align-items:center; gap:9px; font-size:13px; color:var(--text-3);">
          <span style="width:7px; height:7px; border-radius:50%; border:1px solid var(--text-3); display:inline-block;"></span>
          <span>Compile final bullet-point synthesis</span>
        </li>
      </ul>
    </div>

    <div class="composer">
      <textarea rows="1" placeholder="Type an adjustment to the plan..."></textarea>
      <div class="composer-bar">
        <button class="context-pill" type="button"><span class="ctx-domain">en.wikipedia.org</span></button>
        <span class="bar-spacer"></span>
        <button class="send-btn" type="button">${SVG.send}</button>
      </div>
    </div>
    <p class="fine">Antigravity acts in your real browser. Watch it, and stop it any time.</p>
  </footer>
</div>
`;

// ---------------------------------------------------------------------------
// D. settings-about.html (Developer Credits with Ahmed Maky links)
// ---------------------------------------------------------------------------
const settingsAboutInner = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <img src="${icon32}" class="brand-logo" alt="" width="26" height="26">
      <span class="brand-name">MyChrome</span>
    </div>
    <button class="status-pill" data-state="ready" type="button">
      <span class="status-dot"></span>
      <span class="status-text">Ready</span>
    </button>
  </header>

  <div class="layer" data-open="true" style="visibility:visible; pointer-events:auto; position:absolute; inset:0; z-index:50;">
    <section class="sheet" style="transform:none; position:absolute; inset:0; border-radius:0; background:var(--bg); overflow-y:auto; padding-bottom:20px;">
      <div class="sheet-head" style="border-bottom: 1px solid var(--line); padding: 14px 18px;">
        <h2 style="font-size:18px; font-weight:600;">Settings</h2>
      </div>
      <div class="sheet-body" style="padding: 14px; display:flex; flex-direction:column; gap:12px;">
        <!-- About Group -->
        <div class="group about-group">
          <div class="group-head">
            <span class="group-icon logo-icon"><img src="${icon32}" alt="" width="20" height="20"></span>
            <div>
              <h3>About MyChrome</h3>
              <p class="group-help">Autonomous browser agent companion for Antigravity</p>
            </div>
          </div>

          <div class="about-card">
            <div class="about-dev-row">
              <div class="about-dev-info">
                <span class="about-dev-label">BUILT BY</span>
                <strong class="about-dev-name">Ahmed Maky</strong>
              </div>
              <div class="social-links">
                <div class="social-pill li-pill">
                  <span class="social-icon"><img src="${iconLinkedIn}" alt="" width="22" height="22"></span>
                  <span class="social-tag">LinkedIn</span>
                </div>
                <div class="social-pill tg-pill">
                  <span class="social-icon"><img src="${iconTelegram}" alt="" width="22" height="22"></span>
                  <span class="social-tag">Telegram</span>
                </div>
                <div class="social-pill portfolio-pill">
                  <span class="social-icon"><img src="${iconPortfolio}" alt="" width="22" height="22"></span>
                  <span class="social-tag">Portfolio</span>
                </div>
              </div>
            </div>

            <div class="about-meta-grid">
              <div class="about-meta-item">
                <span class="meta-label">Version</span>
                <span class="meta-value">5.1.0</span>
              </div>
              <div class="about-meta-item">
                <span class="meta-label">License</span>
                <span class="meta-value">MIT</span>
              </div>
            </div>

            <div class="about-actions">
              <button class="pill-btn" type="button" style="background:var(--surface); color:#5EEAD4; border:1px solid rgba(94,234,212,0.3);">
                ${SVG.refresh} Check for updates
              </button>
              <button class="ghost-btn" type="button" style="background:var(--surface); color:var(--text);">
                ${SVG.github} GitHub
              </button>
            </div>

            <p class="about-disclaimer">
              Independent open-source project. Not affiliated with Google.
            </p>
          </div>
        </div>

        <!-- Connection Group with Advanced Accordion -->
        <div class="group">
          <div class="group-head">
            <span class="group-icon">${SVG.settings}</span>
            <h3>Connection</h3>
          </div>
          <p class="group-help">Auto-pairs with MyChrome helper on localhost. No token required for everyday use.</p>
          <div class="advanced-details" style="padding:10px 14px; font-size:12.5px; color:var(--text-3);">
            <span>▾ Advanced Connection Settings (Optional)</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
`;

function getPortraitWrapper(panelInnerHtml) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<style>
${fontStyles}
${panelCss}

* { box-sizing: border-box; margin: 0; padding: 0; }
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}
body {
  width: 420px;
  height: 820px;
  overflow: hidden;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
}
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.chat {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.composer-wrap {
  flex: none;
}
</style>
</head>
<body>
  ${panelInnerHtml}
</body>
</html>`;
}

const panelWorkingPortraitInner = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <img src="${icon32}" class="brand-logo" alt="" width="26" height="26">
      <span class="brand-name">MyChrome</span>
    </div>
    <button class="status-pill" data-state="working" type="button">
      <span class="status-dot"></span>
      <span class="status-text">Working</span>
    </button>
    <div class="topbar-actions">
      <button class="icon-btn" type="button">${SVG.plus}</button>
      <button class="icon-btn" type="button">${SVG.moon}</button>
      <button class="icon-btn" type="button">${SVG.settings}</button>
    </div>
  </header>

  <main class="chat">
    <div class="thread">
      <div class="u-row">
        <div class="u-bubble">Summarize the main subfields and extract citations from this article</div>
      </div>

      <div class="a-turn">
        <div class="status-line">
          <span class="dots"><i></i><i></i><i></i></span>
          <span class="s-label shimmer" style="color:var(--text); font-weight:500;">Working in Chrome...</span>
          <span class="s-time">2.8s</span>
        </div>

        <div class="group-card" data-open="true">
          <div class="g-body">
            <div class="g-inner">
              <div class="row" data-status="done">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);">${SVG.check}</span>
                  <span class="row-label"><b>Read page</b> — extract DOM text and metadata</span>
                </div>
              </div>
              <div class="row" data-status="done">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);">${SVG.check}</span>
                  <span class="row-label"><b>Scroll to</b> — Section 2 (Applications)</span>
                </div>
              </div>
              <div class="row" data-status="running" style="background: rgba(94, 234, 212, 0.08);">
                <div class="row-head">
                  <span class="row-state" style="color:var(--mint-ink);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--mint-ink);"></span></span>
                  <span class="row-label" style="color:var(--mint-ink); font-weight:600;"><b>Find</b> — Subfields and references on page</span>
                </div>
                <span class="row-intent" style="color:var(--text-2); padding-bottom:8px;">Locating 4 subfield subsections in article body...</span>
              </div>
            </div>
          </div>
        </div>

        <div class="a-bubble" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:12px 14px; font-size:13.5px; line-height:1.6; color:var(--text); margin-top:12px;">
          <p style="margin:0 0 6px;"><b>Artificial Intelligence Subfields:</b></p>
          <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--text-2);">
            <li><b>Machine Learning:</b> Neural nets and pattern recognition algorithms.</li>
            <li><b>NLP:</b> Statistical parsing and large language modeling.</li>
            <li><b>Robotics:</b> Embodied perception and motion planning.</li>
          </ul>
        </div>
      </div>
    </div>
  </main>

  <footer class="composer-wrap">
    <div class="composer">
      <textarea rows="1" placeholder="Ask anything about this page..."></textarea>
      <div class="composer-bar">
        <button class="context-pill" type="button"><span class="ctx-domain">en.wikipedia.org</span></button>
        <button class="mini-btn" type="button">${SVG.paperclip}</button>
        <span class="bar-spacer"></span>
        <button class="send-btn" type="button">${SVG.send}</button>
      </div>
    </div>
    <p class="fine">Antigravity acts in your real browser. Watch it, and stop it any time.</p>
  </footer>
</div>
`;

fs.writeFileSync('tools/brand-builder/panel-idle.html', getBrowserWrapper(panelIdleInner), 'utf-8');
fs.writeFileSync('tools/brand-builder/panel-plan.html', getBrowserWrapper(panelPlanInner), 'utf-8');
fs.writeFileSync('tools/brand-builder/settings-about.html', getBrowserWrapper(settingsAboutInner), 'utf-8');
fs.writeFileSync('tools/brand-builder/panel-working-portrait.html', getPortraitWrapper(panelWorkingPortraitInner), 'utf-8');

function render(htmlFile, outFile, width, height) {
  const fileUri = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  const outPath = path.resolve(outFile).replace(/\\/g, '/');
  console.log(`Rendering ${htmlFile} -> ${outFile} (${width}x${height})...`);
  execFileSync(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    `--screenshot=${outPath}`,
    fileUri
  ]);
  console.log(`Rendered: ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

render('tools/brand-builder/panel-idle.html', 'docs/screens/panel-idle.png', 1280, 800);
render('tools/brand-builder/panel-plan.html', 'docs/screens/panel-plan.png', 1280, 800);
render('tools/brand-builder/settings-about.html', 'docs/screens/settings-about.png', 1280, 800);
render('tools/brand-builder/panel-working-portrait.html', 'docs/screens/panel-working-en.png', 420, 820);

