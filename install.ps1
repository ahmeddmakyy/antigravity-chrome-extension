#Requires -Version 5.1
<#
.SYNOPSIS
    MyChrome installer and updater for Antigravity on Windows.

.DESCRIPTION
    Installs or updates MyChrome:
    - Sets up ~/.gemini/mychrome/{extension,bridge,runtime,logs}
    - Deploys the Antigravity plugin and waker sidecar
    - Migrates from previous v3/v4 configurations
    - Validates Node.js (v20+) or provisions portable runtime
    - Copies extension path to clipboard and launches chrome://extensions

.PARAMETER Check
    Performs environment diagnostics and tests hook / bridge connectivity.

.PARAMETER Uninstall
    Removes installed plugin, sidecar, and files while preserving logs.

.PARAMETER Source
    Path to a local release zip file (used for offline or testing installs).

.PARAMETER HomeDir
    Custom user home directory (used for testing without touching system state).
#>

[CmdletBinding()]
param (
    [switch]$Check,
    [switch]$Uninstall,
    [string]$Source = "",
    [string]$HomeDir = ""
)

$ErrorActionPreference = "Stop"

# Configuration constants
$REPO_OWNER = "ahmeddmakyy"
$REPO_NAME = "antigravity-chrome-extension"
$EXTENSION_ID = "aeofpcedejopeeebdjfkapcabkkflhej"
$PORT = 8765

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
$UserHome = if ($HomeDir) { Resolve-Path $HomeDir } else { [Environment]::GetFolderPath("UserProfile") }
$GeminiDir = Join-Path $UserHome ".gemini"
$MyChromeDir = Join-Path $GeminiDir "mychrome"
$ExtensionDir = Join-Path $MyChromeDir "extension"
$BridgeDir = Join-Path $MyChromeDir "bridge"
$RuntimeDir = Join-Path $MyChromeDir "runtime"
$LogsDir = Join-Path $MyChromeDir "logs"

$ConfigDir = Join-Path $GeminiDir "config"
$PluginsDir = Join-Path $ConfigDir "plugins"
$MyChromePluginDir = Join-Path $PluginsDir "mychrome"
$SidecarsDir = Join-Path $ConfigDir "sidecars"
$MyChromeSidecarDir = Join-Path $SidecarsDir "mychrome-waker"
$ConfigJsonPath = Join-Path $ConfigDir "config.json"
$HooksJsonPath = Join-Path $ConfigDir "hooks.json"
$AntigravityMcpPath = Join-Path $GeminiDir "antigravity\mcp_config.json"
$ConfigMcpPath = Join-Path $ConfigDir "mcp_config.json"
$TokenPath = Join-Path $MyChromeDir ".token"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host " [OK] $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host " [WARN] $Message" -ForegroundColor Yellow
}

function Backup-File {
    param([string]$Path)
    if (Test-Path $Path) {
        $timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
        $bak = "$Path.bak-$timestamp"
        Copy-Item -Path $Path -Destination $bak -Force
        Write-Success "Backed up $Path to $(Split-Path $bak -Leaf)"
        return $bak
    }
    return $null
}

