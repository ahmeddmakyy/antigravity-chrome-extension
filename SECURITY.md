# Security Policy

## Supported Versions

Security updates are provided only for the latest release of MyChrome.

| Version | Supported |
|---|---|
| Latest release | Yes |
| Older releases | No |

## Reporting a Vulnerability

Please report security vulnerabilities privately using a [GitHub Private Security Advisory](https://github.com/ahmeddmakyy/antigravity-chrome-extension/security/advisories/new) on this repository.

Do not report security issues through public GitHub issues or discussions. Please include reproduction steps, the affected version, and your environment.

## Security Model

MyChrome bridges your local Google Chrome browser with your local Google Antigravity installation. Because the agent can inspect web pages and perform browser actions, multiple defense layers are enforced:

### Localhost Isolation and Pairing
- **Loopback binding:** The bridge listens exclusively on `127.0.0.1` and rejects any request whose `Host` header is not a loopback address.
- **Key hand-off:** The bridge does not trust browser `Origin` headers. The extension authenticates with a secret key (compared in constant time). The helper writes that key to `pairing.json` inside the extension folder, which the extension reads by itself; the file is not web accessible, is excluded from git and from release packages, and is created with owner-only permissions where the platform supports it. There is no pairing code. Anything that can read your user files can read the key, which is the same exposure as the key file in `~/.gemini/mychrome/`.

### Approval Modes
- **Manually approve (default):** The extension prompts for user approval before:
  - Interacting with a domain for the first time in a session (Allow for this session / Always allow this site / Deny)
  - Clicking buttons that look risky (such as pay, buy, delete, send, or submit in English and Arabic)
  - Executing JavaScript on a page
  - Uploading files
  - Closing a tab
- **Automatically approve:** Skips the per-step approval prompts above. Automatic mode can only be enabled by the user after confirming a warning dialog, and is indicated on the button as "Auto". This setting controls MyChrome only and does not change any Antigravity permission settings.

### Enforced Safeguards (Both Modes)
- **Protected sites list:** Sites on the sensitive sites list (banks, payment processors, password managers, and major account login pages) are blocked unless explicitly added to "Protected sites you allow anyway".
- **Credential protection:** The agent is strictly blocked from typing or sending keys into password and payment card input fields. Users must fill these fields manually.
- **Protocol restrictions:** Navigation is restricted to `http:` and `https:`. Navigation to `file:`, `chrome:`, `javascript:`, `data:`, or `ftp:` is blocked.
- **File upload containment:** The `upload_file` tool can only send files that the user attached in the side panel (stored in `~/.gemini/mychrome/uploads/`). Arbitrary local filesystem paths, the pairing token file, UNC paths, directories, symlinks, and path traversal sequences (`..`) are rejected.

### Safety Settings
The side panel provides dedicated safety controls to:
- Toggle sensitive site protection.
- View and revoke domains previously granted persistent access.
- Manage a custom "Blocked sites" list that the agent must never access.
- Configure explicit "Protected sites you allow anyway" overrides.

## Scope and Limitations

### In Scope
- Bridge authentication and pairing token security
- Localhost network boundary enforcement
- File upload containment and path traversal protections
- Policy enforcement in the side panel and bridge

### Out of Scope and Known Limitations
- **Prompt injection:** Untrusted web pages may contain adversarial text designed to manipulate an AI agent. Manual approval mode is the primary defense against unexpected actions; automatic mode should only be used on trusted sites.
- **Operating system compromise:** An attacker with local access to your machine or user profile directory is outside the threat model.
- **Cloud AI model behavior:** Transmitted data is processed by Google's AI models according to Google's terms and privacy policy. Model-level reasoning errors or hallucinations are out of scope for MyChrome.
