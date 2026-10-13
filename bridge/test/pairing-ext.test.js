import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBundledKey,
  isTrustedConnectSender,
} from "../../extension/shared/pairing.js";

test("parseBundledKey: accepts valid token and uppercase hex", () => {
  const valid48 = "0123456789abcdef0123456789abcdef0123456789abcdef";
  assert.equal(parseBundledKey(JSON.stringify({ token: valid48 })), valid48);

  const valid32 = "0123456789abcdef0123456789abcdef";
  assert.equal(parseBundledKey(JSON.stringify({ token: valid32 })), valid32);

  const upper48 = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
  assert.equal(parseBundledKey(JSON.stringify({ token: upper48 })), upper48);

  const mixed = "0123456789aBcDeF0123456789AbCdEf0123456789AbCdEf";
  assert.equal(parseBundledKey(JSON.stringify({ token: mixed })), mixed);
});

test("parseBundledKey: rejects missing token, wrong type, or invalid length/chars", () => {
  // missing token
  assert.equal(parseBundledKey(JSON.stringify({})), null);
  assert.equal(parseBundledKey(JSON.stringify({ other: "0123456789abcdef0123456789abcdef" })), null);

  // token too short (< 32 hex chars)
  assert.equal(parseBundledKey(JSON.stringify({ token: "0123456789abcdef" })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: "123456" })), null);

  // token with non-hex characters
  assert.equal(parseBundledKey(JSON.stringify({ token: "0123456789abcdef0123456789abcdef0123456789abcdeg" })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: "0123456789abcdef0123456789abcdef-0123456789abc" })), null);

  // token of the wrong type
  assert.equal(parseBundledKey(JSON.stringify({ token: 12345 })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: true })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: null })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: ["0123456789abcdef0123456789abcdef"] })), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: { a: 1 } })), null);
});

test("parseBundledKey: rejects non-object JSON, empty/invalid text, and oversize inputs", () => {
  const valid48 = "0123456789abcdef0123456789abcdef0123456789abcdef";

  // JSON array
  assert.equal(parseBundledKey(JSON.stringify([{ token: valid48 }])), null);

  // number
  assert.equal(parseBundledKey("12345"), null);
  assert.equal(parseBundledKey(12345), null);

  // empty string
  assert.equal(parseBundledKey(""), null);
  assert.equal(parseBundledKey(null), null);
  assert.equal(parseBundledKey(undefined), null);

  // invalid JSON
  assert.equal(parseBundledKey("{ not valid json"), null);
  assert.equal(parseBundledKey("{token: bad}"), null);

  // oversize input (> 2000 chars)
  assert.equal(parseBundledKey("a".repeat(2001)), null);
  assert.equal(parseBundledKey(JSON.stringify({ token: valid48, pad: "x".repeat(2100) })), null);
});

test("isTrustedConnectSender: accepts valid connect URLs with configured port", () => {
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", 8765), true);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", "8765"), true);
  assert.equal(isTrustedConnectSender("http://localhost:8765/connect", 8765), true);
  assert.equal(isTrustedConnectSender("http://localhost:8765/connect?x=1", 8765), true);
  assert.equal(isTrustedConnectSender("http://localhost:8765/connect?x=1", "8765"), true);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect#section", 8765), true);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect/step2", 8765), true);

  // Different configured port
  assert.equal(isTrustedConnectSender("http://127.0.0.1:9500/connect", 9500), true);
  assert.equal(isTrustedConnectSender("http://localhost:9500/connect", "9500"), true);
});

test("isTrustedConnectSender: rejects other ports, https, evil hosts, and other paths", () => {
  // Other ports
  assert.equal(isTrustedConnectSender("http://127.0.0.1:9000/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://localhost:8080/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", 9000), false);

  // HTTPS rejected
  assert.equal(isTrustedConnectSender("https://127.0.0.1:8765/connect", 8765), false);
  assert.equal(isTrustedConnectSender("https://localhost:8765/connect", 8765), false);

  // Other hosts (spoofing / non-local)
  assert.equal(isTrustedConnectSender("http://127.0.0.1.evil.com:8765/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://localhost.evil.com:8765/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://evil.com:8765/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://192.168.1.5:8765/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://0.0.0.0:8765/connect", 8765), false);

  // Paths other than /connect
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/", 8765), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/other", 8765), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/api/connect", 8765), false);
  assert.equal(isTrustedConnectSender("http://localhost:8765/settings", 8765), false);

  // Garbage and undefined
  assert.equal(isTrustedConnectSender("garbage", 8765), false);
  assert.equal(isTrustedConnectSender("not a url", 8765), false);
  assert.equal(isTrustedConnectSender("", 8765), false);
  assert.equal(isTrustedConnectSender(null, 8765), false);
  assert.equal(isTrustedConnectSender(undefined, 8765), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", undefined), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", null), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", ""), false);
  assert.equal(isTrustedConnectSender("http://127.0.0.1:8765/connect", "abc"), false);
});
