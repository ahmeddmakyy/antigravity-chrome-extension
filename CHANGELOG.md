# Changelog

All notable changes to **MyChrome for Antigravity** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
