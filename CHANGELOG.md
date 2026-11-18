# Changelog

All notable changes to MyChrome are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-18

First public release.

### The side panel
- Chat with your Google Antigravity agent from a Chrome side panel, in English or Arabic, light or dark.
- Every browser action appears as a step with the agent's reason, its request and result, and screenshots; long tasks show a checklist.
- Model picker: Gemini 4 Hydrogen by default, plus Argon, Carbon, Gemini 3.8 Flash, Claude Sonnet 5.5 and Claude Opus 5.5, for conversations the panel starts. A conversation linked with `/mychrome` keeps the model chosen in Antigravity.
- Saved shortcuts with `/`, standing instructions in Settings, Quote from a selected answer, attachments and tab screenshots, collapsed long messages.
- Desktop notifications when a task finishes or needs you, only while Chrome is in the background. Alt+Shift+M opens or closes the panel.

### In the tab
- A soft glow in the Google colors lights the tab the agent is working in, an arrow glides to each click or hover target, and a caption says what it is doing, with a Stop pill that confirms the stop reached the agent.
- The tab's icon shows the state: an arrow while working, a bell when it needs you, a check when done. The MyChrome tab group title gets the same marks and folds itself after a task.
- The overlay stays out of screenshots without leaving the page layout.

### Safety
- Manual mode (default) asks before the first visit to a site, before risky clicks such as pay, send or delete, before running scripts, uploading files or closing tabs. Auto mode skips the prompts after a warning.
- Plan approval: the agent lists the sites its plan will visit and you approve them once.
- Banking, payment and other sensitive sites are protected unless you allow them; your own blocklist; password and card fields are never typed into.
- Risky links in answers (credentials in the address, look-alike domains) warn before opening.
- The helper listens on 127.0.0.1 only, the extension and helper share a key without any pairing step, and uploads are limited to files you attached.

### Speed
- `browser_batch` runs up to 20 actions in one agent turn.
- `read_page` returns one compact line per element; tool results are compact.
- `navigate` returns when the page is usable, without waiting for every ad.
- Screenshots are sized in CSS pixels, so they are smaller and their coordinates are click coordinates on high-DPI screens; `zoom` reads small details.

### Install
- One message to Antigravity installs the helper, the Antigravity plugin and the extension files on Windows, macOS and Linux.
