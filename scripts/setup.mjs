// One-time setup: downloads the free official arduino-cli into ./tools and installs
// the Arduino AVR core + the libraries our worlds use. Everything stays inside the
// project folder, so nothing is installed system-wide and no account is needed.
import { existsSync, mkdirSync, createWriteStream, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { cliPath, arduinoEnv, toolsDir } from '../server/arduino-paths.mjs';



const LIBRARIES = ['Servo'];

function assetName() {
  const arch = process.arch === 'arm64' ? 'ARM64' : '64bit';
  if (process.platform === 'win32') return 'arduino-cli_latest_Windows_64bit.zip';
  if (process.platform === 'darwin') return `arduino-cli_latest_macOS_${arch}.tar.gz`;
  return `arduino-cli_latest_Linux_${arch}.tar.gz`;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function extract(archive, dest) {
  if (process.platform === 'win32') {
    // Use Windows' own bsdtar (Git Bash's GNU tar misreads "D:" as a network host)
    const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (existsSync(winTar)) {
      execFileSync(winTar, ['-xf', archive, '-C', dest], { stdio: 'inherit' });
    } else {
      execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${archive}' -DestinationPath '${dest}'`], { stdio: 'inherit' });
    }
  } else {
    execFileSync('tar', ['-xf', archive, '-C', dest], { stdio: 'inherit' });
  }
}

function cli(args) {
  console.log(`  > arduino-cli ${args.join(' ')}`);
  execFileSync(cliPath, args, { stdio: 'inherit', env: arduinoEnv() });
}

async function main() {
  mkdirSync(toolsDir, { recursive: true });

  if (!existsSync(cliPath)) {
    const name = assetName();
    const archive = path.join(toolsDir, name);
    console.log(`Downloading arduino-cli (${name})...`);
    await download(`https://downloads.arduino.cc/arduino-cli/${name}`, archive);
    console.log('Extracting...');
    extract(archive, toolsDir);
    if (process.platform !== 'win32') chmodSync(cliPath, 0o755);
  } else {
    console.log('arduino-cli already present.');
  }

  console.log('Installing Arduino AVR core (Uno, Nano, Mega)...');
  cli(['core', 'update-index']);
  cli(['core', 'install', 'arduino:avr']);

  console.log('Installing libraries...');
  for (const lib of LIBRARIES) cli(['lib', 'install', lib]);

  console.log('\nSetup complete! Run "npm run dev" (or start.bat) to launch Circuit World.');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  console.error('Check your internet connection (only needed once) and try again.');
  process.exit(1);
});

