# Changelog

All notable changes to **MyChrome for Antigravity** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.3.0] - 2026-10-13

Safer by default: the extension now asks before it acts on a site, there is no pairing code to type, and a conversation link can no longer go stale.

### Added
- A conversation linked with `/mychrome` expires after 6 hours without use (`MYCHROME_LINK_TTL_HOURS` changes it). The status popover in the side panel shows which conversation is linked (first 8 characters and its age) and a "Start a new MyChrome conversation" button that drops the link at once. Before this, a link from days ago kept receiving what you typed in Chrome.
- Automatic key hand-off: the helper writes its secret key to `pairing.json` inside the extension folder and the extension loads it by itself, so nothing has to be typed or paired. The file is git-ignored, owner-only and not web accessible; a manual key field stays in Settings as a fallback.
- When you write in the panel and no Antigravity conversation is linked, MyChrome starts one conversation titled "MyChrome" in the Antigravity project `CLI Project` (set `MYCHROME_PROJECT_ID` to use another) and keeps using it. A conversation linked with `/mychrome` keeps priority.
- Approval mode selector in the side panel composer: "Manually approve" (default) and "Automatically approve" ("Auto", enabled only after user confirms a warning dialog).
- In manual mode, confirmation prompts before first-time domain access (Allow for this session / Always allow this site / Deny), risky button clicks (pay, buy, delete, send, submit in English and Arabic), JavaScript execution, file uploads, and closing tabs.
- Safety settings panel: sensitive site protection toggle, list of allowed domains with Revoke buttons, custom "Blocked sites" list, and "Protected sites you allow anyway" overrides.
- Protocol restrictions blocking navigation to non-HTTP/HTTPS URLs (`file:`, `chrome:`, `javascript:`, `data:`, `ftp:`).
- Pressing Enter inside a form whose submit button looks risky (or that holds a password or card field) asks first in manual mode, like a click on that button.

### Changed
- After updating from 5.2.0, reload the extension in `chrome://extensions` once: it no longer trusts the browser `Origin` header and connects with a secret key that it now loads by itself.
- Bridge listens on `127.0.0.1` only and rejects requests whose `Host` header is not a loopback address.
- Restricted `upload_file` tool to files attached by the user in the side panel (stored in `~/.gemini/mychrome/uploads/`); arbitrary local paths, the token file, UNC paths, directories, symlinks, and path traversal (`..`) are rejected.
- Approval mode toggle controls only MyChrome behavior and does not change any Antigravity permission settings.

### Security
- Tools the extension does not know are blocked in both modes.
- Keys are never sent into an embedded frame that MyChrome cannot inspect (payment providers draw their card fields in such frames), in both modes.
- Prompt injection defenses: manual approval mode is enabled by default to prevent untrusted web page content from performing unconfirmed actions.
- Hard block on typing or sending keystrokes into password and payment card input fields in both manual and automatic modes.
- Built-in protected sites list (banks, payment services, password managers, and major account login pages) blocked by default in both modes unless explicitly allowed by the user.

## [5.2.0] - 2026-10-07

One helper process now keeps MyChrome connected for as long as Antigravity is open.

### Changed
- The "MyChrome helper" sidecar (`dist/daemon.js`) owns port 8765, the Chrome connection, the linked conversation and the wake-up loop. Antigravity starts it when the app opens.
- The MCP server that the plugin registers (`dist/index.js`) no longer opens port 8765. Antigravity starts one per conversation; each one forwards tool calls to the helper over `POST /rpc`. This removes the port takeovers between conversations that broke the wake-up and forced `/mychrome` before every message.
- If the helper is not running yet (right after install), the MCP server starts it in the background.

### Added
- `/mychrome` opens Chrome when it is closed and waits for the extension. `/mychrome <task>` does the task in Chrome and answers in the Antigravity chat.
- Browser tools open Chrome and wait up to 15 seconds instead of failing when the extension is not connected.
- `GET /connect` page: wakes a sleeping extension instantly (through `externally_connectable`), then the tab closes itself.
- `GET /connected`, and the panel reconnects at once when it opens.

### Fixed
- Panel messages now wake the agent even when Antigravity does not start the sidecar: the helper finds `agentapi` in `~/.gemini/antigravity/bin` (and the `-cli` and `-ide` folders), not only on PATH. Waker messages go to `bridge.log`.
- The agent no longer sits in `wait_for_user_message` polls after a reply ("waiting for a reply"). It always ends its turn; a message sent while no wake channel is up waits in the queue and goes out as soon as the waker connects.
- The Windows installer writes every JSON file without a UTF-8 BOM, and removes the BOM that versions 5.0 and 5.1 may have added to Antigravity's `config.json`, `mcp_config.json`, `hooks.json` and `sidecar.json`.
- The side panel no longer shifts sideways when a reply makes the scrollbar appear (`scrollbar-gutter: stable`).
- The answer no longer jumps when the tool cards fold: they fold after the answer is written, with the scroll position kept.
- Clicking a step no longer turns off following the answer as it is written.
- Upload file names are sanitized the same way on every OS (backslashes too).
- The version banner says "Reload on MyChrome".

## [5.1.0] - 2026-10-07

### Added
- **File & Screenshot Attachment System**:
  - Replaced camera button with an Attach button (paperclip icon) featuring a dropdown menu for file uploads and tab screenshots.
  - Drag-and-drop overlay onto side panel and Ctrl+V clipboard image pasting.
  - Support for images (`png`, `jpg`, `webp`, `gif`), documents (`pdf`), text (`txt`, `md`, `csv`, `json`, `html`, `xml`), and Office formats (`docx`, `xlsx`, `pptx`).
  - Automatic downscaling for images larger than 2000px.
  - In-chat attachment chips with thumbnail previews (8 KB max in local storage).
- **Upload Manager**:
  - Secure storage in `~/.gemini/mychrome/uploads/<yyyy-mm-dd>/<messageId>-<n>-<safe-name>`.
  - Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, etc.) and path traversal sanitization.
  - Automatic deletion of uploads older than 7 days on startup.
- **Offline Health Check (`/ping`)**:
  - Unauthenticated `GET /ping` endpoint on the bridge HTTP server.
  - Background worker checks `/ping` before attempting WebSocket connection, eliminating `ERR_CONNECTION_REFUSED` error noise in `chrome://extensions` when Antigravity is closed.
  - Exponential backoff (2s, 5s, 15s, 30s, 60s) when helper is offline, with instant reconnect upon side panel open.
- **Automated Test Suite**:
  - Added `upload.test.js` validating sanitization, size limits, saving, and 7-day cleanup.
  - Added `version-sync.test.js` ensuring strict version alignment across extension and bridge.

### Changed
- Refreshed brand banners and social preview assets with updated feature chips ("Works in your signed-in tabs", "Scrapes any page", "Shows every step", "Free and open source") and side panel mockup.
- Regenerated README screenshot (`docs/screens/panel-working-en.png`) as a dedicated 420px portrait panel crop.
- Updated skill instructions to inspect attached images and documents prior to replying.

---

## [5.0.0] - 2026-10-07

### Added
- Initial public release of MyChrome for Antigravity.
- Zero-token idle waker sidecar and Stop hook integration.
- Turnkey one-message installation via Antigravity (`install.ps1` and `install.sh`).
- Origin-based auto-pairing for the Chrome extension without manual pairing tokens.
- Chrome side panel with live turn inspector, task status pills, and interactive plan adjustments.
