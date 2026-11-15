// Builds a portable Windows copy of Circuit World for sharing with friends.
// Output: release/CircuitWorld-Windows.zip. It holds the built app, the local server, the
// Arduino compiler and a private copy of Node.js, so friends unzip it and double-click.
// Nothing needs to be installed and no internet is needed.
// Run with: npm run pack   (it builds the app first)
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root } from '../server/arduino-paths.mjs';
import { toolchainReady } from '../server/compiler.mjs';

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

if (process.platform !== 'win32') fail('The portable pack is made for Windows. Run "npm run pack" on a Windows PC.');
if (!existsSync(path.join(root, 'dist', 'index.html'))) fail('Build the app first: npm run build');
if (!toolchainReady()) fail('Install the Arduino compiler first: npm run setup');

const releaseDir = path.join(root, 'release');
const appDir = path.join(releaseDir, 'CircuitWorld');
const zipPath = path.join(releaseDir, 'CircuitWorld-Windows.zip');

console.log('Collecting files...');
rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

const copy = (from, filter) =>
  cpSync(path.join(root, from), path.join(appDir, from), { recursive: true, filter });

copy('dist');
copy('server', (src) => !src.endsWith('.d.mts'));
copy('tools/arduino-cli/arduino-cli.exe');
copy('tools/arduino-cli/LICENSE.txt');
// Skip the temp folder, and Wi-Fi shield firmware (only used for flashing shields, and its
// very long file names can break unzipping on Windows).
const dataDir = path.join(root, 'tools', 'arduino-data', 'data');
copy('tools/arduino-data/data', (src) => {
  const rel = path.relative(dataDir, src).split(path.sep);
  return rel[0] !== 'tmp' && !rel.includes('firmwares');
});
copy('tools/arduino-data/user');

// A private copy of the Node.js that is running this script (Node is a single .exe on Windows).
mkdirSync(path.join(appDir, 'runtime'));
copyFileSync(process.execPath, path.join(appDir, 'runtime', 'node.exe'));
const nodeLicense = path.join(path.dirname(process.execPath), 'LICENSE');
if (existsSync(nodeLicense)) copyFileSync(nodeLicense, path.join(appDir, 'runtime', 'LICENSE.txt'));

const crlf = (s) => s.trimStart().replace(/\r?\n/g, '\r\n');

writeFileSync(
  path.join(appDir, 'Start Circuit World.bat'),
  crlf(String.raw`
@echo off
title Circuit World
cd /d "%~dp0"
if not exist "runtime\node.exe" (
  echo.
  echo  Please unzip the whole folder first, then double-click this file again.
  echo  Tip: right-click the zip file and choose "Extract All".
  echo.
  pause
  exit /b 1
)
echo.
echo   Starting Circuit World...
echo   Your browser will open by itself. If it does not, go to http://localhost:3210
echo.
echo   Keep this window open while you play. Close it to stop Circuit World.
echo.
set OPEN_BROWSER=1
"runtime\node.exe" server\index.mjs
if errorlevel 1 pause
`),
);

writeFileSync(
  path.join(appDir, 'READ ME FIRST.txt'),
  crlf(`
CIRCUIT WORLD
=============
A 3D Arduino playground. Wire real sensors to an Arduino, write real Arduino
code, and watch a smart house come alive.

HOW TO START
1. Unzip this folder (right-click the zip, then "Extract All").
2. Open the folder and double-click "Start Circuit World.bat".
3. Your browser opens Circuit World. Keep the black window open while you play.

To stop, close the black window.

There is nothing to install, no account, and no internet needed.
It needs Windows 10 or 11 (64-bit) and Chrome or Edge.

IF WINDOWS SHOWS A WARNING
"Windows protected your PC": click "More info", then "Run anyway".
"Are you sure you want to run this?": click "Run".
Circuit World only talks to your own computer, never the internet.

IF SOMETHING GOES WRONG
- The browser didn't open: go to http://localhost:3210 yourself.
- "Run" shows a strange compiler error: move the folder somewhere with a short,
  English-only path, like C:\\CircuitWorld, and start it again.
`),
);

writeFileSync(
  path.join(appDir, 'THIRD-PARTY.txt'),
  crlf(`
Circuit World includes these free, open-source programs, unchanged:

- Node.js (MIT license), runtime\\node.exe. https://nodejs.org
- Arduino CLI (GPL-3.0), tools\\arduino-cli. Source: https://github.com/arduino/arduino-cli
- Arduino AVR core, avr-gcc, avrdude and the Servo library (GPL/LGPL), in tools\\arduino-data.
  Source: https://github.com/arduino/ArduinoCore-avr and https://github.com/arduino-libraries/Servo
- avr8js (MIT), three.js (MIT), React (MIT) and others, bundled inside dist\\.
`),
);

console.log('Zipping (this takes a minute)...');
// Windows' own bsdtar writes a .zip when the file name ends in .zip (-a).
const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(winTar, ['-a', '-c', '-f', zipPath, '-C', releaseDir, 'CircuitWorld'], { stdio: 'inherit' });

const mb = (statSync(zipPath).size / 1024 / 1024).toFixed(0);
console.log(`\nDone! ${zipPath} (${mb} MB)`);
console.log('Send it with Google Drive, OneDrive or a USB stick. Friends unzip it and double-click "Start Circuit World.bat".');
