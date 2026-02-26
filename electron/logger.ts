/**
 * Diagnostic logger — wraps console.log/warn/error to also append
 * timestamped lines to {userData}/logs/app.log.
 *
 * Import this module FIRST in main.ts so all subsequent console output
 * is captured from the very start.
 */
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB
const KEEP_AFTER_ROTATE = 1 * 1024 * 1024; // keep last 1MB after rotation

let logStream: fs.WriteStream | null = null;
let logDir: string = '';
let logPath: string = '';

function ensureLogDir() {
  if (logDir) return;
  logDir = path.join(app.getPath('userData'), 'logs');
  logPath = path.join(logDir, 'app.log');
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {}
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(logPath)) return;
    const stat = fs.statSync(logPath);
    if (stat.size <= MAX_LOG_SIZE) return;

    // Read file, keep the last KEEP_AFTER_ROTATE bytes
    const buf = fs.readFileSync(logPath);
    const start = buf.length - KEEP_AFTER_ROTATE;
    const kept = buf.subarray(start > 0 ? start : 0);
    // Find first newline so we don't start mid-line
    const nlIdx = kept.indexOf(0x0a);
    const clean = nlIdx >= 0 ? kept.subarray(nlIdx + 1) : kept;
    fs.writeFileSync(logPath, clean);
  } catch {}
}

function getStream(): fs.WriteStream | null {
  if (logStream) return logStream;
  try {
    ensureLogDir();
    rotateIfNeeded();
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.on('error', () => {
      logStream = null;
    });
    return logStream;
  } catch {
    return null;
  }
}

function writeLog(level: string, args: any[]) {
  try {
    const stream = getStream();
    if (!stream) return;
    const ts = new Date().toISOString();
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    stream.write(`${ts} [${level}] ${msg}\n`);
  } catch {}
}

// Patch console methods
const origLog = console.log.bind(console);
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);

console.log = (...args: any[]) => {
  origLog(...args);
  writeLog('LOG', args);
};

console.warn = (...args: any[]) => {
  origWarn(...args);
  writeLog('WARN', args);
};

console.error = (...args: any[]) => {
  origError(...args);
  writeLog('ERROR', args);
};

/** Read the last N lines from the log file. */
export function readRecentLogLines(n: number = 500): string[] {
  try {
    ensureLogDir();
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/** Get the absolute path to the log file. */
export function getLogPath(): string {
  ensureLogDir();
  return logPath;
}

/** Close the write stream (call on shutdown). */
export function closeLogStream(): void {
  try {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  } catch {}
}
