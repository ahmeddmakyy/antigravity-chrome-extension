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
const bgDark = getBase64('tools/brand-assets/bg-dark.jpg');
const bgLight = getBase64('tools/brand-assets/bg-light.jpg');

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

// ---------------------------------------------------------------------------
// 1. Dark Banner (1600x480)
// ---------------------------------------------------------------------------
const darkBannerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fontStyles}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 1600px;
  height: 480px;
  overflow: hidden;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #0c0a14;
  background-image: url('${bgDark}');
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  align-items: center;
  color: #ffffff;
}
.overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 75% 50%, rgba(12, 10, 20, 0.45) 0%, rgba(12, 10, 20, 0.85) 100%),
              linear-gradient(90deg, rgba(12, 10, 20, 0.92) 0%, rgba(12, 10, 20, 0.55) 50%, rgba(12, 10, 20, 0.8) 100%);
  pointer-events: none;
}
.container {
  position: relative;
  z-index: 10;
  width: 100%;
  padding: 0 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
}
.left-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
}
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(94, 234, 212, 0.12);
  border: 1px solid rgba(94, 234, 212, 0.35);
  padding: 6px 14px;
  border-radius: 999px;
  width: fit-content;
}
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5EEAD4;
  box-shadow: 0 0 10px #5EEAD4;
}
.pill-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5EEAD4;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}
.title-icon {
  width: 60px;
  height: 60px;
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
  flex: none;
}
.title {
  font-size: 64px;
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.05;
  color: #ffffff;
}
.subtitle {
  font-size: 21px;
  line-height: 1.5;
  color: #cbd5e1;
  font-weight: 400;
  max-width: 820px;
}
.feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}
.feat-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  font-size: 14.5px;
  color: #f1f5f9;
  font-weight: 500;
}
.feat-ic {
  color: #5EEAD4;
  font-weight: 700;
}
.right-col {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: none;
}
.mock-panel {
  width: 370px;
  height: 400px;
  background: #12131a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.mock-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #171822;
}
.mock-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}
.mock-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: #5EEAD4;
  background: rgba(94, 234, 212, 0.12);
  border: 1px solid rgba(94, 234, 212, 0.3);
  padding: 3px 9px;
  border-radius: 999px;
}
.mock-chat {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.mock-user-bubble {
  align-self: flex-end;
  background: #3b82f6;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 16px 16px 4px 16px;
  font-size: 13.5px;
  line-height: 1.4;
  max-width: 90%;
}
.mock-card {
  background: #1c1d27;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mock-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #94a3b8;
}
.mock-step.done {
  color: #cbd5e1;
}
.mock-step.done .mock-step-ic {
  color: #5EEAD4;
  font-weight: bold;
}
.mock-step.running {
  color: #5EEAD4;
  font-weight: 600;
}
.mock-step.running .mock-step-ic {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5EEAD4;
  box-shadow: 0 0 6px #5EEAD4;
}
.mock-composer {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #171822;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mock-ctx {
  font-size: 11.5px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px 8px;
  border-radius: 6px;
}
.mock-send-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #5EEAD4;
  color: #0c0a14;
  display: grid;
  place-items: center;
  font-weight: bold;
  font-size: 14px;
}
</style>
</head>
<body>
  <div class="overlay"></div>
  <div class="container">
    <div class="left-col">
      <div class="pill-badge">
        <span class="pill-dot"></span>
        <span class="pill-text">UNOFFICIAL ANTIGRAVITY CHROME EXTENSION</span>
      </div>
      <div class="title-row">
        <img src="${icon256}" class="title-icon" alt="">
        <h1 class="title">MyChrome</h1>
      </div>
      <p class="subtitle">
        Chat with your Antigravity agent from a Chrome side panel. It works in the tabs you are signed in to and shows every step.
      </p>
      <div class="feature-row">
        <span class="feat-chip"><span class="feat-ic">✓</span> Works in your signed-in tabs</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Scrapes any page</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Shows every step</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Free and open source</span>
      </div>
    </div>
    <div class="right-col">
      <div class="mock-panel">
        <div class="mock-topbar">
          <div class="mock-brand">
            <img src="${icon32}" width="20" height="20" alt="">
            <span>MyChrome</span>
          </div>
          <span class="mock-status">● Working</span>
        </div>
        <div class="mock-chat">
          <div class="mock-user-bubble">Summarize this page & extract key data</div>
          <div class="mock-card">
            <div class="mock-step done"><span class="mock-step-ic">✓</span> Read DOM & page metadata</div>
            <div class="mock-step done"><span class="mock-step-ic">✓</span> Highlight main subsections</div>
            <div class="mock-step running"><span class="mock-step-ic"></span> Extracting citations and data...</div>
          </div>
        </div>
        <div class="mock-composer">
          <span class="mock-ctx">wikipedia.org</span>
          <span class="mock-send-btn">↑</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 2. Light Banner (1600x480)
