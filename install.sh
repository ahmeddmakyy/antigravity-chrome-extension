#!/usr/bin/env bash
#
# MyChrome installer and updater for Antigravity (macOS and Linux).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ahmeddmakyy/antigravity-chrome-extension/main/install.sh | bash
#   ./install.sh --check
#   ./install.sh --uninstall
#   ./install.sh --source mychrome-v5.1.0.zip --home-dir /tmp/test-home

set -euo pipefail

REPO_OWNER="ahmeddmakyy"
REPO_NAME="antigravity-chrome-extension"
EXTENSION_ID="aeofpcedejopeeebdjfkapcabkkflhej"
PORT=8765

CHECK_MODE=0
UNINSTALL_MODE=0
SOURCE_ZIP=""
CUSTOM_HOME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check|-Check|-check)
      CHECK_MODE=1
      shift
      ;;
    --uninstall|-Uninstall|-uninstall)
      UNINSTALL_MODE=1
      shift
      ;;
    --source|-Source)
      SOURCE_ZIP="$2"
      shift 2
      ;;
    --home-dir|-HomeDir)
      CUSTOM_HOME="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

USER_HOME="${CUSTOM_HOME:-$HOME}"
GEMINI_DIR="$USER_HOME/.gemini"
MYCHROME_DIR="$GEMINI_DIR/mychrome"
EXTENSION_DIR="$MYCHROME_DIR/extension"
BRIDGE_DIR="$MYCHROME_DIR/bridge"
RUNTIME_DIR="$MYCHROME_DIR/runtime"
LOGS_DIR="$MYCHROME_DIR/logs"

CONFIG_DIR="$GEMINI_DIR/config"
PLUGINS_DIR="$CONFIG_DIR/plugins"
MYCHROME_PLUGIN_DIR="$PLUGINS_DIR/mychrome"
SIDECARS_DIR="$CONFIG_DIR/sidecars"
MYCHROME_SIDECAR_DIR="$SIDECARS_DIR/mychrome-waker"
CONFIG_JSON="$CONFIG_DIR/config.json"
HOOKS_JSON="$CONFIG_DIR/hooks.json"
ANTIGRAVITY_MCP="$GEMINI_DIR/antigravity/mcp_config.json"
CONFIG_MCP="$CONFIG_DIR/mcp_config.json"
TOKEN_FILE="$MYCHROME_DIR/.token"

backup_file() {
  local target="$1"
  if [[ -f "$target" || -d "$target" ]]; then
    local ts
    ts=$(date +"%Y%m%d-%H%M%S")
    cp -r "$target" "${target}.bak-${ts}"
    echo " [OK] Backed up $(basename "$target") to $(basename "${target}.bak-${ts}")"
  fi
}

# ---------------------------------------------------------------------------
# Check Mode
# ---------------------------------------------------------------------------
if [[ $CHECK_MODE -eq 1 ]]; then
  echo "=== MyChrome Diagnostics & Health Check ==="
  echo "User home: $USER_HOME"

  if command -v node >/dev/null 2>&1; then
    echo " [OK] Node on PATH: $(which node) ($(node -v))"
  elif [[ -x "$RUNTIME_DIR/bin/node" ]]; then
    echo " [OK] Portable Node: $RUNTIME_DIR/bin/node ($("$RUNTIME_DIR/bin/node" -v))"
  else
    echo " [WARN] No Node.js binary found"
  fi

  if [[ -f "$EXTENSION_DIR/manifest.json" ]]; then
    echo " [OK] Extension installed at $EXTENSION_DIR"
  else
    echo " [WARN] Extension not installed at $EXTENSION_DIR"
  fi

  if [[ -f "$MYCHROME_PLUGIN_DIR/plugin.json" ]]; then
    echo " [OK] Plugin installed at $MYCHROME_PLUGIN_DIR"
  else
    echo " [WARN] Plugin missing at $MYCHROME_PLUGIN_DIR"
  fi

  if [[ -f "$MYCHROME_SIDECAR_DIR/sidecar.json" ]]; then
    echo " [OK] Sidecar installed at $MYCHROME_SIDECAR_DIR"
  else
    echo " [WARN] Sidecar missing at $MYCHROME_SIDECAR_DIR"
  fi

  if [[ -f "$TOKEN_FILE" ]]; then
    echo " [OK] Pairing token exists at $TOKEN_FILE"
  else
    echo " [WARN] Pairing token missing at $TOKEN_FILE"
  fi

  if [[ -f "$LOGS_DIR/hook-trace.log" ]]; then
    echo ""
    echo "Last lines of hook trace ($LOGS_DIR/hook-trace.log):"
    tail -n 10 "$LOGS_DIR/hook-trace.log" || true
  fi

  exit 0
