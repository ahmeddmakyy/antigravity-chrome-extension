# Changelog

All notable changes to **MyChrome for Antigravity** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