# ---------------------------------------------------------------------------
# Check Mode
# ---------------------------------------------------------------------------
if ($Check) {
    Write-Host "=== MyChrome Diagnostics & Health Check ===" -ForegroundColor Cyan
    Write-Host "Timestamp: $(Get-Date -Format s)`n"

    # 1. Node runtime
    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $nodeVer = & node -v
        Write-Success "Node on PATH: $($nodeCmd.Source) ($nodeVer)"
    } else {
        $localNode = Join-Path $RuntimeDir "node.exe"
        if (Test-Path $localNode) {
            $nodeVer = & $localNode -v
            Write-Success "Portable Node: $localNode ($nodeVer)"
        } else {
            Write-WarnMsg "No Node runtime found on PATH or in $RuntimeDir"
        }
    }

    # 2. Extension files
    if (Test-Path (Join-Path $ExtensionDir "manifest.json")) {
        $manifest = Get-Content (Join-Path $ExtensionDir "manifest.json") -Raw | ConvertFrom-Json
        Write-Success "Extension installed: v$($manifest.version) at $ExtensionDir"
    } else {
        Write-WarnMsg "Extension not installed at $ExtensionDir"
    }

    # 3. Plugin registration
    if (Test-Path (Join-Path $MyChromePluginDir "plugin.json")) {
        Write-Success "Plugin folder present at $MyChromePluginDir"
    } else {
        Write-WarnMsg "Plugin folder missing at $MyChromePluginDir"
    }

    # 4. Sidecar registration
    if (Test-Path (Join-Path $MyChromeSidecarDir "sidecar.json")) {
        Write-Success "Sidecar present at $MyChromeSidecarDir"
    } else {
        Write-WarnMsg "Sidecar missing at $MyChromeSidecarDir"
    }

    # 5. Token
    if (Test-Path $TokenPath) {
        $tok = Get-Content $TokenPath -Raw
        Write-Success "Pairing token exists ($($tok.Trim().Length) chars)"
    } else {
        Write-WarnMsg "Pairing token missing at $TokenPath"
    }

    # 6. Port listening check
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $PORT)
        $tcp.Close()
        Write-Success "Bridge server is running and listening on port $PORT"
    } catch {
        Write-Host " [INFO] Port $PORT is not active (Antigravity will launch it via MCP)" -ForegroundColor Gray
    }

    # 7. Hook trace log
    $traceLog = Join-Path $LogsDir "hook-trace.log"
    if (Test-Path $traceLog) {
        Write-Host "`nLast lines of hook trace ($traceLog):" -ForegroundColor Cyan
        Get-Content $traceLog -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host " [INFO] No hook trace log recorded yet" -ForegroundColor Gray
    }

    exit 0
}

