// Shared paths for the project-local arduino-cli installation.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmdirSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const toolsDir = path.join(root, 'tools', 'arduino-cli');
export const cliPath = path.join(toolsDir, process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');

const dataRoot = path.join(root, 'tools', 'arduino-data');

/** Environment that keeps every arduino-cli file inside ./tools (portable, no global install). */
export function arduinoEnv() {
  return {
    ...process.env,
    ARDUINO_DIRECTORIES_DATA: path.join(dataRoot, 'data'),
    ARDUINO_DIRECTORIES_DOWNLOADS: path.join(dataRoot, 'staging'),
    ARDUINO_DIRECTORIES_USER: path.join(dataRoot, 'user'),
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
  };
}

/**
 * Windows' avr-gcc is an old program that cannot open files whose full path is longer than
 * 260 characters. That happens when Circuit World is unzipped deep inside other folders.
 * In that case, reach gcc through a short junction (a folder shortcut) in
 * %LOCALAPPDATA%\CircuitWorld. arduino-cli itself copes with long paths but refuses to follow
 * junctions, so only gcc goes through it (via the compiler.path build property).
 * Returns the short gcc folder, or null when the real path is short enough.
 */
let shortGcc;
export function shortCompilerDir() {
  if (shortGcc !== undefined) return shortGcc;
  shortGcc = null;
  if (process.platform !== 'win32') return null;
  const gccRoot = path.join(dataRoot, 'data', 'packages', 'arduino', 'tools', 'avr-gcc');
  const version = existsSync(gccRoot) ? readdirSync(gccRoot)[0] : undefined;
  if (!version) return null;
  const real = path.join(gccRoot, version);
  if (real.length <= 100) return null;

  const id = createHash('sha256').update(real.toLowerCase()).digest('hex').slice(0, 8);
  const link = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'CircuitWorld', id);
  try {
    let stat = null;
    try {
      stat = lstatSync(link);
    } catch {}
    if (stat) {
      let same = false;
      try {
        same = realpathSync.native(link) === realpathSync.native(real);
      } catch {}
      if (!same) {
        if (!stat.isSymbolicLink()) throw new Error(`${link} is in the way`);
        rmdirSync(link); // removes only the junction, never what it points to
        stat = null;
      }
    }
    if (!stat) {
      mkdirSync(path.dirname(link), { recursive: true });
      symlinkSync(real, link, 'junction');
    }
    shortGcc = link;
  } catch (err) {
    console.log(`Note: could not make a short path for the compiler (${err.message}).`);
  }
  return shortGcc;
}