// ---------------------------------------------------------------------------
const lightBannerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fontStyles}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 1600px;
  height: 480px;
  overflow: hidden;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #fafafa;
  background-image: url('${bgLight}');
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  align-items: center;
  color: #0f172a;
}
.overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.75) 50%, rgba(255, 255, 255, 0.88) 100%);
  pointer-events: none;
}
.container {
  position: relative;
  z-index: 10;
  width: 100%;
  padding: 0 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
}
.left-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
}
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(13, 148, 136, 0.1);
  border: 1px solid rgba(13, 148, 136, 0.28);
  padding: 6px 14px;
  border-radius: 999px;
  width: fit-content;
}
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0d9488;
  box-shadow: 0 0 8px rgba(13, 148, 136, 0.5);
}
.pill-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0f766e;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}
.title-icon {
  width: 60px;
  height: 60px;
  border-radius: 15px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08);
  flex: none;
}
.title {
  font-size: 64px;
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.05;
  color: #0f172a;
}
.subtitle {
  font-size: 21px;
  line-height: 1.5;
  color: #334155;
  font-weight: 400;
  max-width: 820px;
}
.feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}
.feat-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  font-size: 14.5px;
  color: #1e293b;
  font-weight: 500;
}
.feat-ic {
  color: #0d9488;
  font-weight: 700;
}
.right-col {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: none;
}
.mock-panel {
  width: 370px;
  height: 400px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 20px;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.mock-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: #f8fafc;
}
.mock-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.mock-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: #0d9488;
  background: rgba(13, 148, 136, 0.1);
  border: 1px solid rgba(13, 148, 136, 0.28);
  padding: 3px 9px;
  border-radius: 999px;
}
.mock-chat {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  background: #f8fafc;
}
.mock-user-bubble {
  align-self: flex-end;
  background: #2563eb;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 16px 16px 4px 16px;
  font-size: 13.5px;
  line-height: 1.4;
  max-width: 90%;
}
.mock-card {
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.mock-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #64748b;
}
.mock-step.done {
  color: #1e293b;
}
.mock-step.done .mock-step-ic {
  color: #0d9488;
  font-weight: bold;
}
.mock-step.running {
  color: #0d9488;
  font-weight: 600;
}
.mock-step.running .mock-step-ic {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0d9488;
  box-shadow: 0 0 6px rgba(13, 148, 136, 0.4);
}
.mock-composer {
  padding: 10px 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.8);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mock-ctx {
  font-size: 11.5px;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
}
.mock-send-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #0d9488;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: bold;
  font-size: 14px;
}
</style>
</head>
<body>
  <div class="overlay"></div>
  <div class="container">
    <div class="left-col">
      <div class="pill-badge">
        <span class="pill-dot"></span>
        <span class="pill-text">UNOFFICIAL ANTIGRAVITY CHROME EXTENSION</span>
      </div>
      <div class="title-row">
        <img src="${icon256}" class="title-icon" alt="">
        <h1 class="title">MyChrome</h1>
      </div>
      <p class="subtitle">
        Chat with your Antigravity agent from a Chrome side panel. It works in the tabs you are signed in to and shows every step.
      </p>
      <div class="feature-row">
        <span class="feat-chip"><span class="feat-ic">✓</span> Works in your signed-in tabs</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Scrapes any page</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Shows every step</span>
        <span class="feat-chip"><span class="feat-ic">✓</span> Free and open source</span>
      </div>
    </div>
    <div class="right-col">
      <div class="mock-panel">
        <div class="mock-topbar">
          <div class="mock-brand">
            <img src="${icon32}" width="20" height="20" alt="">
            <span>MyChrome</span>
          </div>
          <span class="mock-status">● Working</span>
        </div>
        <div class="mock-chat">
          <div class="mock-user-bubble">Summarize this page & extract key data</div>
          <div class="mock-card">
            <div class="mock-step done"><span class="mock-step-ic">✓</span> Read DOM & page metadata</div>
            <div class="mock-step done"><span class="mock-step-ic">✓</span> Highlight main subsections</div>
            <div class="mock-step running"><span class="mock-step-ic"></span> Extracting citations and data...</div>
          </div>
        </div>
        <div class="mock-composer">
          <span class="mock-ctx">wikipedia.org</span>
          <span class="mock-send-btn">↑</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 3. Social Preview (1280x640)
