import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Ensure data directory exists (use SNAPSEND_DATA_DIR in Electron production)
const dataDir = process.env.SNAPSEND_DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'snapsend.db');
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      socket_id TEXT UNIQUE,
      is_online INTEGER DEFAULT 0,
      last_seen TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_a_id INTEGER NOT NULL REFERENCES devices(id),
      device_b_id INTEGER NOT NULL REFERENCES devices(id),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      terminated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      content TEXT,
      from_device_id INTEGER REFERENCES devices(id),
      to_device_id INTEGER REFERENCES devices(id),
      connection_id INTEGER REFERENCES connections(id),
      is_clipboard INTEGER DEFAULT 0,
      transferred_at TEXT DEFAULT (datetime('now')),
      from_device_name TEXT,
      to_device_name TEXT
    );
  `);

  // Migrate: add P2P columns if they don't exist
  try {
    sqlite.exec(`ALTER TABLE files ADD COLUMN from_device_name TEXT`);
  } catch {}
  try {
    sqlite.exec(`ALTER TABLE files ADD COLUMN to_device_name TEXT`);
  } catch {}

  // Migrate: add uuid column to devices if it doesn't exist
  try {
    sqlite.exec(`ALTER TABLE devices ADD COLUMN uuid TEXT`);
  } catch {}

  // Migrate: add tags and metadata columns to files if they don't exist
  try {
    sqlite.exec(`ALTER TABLE files ADD COLUMN tags TEXT`);
  } catch {}
  try {
    sqlite.exec(`ALTER TABLE files ADD COLUMN metadata TEXT`);
  } catch {}

  // Migrate: create tags vocabulary table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Mark all devices as offline on startup (clean slate)
  sqlite.exec(`UPDATE devices SET is_online = 0, socket_id = NULL`);

  console.log('SQLite database initialized at', dbPath);
}
