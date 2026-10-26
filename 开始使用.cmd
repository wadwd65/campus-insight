@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CAMPUS_NODE=node"
if exist "%CD%\runtime\node.exe" set "CAMPUS_NODE=%CD%\runtime\node.exe"
if exist "%CD%\runtime\node.exe" goto campus_node_ready
where node >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -Command "Get-Content -LiteralPath scripts/node-required.txt -Encoding UTF8"
  pause
  exit /b 1
)
:campus_node_ready
"%CAMPUS_NODE%" scripts/start-local.mjs
pause
