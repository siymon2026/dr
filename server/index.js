import http from 'node:http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { migrate, backupDatabase, db } from './lib/db.js';
import { createApp } from './app.js';
import { startHeartbeat } from './lib/realtime.js';
import { runMaintenance } from './lib/maintenance.js';

if (!config.security.jwtSecret) {
  if (config.isProd) {
    logger.error('JWT_SECRET is required in production. Refusing to start.');
    process.exit(1);
  }
  logger.warn('JWT_SECRET not set — using an insecure development secret.');
}

migrate();

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port, env: config.env }, 'Bii3 & Chri API listening');
});

startHeartbeat();

// Housekeeping: expire listings, sessions, subscriptions; nightly backups.
const maintenanceTimer = setInterval(() => {
  try {
    runMaintenance();
  } catch (err) {
    logger.error({ err }, 'maintenance failed');
  }
}, 10 * 60 * 1000).unref?.();

setTimeout(() => {
  try {
    runMaintenance();
  } catch (err) {
    logger.error({ err }, 'initial maintenance failed');
  }
}, 3000).unref?.();

const backupTimer = setInterval(
  () => backupDatabase().catch((err) => logger.error({ err }, 'backup failed')),
  24 * 60 * 60 * 1000,
).unref?.();

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  clearInterval(maintenanceTimer);
  clearInterval(backupTimer);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught exception'));

export { app, server };
