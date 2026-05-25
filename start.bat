@echo off
cd /d "%~dp0"
node check-build.js
if errorlevel 1 (
  echo [opencode] Source files changed, rebuilding...
  call npm run build
)
cscript //nologo "%~dp0start-hidden.vbs" "%~dp0"
