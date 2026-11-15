// Compiles Arduino sketches with the project-local arduino-cli.
// Requests are queued (one compile at a time) and results are cached by code hash,
// so pressing Run twice on the same code is instant.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cliPath, arduinoEnv, root, shortCompilerDir } from './arduino-paths.mjs';

const BOARDS = { uno: 'arduino:avr:uno' };
const workDir = path.join(root, 'build');
const cache = new Map();
let queue = Promise.resolve();

export function toolchainReady() {
  return existsSync(cliPath) && existsSync(path.join(root, 'tools', 'arduino-data', 'data', 'packages', 'arduino'));
}

function run(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cliPath, args, { env: arduinoEnv(), windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, out: String(err) });
    });
  });
}

/** Turn gcc output into structured diagnostics that point at the student's sketch. */
export function parseDiagnostics(output) {
  const diags = [];
  const re = /sketch\.ino:(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.*)/g;
  let m;
  while ((m = re.exec(output))) {
    const severity = m[3] === 'warning' ? 'warning' : m[3] === 'note' ? 'note' : 'error';
    if (severity === 'note') continue;
    diags.push({ line: Number(m[1]), column: Number(m[2]), severity, message: m[4].trim() });
  }
  // Linker errors such as a missing setup() or loop() have no line number.
  if (/undefined reference to `(setup|loop)'/.test(output)) {
    const which = output.match(/undefined reference to `(setup|loop)'/)[1];
    diags.push({ line: 1, column: 1, severity: 'error', message: `undefined reference to ${which}()` });
  }
  return diags;
}

async function doCompile(code, board) {
  const fqbn = BOARDS[board];
  if (!fqbn) return { ok: false, diagnostics: [{ line: 1, column: 1, severity: 'error', message: `Unknown board ${board}` }], output: '' };

  const sketchDir = path.join(workDir, 'sketch');
  const buildPath = path.join(workDir, `${board}-build`);
  mkdirSync(sketchDir, { recursive: true });
  mkdirSync(buildPath, { recursive: true });
  writeFileSync(path.join(sketchDir, 'sketch.ino'), code);

  const args = ['compile', '--fqbn', fqbn, '--build-path', buildPath, '--warnings', 'default'];
  const gcc = shortCompilerDir();
  if (gcc) args.push('--build-property', `compiler.path=${path.join(gcc, 'bin')}${path.sep}`);
  args.push(sketchDir);

  const started = Date.now();
  const { code: exit, out } = await run(args, 120_000);
  const diagnostics = parseDiagnostics(out);
  // Still too deep for avr-gcc (see shortCompilerDir): explain how to fix it.
  if (/device-specs.*No such file/.test(out)) {
    diagnostics.push({ line: 1, column: 1, severity: 'error', message: 'PATH_TOO_LONG' });
  }
  const hexFile = path.join(buildPath, 'sketch.ino.hex');
  if (exit !== 0 || !existsSync(hexFile)) {
    if (!diagnostics.some((d) => d.severity === 'error')) {
      diagnostics.push({ line: 1, column: 1, severity: 'error', message: 'The compiler stopped without a clear reason. See the full output.' });
    }
    return { ok: false, diagnostics, output: out, ms: Date.now() - started };
  }
  const usage = out.match(/Sketch uses (\d+) bytes/);
  return {
    ok: true,
    hex: readFileSync(hexFile, 'utf8'),
    diagnostics,
    output: out,
    flashBytes: usage ? Number(usage[1]) : undefined,
    ms: Date.now() - started,
  };
}

export function compileSketch(code, board = 'uno') {
  const key = createHash('sha256').update(board + '\0' + code).digest('hex');
  if (cache.has(key)) return Promise.resolve({ ...cache.get(key), cached: true });
  const job = queue.then(() => doCompile(code, board));
  queue = job.catch(() => {});
  return job.then((result) => {
    if (result.ok) {
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      cache.set(key, result);
    }
    return result;
  });
}