fi

# ---------------------------------------------------------------------------
# Uninstall Mode
# ---------------------------------------------------------------------------
if [[ $UNINSTALL_MODE -eq 1 ]]; then
  echo "Uninstalling MyChrome..."

  if [[ -d "$MYCHROME_PLUGIN_DIR" ]]; then
    rm -rf "$MYCHROME_PLUGIN_DIR"
    echo " [OK] Removed plugin $MYCHROME_PLUGIN_DIR"
  fi

  if [[ -d "$MYCHROME_SIDECAR_DIR" ]]; then
    rm -rf "$MYCHROME_SIDECAR_DIR"
    echo " [OK] Removed sidecar $MYCHROME_SIDECAR_DIR"
  fi

  if [[ -f "$CONFIG_JSON" ]]; then
    backup_file "$CONFIG_JSON"
    if command -v node >/dev/null 2>&1; then
      node -e "
        const fs = require('fs');
        try {
          const cfg = JSON.parse(fs.readFileSync('$CONFIG_JSON', 'utf-8'));
          if (cfg.sidecars && cfg.sidecars['mychrome-waker']) {
            delete cfg.sidecars['mychrome-waker'];
            fs.writeFileSync('$CONFIG_JSON', JSON.stringify(cfg, null, 2), 'utf-8');
          }
        } catch {}
      "
    fi
  fi

  rm -rf "$EXTENSION_DIR" "$BRIDGE_DIR" "$RUNTIME_DIR"
  echo " [OK] Removed extension, bridge and runtime folders"
  echo "MyChrome uninstalled successfully. (Logs in $LOGS_DIR were preserved)."
  exit 0
fi

# ---------------------------------------------------------------------------
# Installation / Update Flow
# ---------------------------------------------------------------------------
echo "=========================================="
echo "    MyChrome for Antigravity Installer    "
echo "=========================================="

mkdir -p "$MYCHROME_DIR" "$EXTENSION_DIR" "$BRIDGE_DIR" "$RUNTIME_DIR" "$LOGS_DIR" "$PLUGINS_DIR" "$SIDECARS_DIR"

# 1. Node runtime detection
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | tr -d 'v')
  MAJOR_VER=$(echo "$NODE_VER" | cut -d. -f1)
  if [[ "$MAJOR_VER" -ge 20 ]]; then
    NODE_BIN=$(command -v node)
    echo " [OK] Found system Node.js $(node -v) ($NODE_BIN)"
  else
    echo " [WARN] System Node.js $(node -v) is older than v20"
  fi
fi

if [[ -z "$NODE_BIN" ]]; then
  if [[ -x "$RUNTIME_DIR/bin/node" ]]; then
    NODE_BIN="$RUNTIME_DIR/bin/node"
    echo " [OK] Using portable Node.js ($("$NODE_BIN" -v))"
  else
    echo "Downloading portable Node.js LTS (v20.18.0)..."
    OS_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH_NAME=$(uname -m)
    if [[ "$ARCH_NAME" == "x86_64" ]]; then
      ARCH_NAME="x64"
    elif [[ "$ARCH_NAME" == "aarch64" || "$ARCH_NAME" == "arm64" ]]; then
      ARCH_NAME="arm64"
    fi

    TAR_NAME="node-v20.18.0-${OS_NAME}-${ARCH_NAME}.tar.gz"
    TAR_URL="https://nodejs.org/dist/v20.18.0/${TAR_NAME}"
    curl -fsSL "$TAR_URL" -o "$RUNTIME_DIR/node-temp.tar.gz"
    tar -xzf "$RUNTIME_DIR/node-temp.tar.gz" -C "$RUNTIME_DIR" --strip-components=1
    rm -f "$RUNTIME_DIR/node-temp.tar.gz"
    NODE_BIN="$RUNTIME_DIR/bin/node"
    echo " [OK] Installed portable Node: $NODE_BIN"
  fi
