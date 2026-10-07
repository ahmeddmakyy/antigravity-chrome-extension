import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

test("version sync: all components share the exact same version string", () => {
  // 1. extension/manifest.json
  const manifestPath = path.join(ROOT, "extension", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const manifestVer = manifest.version;

  // 2. bridge/package.json
  const pkgPath = path.join(ROOT, "bridge", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const pkgVer = pkg.version;

  // 3. extension/background.js BUILD constant
  const bgPath = path.join(ROOT, "extension", "background.js");
  const bgContent = fs.readFileSync(bgPath, "utf-8");
  const bgMatch = bgContent.match(/const\s+BUILD\s*=\s*["']([^"']+)["']/);
  assert.ok(bgMatch, "background.js must define BUILD constant");
  const bgVer = bgMatch[1];

  // 4. extension/sidepanel.js PANEL_BUILD constant
  const spPath = path.join(ROOT, "extension", "sidepanel.js");
  const spContent = fs.readFileSync(spPath, "utf-8");
  const spMatch = spContent.match(/const\s+PANEL_BUILD\s*=\s*["']([^"']+)["']/);
  assert.ok(spMatch, "sidepanel.js must define PANEL_BUILD constant");
  const spVer = spMatch[1];

  // 5. bridge/src/version.ts BRIDGE_VERSION constant
  const verTsPath = path.join(ROOT, "bridge", "src", "version.ts");
  const verTsContent = fs.readFileSync(verTsPath, "utf-8");
  const verTsMatch = verTsContent.match(/export\s+const\s+BRIDGE_VERSION\s*=\s*["']([^"']+)["']/);
  assert.ok(verTsMatch, "version.ts must define BRIDGE_VERSION constant");
  const verTsVer = verTsMatch[1];

  assert.equal(manifestVer, "5.1.0", "manifest.json version is 5.1.0");
  assert.equal(pkgVer, manifestVer, "bridge/package.json version matches manifest");
  assert.equal(bgVer, manifestVer, "background.js BUILD matches manifest");
  assert.equal(spVer, manifestVer, "sidepanel.js PANEL_BUILD matches manifest");
  assert.equal(verTsVer, manifestVer, "bridge/src/version.ts BRIDGE_VERSION matches manifest");
});
