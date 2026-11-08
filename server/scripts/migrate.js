#!/usr/bin/env node
/** Run schema migrations (idempotent) and print table status. */
import { migrate, db } from '../lib/db.js';
import { logger } from '../lib/logger.js';

migrate();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((t) => t.name);
logger.info({ tables: tables.length }, 'migration complete');
console.log(tables.join('\n'));