fi

# 2. Extract or Download release
EXTRACT_DIR=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [[ -n "$SOURCE_ZIP" && -f "$SOURCE_ZIP" ]]; then
  echo "Extracting local release source: $SOURCE_ZIP"
  EXTRACT_DIR=$(mktemp -d)
  unzip -q -o "$SOURCE_ZIP" -d "$EXTRACT_DIR"
elif [[ -d "$SCRIPT_DIR/extension" && -d "$SCRIPT_DIR/bridge/dist" ]]; then
  EXTRACT_DIR="$SCRIPT_DIR"
else
  echo "Downloading latest release from GitHub..."
  RELEASE_API="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
  DOWNLOAD_URL=$(curl -fsSL "$RELEASE_API" | grep -o 'https://[^"]*mychrome[^"]*\.zip' | head -n 1)
  TEMP_ZIP=$(mktemp)
  curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_ZIP"
  EXTRACT_DIR=$(mktemp -d)
  unzip -q -o "$TEMP_ZIP" -d "$EXTRACT_DIR"
  rm -f "$TEMP_ZIP"
fi

# Copy extension
cp -r "$EXTRACT_DIR/extension/." "$EXTENSION_DIR/"
echo " [OK] Extension files deployed to $EXTENSION_DIR"

# Copy bridge dist
mkdir -p "$BRIDGE_DIR/dist"
cp -r "$EXTRACT_DIR/bridge/dist/." "$BRIDGE_DIR/dist/"
echo " [OK] Bridge bundle deployed to $BRIDGE_DIR/dist"

# 3. Fresh pairing token
if [[ ! -f "$TOKEN_FILE" ]]; then
  NEW_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  echo "$NEW_TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  echo " [OK] Generated fresh pairing token in $TOKEN_FILE"
fi

# 4. Migration from v3/v4
for mcp in "$ANTIGRAVITY_MCP" "$CONFIG_MCP"; do
  if [[ -f "$mcp" ]] && grep -q "antigravity-browser-bridge" "$mcp"; then
    backup_file "$mcp"
    "$NODE_BIN" -e "
      const fs = require('fs');
      try {
        const c = JSON.parse(fs.readFileSync('$mcp', 'utf-8'));
        if (c.mcpServers && c.mcpServers['antigravity-browser-bridge']) {
          delete c.mcpServers['antigravity-browser-bridge'];
          fs.writeFileSync('$mcp', JSON.stringify(c, null, 2), 'utf-8');
        }
      } catch {}
    "
    echo " [OK] Cleaned deprecated antigravity-browser-bridge from $mcp"
  fi
done

if [[ -f "$HOOKS_JSON" ]] && grep -q "mychrome-bridge" "$HOOKS_JSON"; then
  backup_file "$HOOKS_JSON"
  "$NODE_BIN" -e "
    const fs = require('fs');
    try {
      const h = JSON.parse(fs.readFileSync('$HOOKS_JSON', 'utf-8'));
      if (h['mychrome-bridge']) {
        delete h['mychrome-bridge'];
        fs.writeFileSync('$HOOKS_JSON', JSON.stringify(h, null, 2), 'utf-8');
      }
    } catch {}
  "
  echo " [OK] Cleaned deprecated mychrome-bridge hook from $HOOKS_JSON"
fi

if [[ -d "$CONFIG_DIR/skills/mychrome" ]]; then
  backup_file "$CONFIG_DIR/skills/mychrome"
  rm -rf "$CONFIG_DIR/skills/mychrome"
  echo " [OK] Cleaned standalone legacy skill"
fi

# 5. Plugin Deployment
mkdir -p "$MYCHROME_PLUGIN_DIR"
cp -r "$EXTRACT_DIR/plugin/." "$MYCHROME_PLUGIN_DIR/"

