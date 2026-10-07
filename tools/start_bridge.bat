@echo off
title Antigravity Browser Bridge Server (Debug Mode)
echo ===================================================
echo  [NOTE] This script is for MANUAL DEBUGGING ONLY!
echo  Antigravity normally launches the bridge via MCP.
echo ===================================================
echo  Starting Antigravity Browser Bridge Server...
echo ===================================================
cd /d "%~dp0bridge"
node dist/index.js
pause
