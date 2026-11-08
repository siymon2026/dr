import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from './logger.js';

fs.mkdirSync(path.dirname(config.db.file), { recursive: true });

export const db = new Database(config.db.file, { timeout: 8000 });

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 8000');

const schemaPath = path.join(config.root, 'server', 'db', 'schema.sql');

export function migrate() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  logger.info('database schema is up to date');
}

export function now() {
  return Date.now();
}

/** Run a function inside a transaction. */
export const tx = (fn) => db.transaction(fn);

/** Serialize JSON or return null. */
export const toJson = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

/** Parse JSON safely. */
export function fromJson(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/** Keyset-safe pagination params. */
export function pagination(query, { defaultLimit = 24, maxLimit = 60 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Create timestamped backup of the sqlite file (online-safe). */
export async function backupDatabase() {
  if (!config.db.backupEnabled) return null;
  fs.mkdirSync(config.db.backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(config.db.backupDir, `bii3chri-${stamp}.db`);
  await db.backup(target);
  // keep the 10 most recent backups
  const files = fs
    .readdirSync(config.db.backupDir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();
  for (const f of files.slice(10)) {
    try {
      fs.unlinkSync(path.join(config.db.backupDir, f));
    } catch {
      /* ignore */
    }
  }
  logger.info({ target }, 'database backup created');
  return target;
}
