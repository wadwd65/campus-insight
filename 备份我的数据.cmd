@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CAMPUS_NODE=node"
if exist "%CD%\runtime\node.exe" set "CAMPUS_NODE=%CD%\runtime\node.exe"
if exist "%CD%\.campus-runtime\node.exe" set "CAMPUS_NODE=%CD%\.campus-runtime\node.exe"
"%CAMPUS_NODE%" scripts/backup-accounts.mjs
set "CAMPUS_EXIT=%ERRORLEVEL%"
pause
exit /b %CAMPUS_EXIT%
