import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const entryPoints = [
  path.join(__dirname, "src", "index.ts"),
  path.join(__dirname, "src", "daemon.ts"),
  path.join(__dirname, "src", "remote-bridge.ts"),
  path.join(__dirname, "src", "stop-hook.ts"),
  path.join(__dirname, "src", "waker.ts"),
  path.join(__dirname, "src", "setup.ts"),
  path.join(__dirname, "src", "constants.ts"),
  path.join(__dirname, "src", "ws-server.ts"),
  path.join(__dirname, "src", "logger.ts"),
  path.join(__dirname, "src", "paths.ts"),
  path.join(__dirname, "src", "version.ts"),
  path.join(__dirname, "src", "token.ts"),
  path.join(__dirname, "src", "upload-manager.ts"),
];

console.log("Building MyChrome bridge with esbuild...");

try {
  await esbuild.build({
    entryPoints,
    outdir: distDir,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    sourcemap: false,
    minify: false,
    banner: {
      js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
    },
  });
  console.log("Build complete. Output written to bridge/dist/");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