// ---------------------------------------------------------------------------
const socialPreviewHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fontStyles}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 1280px;
  height: 640px;
  overflow: hidden;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #0c0a14;
  background-image: url('${bgDark}');
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  text-align: center;
}
.overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(12, 10, 20, 0.45) 0%, rgba(12, 10, 20, 0.9) 100%);
  pointer-events: none;
}
.content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  max-width: 980px;
  padding: 0 40px;
}
.logo-wrap {
  position: relative;
  margin-bottom: 4px;
}
.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(94, 234, 212, 0.4) 0%, rgba(184, 146, 255, 0.3) 50%, transparent 75%);
  filter: blur(24px);
}
.logo-img {
  width: 124px;
  height: 124px;
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.15);
  position: relative;
  z-index: 2;
}
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(94, 234, 212, 0.12);
  border: 1px solid rgba(94, 234, 212, 0.35);
  padding: 6px 16px;
  border-radius: 999px;
}
.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5EEAD4;
  box-shadow: 0 0 8px #5EEAD4;
}
.pill-text {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5EEAD4;
}
.title {
  font-size: 60px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.05;
  color: #ffffff;
}
.tagline {
  font-size: 21.5px;
  line-height: 1.5;
  color: #cbd5e1;
  font-weight: 400;
  max-width: 820px;
}
.features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
}
.feat-pill {
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  font-size: 15px;
  font-weight: 500;
  color: #f8fafc;
  white-space: nowrap;
}
.footer {
  position: absolute;
  bottom: 22px;
  font-size: 13.5px;
  color: #94a3b8;
  letter-spacing: 0.02em;
}
.footer strong {
  color: #e2e8f0;
}
</style>
</head>
<body>
  <div class="overlay"></div>
  <div class="content">
    <div class="logo-wrap">
      <div class="logo-glow"></div>
      <img src="${icon256}" class="logo-img" alt="MyChrome">
    </div>
    <div class="pill-badge">
      <span class="pill-dot"></span>
      <span class="pill-text">UNOFFICIAL ANTIGRAVITY CHROME EXTENSION</span>
    </div>
    <h1 class="title">MyChrome for Antigravity</h1>
    <p class="tagline">
      Chat with your Antigravity agent from a Chrome side panel. It works in the tabs you are signed in to and shows every step.
    </p>
    <div class="features">
      <span class="feat-pill">Works in your signed-in tabs</span>
      <span class="feat-pill">Scrapes any page</span>
      <span class="feat-pill">Shows every step</span>
      <span class="feat-pill">Free and open source</span>
    </div>
  </div>
  <div class="footer">
    Created by <strong>Ahmed Maky</strong> • <strong>github.com/ahmeddmakyy/antigravity-chrome-extension</strong>
  </div>
</body>
</html>`;

fs.writeFileSync('tools/brand-builder/banner-dark.html', darkBannerHtml, 'utf-8');
fs.writeFileSync('tools/brand-builder/banner-light.html', lightBannerHtml, 'utf-8');
fs.writeFileSync('tools/brand-builder/social-preview.html', socialPreviewHtml, 'utf-8');

console.log('HTML templates generated in tools/brand-builder/');

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

render('tools/brand-builder/banner-dark.html', 'docs/brand/banner-dark.png', 1600, 480);
render('tools/brand-builder/banner-light.html', 'docs/brand/banner-light.png', 1600, 480);
render('tools/brand-builder/social-preview.html', 'docs/brand/social-preview.png', 1280, 640);
