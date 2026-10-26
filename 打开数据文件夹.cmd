@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CAMPUS_NODE=node"
if exist "%CD%\runtime\node.exe" set "CAMPUS_NODE=%CD%\runtime\node.exe"
"%CAMPUS_NODE%" scripts/start-local.mjs --open-data
pause
