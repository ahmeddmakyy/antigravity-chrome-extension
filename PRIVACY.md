# Privacy & Data Handling

MyChrome operates on your local machine between Google Chrome and your local Google Antigravity installation.

- **Local Communication & No Remote Servers:** The MyChrome extension connects to the local bridge process on localhost (`127.0.0.1`) using a secret pairing token. MyChrome runs no remote servers and collects no telemetry or analytics.
- **Data Sent to AI Models:** While MyChrome itself has no external servers, the content of pages the agent reads, screenshots, and attached files are passed to your local Antigravity agent. Antigravity sends this data to Google's AI models subject to Google's terms and privacy policy. Pages you visit may also contain untrusted text or prompt injections intended to manipulate the agent.
- **Approval Modes & Sensitive Actions:** In manual approval mode (the default), the extension requires your confirmation before using a site for the first time, executing JavaScript, uploading files, closing tabs, or clicking buttons that look risky (such as pay, buy, delete, send, or submit in English and Arabic). In automatic approval mode, these per-step prompts are skipped. In both modes, typing or sending keystrokes into password and payment card fields is strictly blocked, and navigation to non-HTTP/HTTPS URLs is blocked.
- **Protected Sites:** High-risk sites (including banks, payment processors, password managers, and major account login pages) are blocked by default in both modes unless explicitly added to "Protected sites you allow anyway".
- **File Uploads & Attachments:** The agent can only upload files that you explicitly attach in the side panel. Uploads are stored locally in `~/.gemini/mychrome/uploads/` and are automatically deleted after 7 days. Arbitrary filesystem paths, the token file, UNC paths, directories, symlinks, and path traversal (`..`) are rejected.
- **Chat History & Logs:** Saved exclusively in Chrome extension local storage and on your local machine in `~/.gemini/mychrome/logs/`.
