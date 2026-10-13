// shared/pairing.js
// Pure helpers for bridge key parsing and trusted external connect checks.
// Pure ES module with no DOM or Chrome APIs, importable in Node and extension service workers.

/**
 * Parses the raw text of pairing.json and returns the token string, or null.
 * Accepts only valid JSON objects whose token is a string matching /^[0-9a-f]{32,128}$/i.
 * Rejects everything else (arrays, numbers, empty text, input over 2000 characters, wrong types).
 *
 * @param {unknown} text
 * @returns {string|null}
 */
export function parseBundledKey(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > 2000) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    if (typeof parsed.token === "string" && /^[0-9a-f]{32,128}$/i.test(parsed.token)) {
      return parsed.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates that an external wake sender URL originates from the trusted localhost connect page.
 * Returns true only when:
 * - the URL parses
 * - protocol is http:
 * - hostname is 127.0.0.1 or localhost
 * - port equals the configured bridge port (number or numeric string)
 * - pathname starts with /connect
 *
 * @param {string} [senderUrl]
 * @param {number|string} [port]
 * @returns {boolean}
 */
export function isTrustedConnectSender(senderUrl, port) {
  if (!senderUrl || typeof senderUrl !== "string") return false;
  if (port === undefined || port === null || port === "") return false;

  const expectedPort = String(port).trim();
  if (!/^\d+$/.test(expectedPort)) return false;

  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== "http:") return false;

    const host = parsed.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") return false;

    const actualPort = parsed.port || (parsed.protocol === "http:" ? "80" : "");
    if (actualPort !== expectedPort) return false;

    if (!parsed.pathname.startsWith("/connect")) return false;

    return true;
  } catch {
    return false;
  }
}
