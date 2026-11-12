@echo off
chcp 65001 >nul
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-windows.ps1" -Action Start
set "CAMPUS_EXIT=%ERRORLEVEL%"
pause
exit /b %CAMPUS_EXIT%
