#!/usr/bin/env node
/**
 * Create or update a staff account from the CLI.
 * Usage: npm run admin:create -- --email you@site.ma --password 'S3cure!pass' --role superadmin --name "Admin"
 * Passwords are hashed with scrypt; nothing is stored in plain text.
 */
import { db, now } from '../lib/db.js';
import { hashPassword, passwordIssues, normalizeEmail } from '../lib/security.js';
import { ROLES } from '../lib/permissions.js';

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const email = normalizeEmail(arg('email'));
const password = arg('password');
const role = arg('role', 'admin');
const name = arg('name', 'Admin');

if (!email || !password) {
  console.error('Usage: npm run admin:create -- --email <email> --password <password> [--role admin] [--name "Name"]');
  process.exit(1);
}
if (!ROLES.includes(role) || role === 'user') {
  console.error(`Invalid role. Choose one of: ${ROLES.filter((r) => r !== 'user').join(', ')}`);
  process.exit(1);
}
const issues = passwordIssues(password);
if (issues.length) {
  console.error(`Weak password: ${issues.join(', ')}`);
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
const ts = now();
if (existing) {
  db.prepare('UPDATE users SET password_hash=?, role=?, status=?, updated_at=? WHERE id=?').run(
    hashPassword(password),
    role,
    'active',
    ts,
    existing.id,
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`Updated ${email} → role=${role}`);
} else {
  db.prepare(
    `INSERT INTO users (email, password_hash, name, role, status, email_verified, created_at, updated_at)
     VALUES (?,?,?,?,'active',1,?,?)`,
  ).run(email, hashPassword(password), name, role, ts, ts);
  console.log(`Created ${email} → role=${role}`);
}
db.close();