BRIDGE_ENTRY="$BRIDGE_DIR/dist/index.js"
HOOK_ENTRY="$BRIDGE_DIR/dist/stop-hook.js"
WAKER_ENTRY="$BRIDGE_DIR/dist/waker.js"

# Generate plugin/mcp_config.json
sed -e "s|{{NODE_PATH}}|$NODE_BIN|g" \
    -e "s|{{BRIDGE_PATH}}|$BRIDGE_ENTRY|g" \
    "$MYCHROME_PLUGIN_DIR/mcp_config.template.json" > "$MYCHROME_PLUGIN_DIR/mcp_config.json"
echo " [OK] Generated $MYCHROME_PLUGIN_DIR/mcp_config.json"

# Generate plugin/hooks.json
sed -e "s|{{NODE_PATH}}|$NODE_BIN|g" \
    -e "s|{{STOP_HOOK_PATH}}|$HOOK_ENTRY|g" \
    "$MYCHROME_PLUGIN_DIR/hooks.template.json" > "$MYCHROME_PLUGIN_DIR/hooks.json"
echo " [OK] Generated $MYCHROME_PLUGIN_DIR/hooks.json"

# 6. Sidecar Deployment
mkdir -p "$MYCHROME_SIDECAR_DIR"
sed -e "s|{{NODE_PATH}}|$NODE_BIN|g" \
    -e "s|{{WAKER_PATH}}|$WAKER_ENTRY|g" \
    "$EXTRACT_DIR/sidecars/mychrome-waker/sidecar.template.json" > "$MYCHROME_SIDECAR_DIR/sidecar.json"
echo " [OK] Generated $MYCHROME_SIDECAR_DIR/sidecar.json"

# Enable sidecar in config.json
mkdir -p "$CONFIG_DIR"
if [[ -f "$CONFIG_JSON" ]]; then
  backup_file "$CONFIG_JSON"
fi
"$NODE_BIN" -e "
  const fs = require('fs');
  const path = require('path');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync('$CONFIG_JSON', 'utf-8')); } catch {}
  if (!cfg.sidecars) cfg.sidecars = {};
  cfg.sidecars['mychrome-waker'] = { enabled: true };
  fs.mkdirSync(path.dirname('$CONFIG_JSON'), { recursive: true });
  fs.writeFileSync('$CONFIG_JSON', JSON.stringify(cfg, null, 2), 'utf-8');
"
echo " [OK] Enabled mychrome-waker sidecar in $CONFIG_JSON"

# Cleanup temp extract dir if created
if [[ "$EXTRACT_DIR" != "$SCRIPT_DIR" && -d "$EXTRACT_DIR" ]]; then
  rm -rf "$EXTRACT_DIR"
fi

# Clipboard
if command -v pbcopy >/dev/null 2>&1; then
  echo -n "$EXTENSION_DIR" | pbcopy
  echo " [OK] Copied extension path to clipboard: $EXTENSION_DIR"
elif command -v xclip >/dev/null 2>&1; then
  echo -n "$EXTENSION_DIR" | xclip -selection clipboard
  echo " [OK] Copied extension path to clipboard: $EXTENSION_DIR"
elif command -v wl-copy >/dev/null 2>&1; then
  echo -n "$EXTENSION_DIR" | wl-copy
  echo " [OK] Copied extension path to clipboard: $EXTENSION_DIR"
fi

# Open Chrome
if [[ "$(uname -s)" == "Darwin" ]]; then
  open -a "Google Chrome" "chrome://extensions" 2>/dev/null || true
else
  google-chrome "chrome://extensions" 2>/dev/null || xdg-open "chrome://extensions" 2>/dev/null || true
fi

echo ""
echo "========================================================"
echo "       MyChrome installation completed successfully!    "
echo "========================================================"
echo ""
echo "Next steps:"
echo " 1. In Chrome: Go to chrome://extensions"
echo " 2. Turn on 'Developer mode' (top right)"
echo " 3. Click 'Load unpacked' and paste: $EXTENSION_DIR"
echo " 4. Restart Antigravity completely"
echo " 5. Type /mychrome once in any Antigravity conversation"
echo " 6. Open MyChrome from toolbar icon on any tab!"
