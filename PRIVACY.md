# Privacy & Data Handling

MyChrome operates entirely on your local machine.

- **No Remote Servers:** MyChrome connects your Chrome extension to your local Google Antigravity instance over localhost (`127.0.0.1`). No telemetry, analytics, or external tracking servers are used.
- **Signed-in Tabs:** The extension only interacts with the tabs and pages you direct it to. Sensitive actions (payments, sending messages, deletions) require your confirmation, and credentials are never typed by the agent.
- **File Uploads & Attachments:** Files attached in the side panel are stored locally in `~/.gemini/mychrome/uploads/` and are automatically deleted after 7 days.
- **Chat History & Logs:** Kept exclusively in Chrome's local extension storage and your local machine's `~/.gemini/mychrome/logs/` directory.