# ---------------------------------------------------------------------------
# Uninstall Mode
# ---------------------------------------------------------------------------
if ($Uninstall) {
    Write-Step "Uninstalling MyChrome..."

    # 1. Remove plugin
    if (Test-Path $MyChromePluginDir) {
        Remove-Item -Path $MyChromePluginDir -Recurse -Force
        Write-Success "Removed plugin from $MyChromePluginDir"
    }

    # 2. Remove sidecar
    if (Test-Path $MyChromeSidecarDir) {
        Remove-Item -Path $MyChromeSidecarDir -Recurse -Force
        Write-Success "Removed sidecar from $MyChromeSidecarDir"
    }

    # 3. Disable sidecar in config.json
    if (Test-Path $ConfigJsonPath) {
        try {
            Backup-File $ConfigJsonPath
            $cfg = Get-Content $ConfigJsonPath -Raw | ConvertFrom-Json
            if ($cfg.sidecars -and $cfg.sidecars."mychrome-waker") {
                $cfg.sidecars.PSObject.Properties.Remove("mychrome-waker")
                $cfg | ConvertTo-Json -Depth 20 | Set-Content $ConfigJsonPath -Encoding utf8
                Write-Success "Disabled sidecar in $ConfigJsonPath"
            }
        } catch {
            Write-WarnMsg "Failed to edit $($ConfigJsonPath): $_"
        }
    }

    # 4. Remove binaries and extension
    foreach ($dir in @($ExtensionDir, $BridgeDir, $RuntimeDir)) {
        if (Test-Path $dir) {
            Remove-Item -Path $dir -Recurse -Force
            Write-Success "Removed $dir"
        }
    }

    Write-Host "`nMyChrome uninstalled successfully. (Logs in $LogsDir were preserved)." -ForegroundColor Green
    Write-Host "Please remove the unpacked extension from chrome://extensions." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------------------
# Installation / Update Flow
# ---------------------------------------------------------------------------
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     MyChrome for Antigravity Installer   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Directory creation
Write-Step "Creating directories in $MyChromeDir"
foreach ($dir in @($MyChromeDir, $ExtensionDir, $BridgeDir, $RuntimeDir, $LogsDir, $PluginsDir, $SidecarsDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Success "Directory structure ready"

# 2. Node Runtime Check or Provisioning
Write-Step "Checking Node.js environment"
$NodeBinary = $null

$systemNode = Get-Command "node" -ErrorAction SilentlyContinue
if ($systemNode) {
    try {
        $rawVer = & node -v
        $major = [int]($rawVer.Trim().TrimStart('v').Split('.')[0])
        if ($major -ge 20) {
            $NodeBinary = $systemNode.Source
            Write-Success "Found system Node.js $rawVer ($NodeBinary)"
        } else {
            Write-WarnMsg "System Node.js is $rawVer (version 20+ required)"
        }
    } catch {}
}

if (-not $NodeBinary) {
    $portableNode = Join-Path $RuntimeDir "node.exe"
    if (Test-Path $portableNode) {
        $NodeBinary = $portableNode
        Write-Success "Using installed portable Node: $NodeBinary"
    } else {
        Write-Step "Downloading portable Node.js LTS (v20.18.0) into runtime directory"
        $nodeZipUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
        $nodeZipTemp = Join-Path $RuntimeDir "node-temp.zip"
        
        Write-Host "Downloading $nodeZipUrl..." -ForegroundColor Gray
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeZipUrl -OutFile $nodeZipTemp -UseBasicParsing

        Write-Host "Extracting node.exe..." -ForegroundColor Gray
        $extractDir = Join-Path $RuntimeDir "extract_temp"
        Expand-Archive -Path $nodeZipTemp -DestinationPath $extractDir -Force
        $extractedExe = Get-ChildItem -Path $extractDir -Filter "node.exe" -Recurse | Select-Object -First 1
        if ($extractedExe) {
            Move-Item -Path $extractedExe.FullName -Destination $portableNode -Force
            Remove-Item -Path $extractDir -Recurse -Force
            Remove-Item -Path $nodeZipTemp -Force
            $NodeBinary = $portableNode
            Write-Success "Portable Node installed: $NodeBinary"
        } else {
            throw "Failed to locate node.exe in downloaded archive."
        }
    }
}

# 3. Source extraction (Local Source or GitHub Release)
Write-Step "Deploying MyChrome components"
$ExtractSourceDir = $null

if ($Source -and (Test-Path $Source)) {
    Write-Host "Using provided local source archive: $Source" -ForegroundColor Gray
    $tempExtract = Join-Path $MyChromeDir "source_extract_temp"
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    Expand-Archive -Path $Source -DestinationPath $tempExtract -Force
    $ExtractSourceDir = $tempExtract
} else {
    # Download latest release from GitHub
    Write-Host "Fetching latest release information from GitHub..." -ForegroundColor Gray
    $releasesApiUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
    $headers = @{ "User-Agent" = "MyChrome-Installer" }
    
    try {
        $releaseJson = Invoke-RestMethod -Uri $releasesApiUrl -Headers $headers -UseBasicParsing
        $zipAsset = $releaseJson.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
        if (-not $zipAsset) {
            throw "No zip asset found in release $($releaseJson.tag_name)"
        }
        $releaseZipUrl = $zipAsset.browser_download_url
        $tempZip = Join-Path $MyChromeDir "release_temp.zip"
        Write-Host "Downloading $($zipAsset.name)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $releaseZipUrl -OutFile $tempZip -Headers $headers -UseBasicParsing

        $tempExtract = Join-Path $MyChromeDir "source_extract_temp"
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
        Remove-Item -Path $tempZip -Force
        $ExtractSourceDir = $tempExtract
    } catch {
        # Fallback to local workspace files if downloading release is not available
        $localDev = Join-Path $PSScriptRoot "extension"
        if (Test-Path $localDev) {
            Write-WarnMsg "Could not fetch GitHub Release ($_); falling back to local script directory"
            $ExtractSourceDir = $PSScriptRoot
        } else {
            throw "Failed to download release: $_"
        }
    }
}

# Copy extension files
$srcExtension = Join-Path $ExtractSourceDir "extension"
if (Test-Path $srcExtension) {
    Copy-Item -Path "$srcExtension\*" -Destination $ExtensionDir -Recurse -Force
    Write-Success "Extension files deployed to $ExtensionDir"
}

# Copy bridge dist files
$srcBridgeDist = Join-Path $ExtractSourceDir "bridge\dist"
if (Test-Path $srcBridgeDist) {
    $targetBridgeDist = Join-Path $BridgeDir "dist"
    if (-not (Test-Path $targetBridgeDist)) { New-Item -ItemType Directory -Path $targetBridgeDist -Force | Out-Null }
    Copy-Item -Path "$srcBridgeDist\*" -Destination $targetBridgeDist -Recurse -Force
    Write-Success "Bridge bundle deployed to $targetBridgeDist"
}

# 4. Token Generation (New token, never copy old shared tokens)
Write-Step "Securing pairing credentials"
if (-not (Test-Path $TokenPath)) {
    $bytes = New-Object byte[] 24
    (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
    $newToken = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    Set-Content -Path $TokenPath -Value $newToken -Encoding ascii
    Write-Success "Generated fresh pairing token in $TokenPath"
} else {
    Write-Success "Pairing token preserved in $TokenPath"
}

# 5. Migration from v3/v4 configurations
Write-Step "Migrating legacy configurations"

# Remove old antigravity-browser-bridge from antigravity/mcp_config.json
foreach ($mcpCfg in @($AntigravityMcpPath, $ConfigMcpPath)) {
    if (Test-Path $mcpCfg) {
        try {
            $raw = Get-Content $mcpCfg -Raw
            if ($raw -match "antigravity-browser-bridge") {
                Backup-File $mcpCfg
                $jsonObj = $raw | ConvertFrom-Json
                if ($jsonObj.mcpServers -and $jsonObj.mcpServers."antigravity-browser-bridge") {
                    $jsonObj.mcpServers.PSObject.Properties.Remove("antigravity-browser-bridge")
                    $jsonObj | ConvertTo-Json -Depth 10 | Set-Content $mcpCfg -Encoding utf8
                    Write-Success "Removed deprecated antigravity-browser-bridge from $mcpCfg"
                }
            }
        } catch {
            Write-WarnMsg "Could not clean $($mcpCfg): $_"
        }
    }
}

# Remove old mychrome-bridge from hooks.json
if (Test-Path $HooksJsonPath) {
    try {
        $raw = Get-Content $HooksJsonPath -Raw
        if ($raw -match "mychrome-bridge") {
            Backup-File $HooksJsonPath
            $jsonObj = $raw | ConvertFrom-Json
            if ($jsonObj."mychrome-bridge") {
                $jsonObj.PSObject.Properties.Remove("mychrome-bridge")
                $jsonObj | ConvertTo-Json -Depth 10 | Set-Content $HooksJsonPath -Encoding utf8
                Write-Success "Removed deprecated mychrome-bridge hook from $HooksJsonPath"
            }
        }
    } catch {
        Write-WarnMsg "Could not clean $($HooksJsonPath): $_"
    }
}

# Remove legacy standalone skill folder
$oldSkillDir = Join-Path $ConfigDir "skills\mychrome"
if (Test-Path $oldSkillDir) {
    try {
        Backup-File $oldSkillDir
        Remove-Item -Path $oldSkillDir -Recurse -Force
        Write-Success "Removed legacy skill folder $oldSkillDir"
    } catch {}
}

# 6. Deploy Plugin
Write-Step "Configuring Antigravity plugin"
if (-not (Test-Path $MyChromePluginDir)) {
    New-Item -ItemType Directory -Path $MyChromePluginDir -Force | Out-Null
}

$srcPlugin = Join-Path $ExtractSourceDir "plugin"
if (Test-Path $srcPlugin) {
    Copy-Item -Path "$srcPlugin\*" -Destination $MyChromePluginDir -Recurse -Force
}

# Fill absolute paths in mcp_config.json
$mcpTemplate = Join-Path $MyChromePluginDir "mcp_config.template.json"
$targetMcp = Join-Path $MyChromePluginDir "mcp_config.json"
$bridgeEntry = (Join-Path $BridgeDir "dist\index.js").Replace("\", "/")
$nodeEscaped = $NodeBinary.Replace("\", "/")

if (Test-Path $mcpTemplate) {
    $content = Get-Content $mcpTemplate -Raw
    $content = $content.Replace("{{NODE_PATH}}", $nodeEscaped)
    $content = $content.Replace("{{BRIDGE_PATH}}", $bridgeEntry)
    Set-Content -Path $targetMcp -Value $content -Encoding utf8
    Write-Success "Generated $targetMcp"
}

# Fill absolute paths in hooks.json
$hooksTemplate = Join-Path $MyChromePluginDir "hooks.template.json"
$targetHooks = Join-Path $MyChromePluginDir "hooks.json"
$hookEntry = (Join-Path $BridgeDir "dist\stop-hook.js").Replace("\", "/")

if (Test-Path $hooksTemplate) {
    $content = Get-Content $hooksTemplate -Raw
    $content = $content.Replace("{{NODE_PATH}}", $nodeEscaped)
    $content = $content.Replace("{{STOP_HOOK_PATH}}", $hookEntry)
    Set-Content -Path $targetHooks -Value $content -Encoding utf8
    Write-Success "Generated $targetHooks"
}

# 7. Deploy Sidecar
Write-Step "Configuring MyChrome waker sidecar"
if (-not (Test-Path $MyChromeSidecarDir)) {
    New-Item -ItemType Directory -Path $MyChromeSidecarDir -Force | Out-Null
}

$sidecarTemplate = Join-Path $ExtractSourceDir "sidecars\mychrome-waker\sidecar.template.json"
$targetSidecar = Join-Path $MyChromeSidecarDir "sidecar.json"
$wakerEntry = (Join-Path $BridgeDir "dist\waker.js").Replace("\", "/")

if (Test-Path $sidecarTemplate) {
    $content = Get-Content $sidecarTemplate -Raw
    $content = $content.Replace("{{NODE_PATH}}", $nodeEscaped)
    $content = $content.Replace("{{WAKER_PATH}}", $wakerEntry)
    Set-Content -Path $targetSidecar -Value $content -Encoding utf8
    Write-Success "Generated $targetSidecar"
}

# Enable sidecar in config.json
if (Test-Path $ConfigJsonPath) {
    try {
        Backup-File $ConfigJsonPath
        $cfg = Get-Content $ConfigJsonPath -Raw | ConvertFrom-Json
        if (-not $cfg.sidecars) {
            $cfg | Add-Member -MemberType NoteProperty -Name "sidecars" -Value (New-Object PSObject)
        }
        $cfg.sidecars | Add-Member -MemberType NoteProperty -Name "mychrome-waker" -Value (@{ enabled = $true }) -Force
        $cfg | ConvertTo-Json -Depth 20 | Set-Content $ConfigJsonPath -Encoding utf8
        Write-Success "Enabled mychrome-waker sidecar in $ConfigJsonPath"
    } catch {
        Write-WarnMsg "Could not update $($ConfigJsonPath): $_"
    }
}

# Cleanup temp extraction
if ($ExtractSourceDir -and ($ExtractSourceDir -ne $PSScriptRoot) -and (Test-Path $ExtractSourceDir)) {
    Remove-Item $ExtractSourceDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 8. Post-Install Actions
Write-Step "Finishing installation"

# Copy path to clipboard
try {
    Set-Clipboard -Value $ExtensionDir
    Write-Success "Copied extension folder path to clipboard: $ExtensionDir"
} catch {
    Write-Host "Extension folder path: $ExtensionDir" -ForegroundColor Yellow
}

# Open chrome://extensions
try {
    Start-Process "chrome.exe" "chrome://extensions" -ErrorAction SilentlyContinue
} catch {}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "       MyChrome installation completed successfully!     " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`nNext steps to start using MyChrome:" -ForegroundColor Cyan
Write-Host " 1. In Chrome: Go to chrome://extensions (already opened)."
Write-Host " 2. Enable 'Developer mode' toggle (top right corner)."
Write-Host " 3. Click 'Load unpacked' and paste the path on your clipboard:"
Write-Host "    $ExtensionDir" -ForegroundColor Yellow
Write-Host " 4. Quit Antigravity completely, then reopen it."
Write-Host " 5. In any Antigravity conversation, type /mychrome once."
Write-Host " 6. Click the MyChrome toolbar icon on any Chrome tab!`n"
