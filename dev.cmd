@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if %errorlevel%==0 (
  pnpm dev
  exit /b %errorlevel%
)

set "CODEX_RUNTIME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies"
set "BUNDLED_NODE=%CODEX_RUNTIME%\node\bin"
set "BUNDLED_TOOLS=%CODEX_RUNTIME%\bin\fallback"
set "BUNDLED_PNPM=%BUNDLED_TOOLS%\pnpm.cmd"

if exist "%BUNDLED_PNPM%" (
  set "PATH=%BUNDLED_NODE%;%BUNDLED_TOOLS%;%PATH%"
  call "%BUNDLED_PNPM%" dev
  exit /b %errorlevel%
)

echo Node.js and pnpm were not found.
echo Install Node.js from https://nodejs.org, then run:
echo   corepack enable
echo   corepack prepare pnpm@latest --activate
echo   pnpm install
echo   pnpm dev
exit /b 1
