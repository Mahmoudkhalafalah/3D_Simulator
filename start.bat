@echo off
title Circuit World
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run Circuit World.
  echo Please install it from https://nodejs.org (the LTS version^), then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Circuit World for the first time...
  call npm install
  if errorlevel 1 goto :failed
)

if not exist tools\arduino-cli\arduino-cli.exe (
  echo Downloading the Arduino compiler (one time only^)...
  call node scripts\setup.mjs
  if errorlevel 1 goto :failed
)

echo Building the app...
call npx vite build --logLevel warn
if errorlevel 1 goto :failed

echo.
echo  Starting Circuit World at http://localhost:3210 (your browser opens by itself)
echo  Keep this window open while you play. Close it to stop.
echo.
set OPEN_BROWSER=1
node server\index.mjs
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo Something went wrong. Check the messages above.
pause
exit /b 1
