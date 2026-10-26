@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set "CAMPUS_NODE=node"
if exist "%CD%\runtime\node.exe" set "CAMPUS_NODE=%CD%\runtime\node.exe"
if exist "%CD%\runtime\node.exe" goto campus_node_ready
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24.21 或更新版本：https://nodejs.org/
  pause
  exit /b 1
)
:campus_node_ready
"%CAMPUS_NODE%" scripts/configure-deployment.mjs --start
pause
