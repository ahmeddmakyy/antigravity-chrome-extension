# MyChrome 1.0 pre-release audit

Date: 18 November 2026. Scope: the whole repository before the first public release.

Five independent reviews ran in parallel, each limited to one area so their findings would not overlap:

| Review | Area |
|---|---|
| Extension safety | `background.js`, `content.js`, `bg/page-scripts.js`, `shared/policy.js`, the manifest |
| Side panel | `sidepanel.js`, `sidepanel.html`, `sidepanel.css`, locales |
| Local helper | `bridge/src` (WebSocket and HTTP server, MCP server, waker, Stop hook), its tests |
| Install and release | `install.ps1`, `install.sh`, the Antigravity plugin, CI, the docs, the architecture |
| Code, tests and docs | the clean-code, test and docs checklists from [guard-skills](https://github.com/amElnagdy/guard-skills) |

Every finding was checked against the code before it was fixed. After the fixes, all 135 tests pass (one more is skipped on Windows by design), the privacy scan is clean, both installers were run end to end from the release package (install, a piped `curl | bash` install, and uninstall), and the side panel passes the WCAG AA contrast check in light and dark.

## Architecture in one page

- **Extension (Chrome, Manifest V3).** A side panel for the chat, a service worker that holds the safety policy and drives tabs through `chrome.debugger` and `chrome.scripting`, and a small overlay in the page (glow, cursor, caption, Stop).
- **Helper (Node, `127.0.0.1:8765`).** Started by Antigravity as a sidecar. It speaks WebSocket to the extension, serves the MCP tools to the agent, and wakes the agent with Antigravity's `agentapi` when you write in the panel.
- **Trust boundaries.** Web pages are untrusted and can contain prompt injections. The extension and the helper share one random key on your disk. The helper only accepts loopback requests with a loopback `Host`.
- **On disk.** `~/.gemini/mychrome/`: the extension and helper files, the key, the linked conversation, attachments (deleted after 7 days) and a rotating log. Uninstalling removes all of it.

## What was fixed

### Critical and high

| Area | Problem | Fix |
|---|---|---|
| Side panel | Agent answers were sanitized with permissive defaults, so a web page could make an answer replace the composer, load remote images or restyle the panel. | Answers allow Markdown only (no ids, styles, forms, media; links must be web or mail links; no class names except code languages), and the panel has a content security policy. |
| Extension | Approving site access also let a risky click, script or upload on that site through without its own question. | Every approval is followed by a fresh policy check; the action runs only when all checks pass. |
| Extension | `type` without a target skipped the password and card-field check. | The focused element is always inspected, and typing must land in a field that actually took focus. |
| Extension | A stale element ref let the agent click a risky button without a question. | Checking and clicking use the same lookup, and an unknown ref fails closed. |
| Extension | Protected sites and the blocklist did not apply on `blob:` and `about:blank` tabs. | `blob:` pages use the site that created them; other non-web tabs are refused. |
| Extension | Enter, Space, or typing with submit could activate a risky button without a question. | They ask like a click. |
| Helper | One malformed WebSocket frame from any local program crashed the helper. | Socket errors close that connection only. |
| Helper | A very long panel message stopped the waker for good on Windows. | Long prompts are passed safely, text is capped, and failed deliveries stop after three tries. |
| Helper | Plan approval did not work in the normal (helper) mode. | The call is allowed over the helper's RPC, and a test now checks every call the agent tools make. |
| Installer | `curl … \| bash` failed on every run. | Fixed, and CI now tests the piped install. |
| Installer | Downloads were not verified. | The release package and Node.js are checked against published SHA-256 checksums; installs fail on a mismatch or a missing file. |

### Medium

- Navigation opens exactly the address the policy approved; app links such as `mailto:` or `ms-settings:` are refused.
- A click into an embedded frame (where payment buttons live) asks first.
- `wait` needs site access when it reads the page.
- A plan grants the sites it lists exactly, never their subdomains, a bare top-level domain or a shared hosting suffix.
- Script approvals show the whole script (up to 4000 characters, marked when cut).
- The in-page overlay uses a closed shadow root and only reacts to real clicks.
- `read_page` never reports card numbers, security codes or one-time codes.
- After an approval, the action is cancelled if the tab moved to another site meanwhile.
- Only real side panels can connect to the extension's panel channel.
- The approval card no longer takes focus while you type; Escape denies only when you are on the card.
- A reconnect or a language switch no longer duplicates a turn or drops an open approval.
- A conversation linked by id is not taken over by another conversation's Stop hook.
- Stop applies to the task you stopped, not to later ones.
- Hold mode waits its full 30 minutes (the Stop hook no longer gives up after 5).
- Creating a panel conversation retries without a model only when the model was rejected, so a request is never run twice.
- Page text reaches the agent inside marked, unguessable delimiters.
- Websites can no longer detect MyChrome through its files or its `/ping` answer.
- The installers stop only the MyChrome helper, never another program on port 8765; uninstall removes everything; updates clear old files first; Linux no longer waits for Chrome to close.
- Node.js 24 LTS replaces the end-of-life Node 20.
- Contrast of small help text raised to WCAG AA; visible focus rings.
- Docs corrected: updating, uninstalling, network requests, attachment cleanup, the agent skill's instructions.

## Known limitations

These are accepted for 1.0 and tracked for later:

- **One key on disk.** Any program running as you can read the shared key and drive Chrome through the helper. A challenge-response handshake would protect against a fake helper on the port; it is planned.
- **Prompt injection.** Pages can try to steer the agent. MyChrome limits the damage (approvals, protected sites, blocked password and card fields) but cannot make a model immune. Auto mode removes the prompts.
- **Unpacked extension.** It loads from a folder you can write to and has no automatic update; re-run the installer to update.
- **Code health.** The password and card-field check exists in four page scripts and should be one; a few functions are long; some tests use real-time waits. None of these changes behavior today.
