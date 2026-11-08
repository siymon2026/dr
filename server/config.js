import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const bool = (v, d = false) =>
  v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const env = process.env.NODE_ENV || 'development';
export const isProd = env === 'production';

export const config = {
  root,
  env,
  isProd,
  port: num(process.env.PORT, 4000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  trustProxy: bool(process.env.TRUST_PROXY, true),

  db: {
    file: process.env.DB_FILE || path.join(root, 'data', 'bii3chri.db'),
    backupDir: process.env.DB_BACKUP_DIR || path.join(root, 'data', 'backups'),
    backupEnabled: bool(process.env.DB_BACKUP_ENABLED, true),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
    maxFileMb: num(process.env.UPLOAD_MAX_MB, 8),
    maxFiles: num(process.env.UPLOAD_MAX_FILES, 15),
    publicPrefix: '/uploads',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    cookieName: process.env.SESSION_COOKIE || 'bc_session',
    sessionDays: num(process.env.SESSION_DAYS, 30),
    // Set COOKIE_SECURE=false to run production builds over plain http.
    cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
    csrfEnabled: bool(process.env.CSRF_ENABLED, true),
    rateLimitEnabled: bool(process.env.RATE_LIMIT_ENABLED, true),
    // Per-IP limits (per minute) for sensitive endpoints
    limits: {
      login: num(process.env.RL_LOGIN, 10),
      register: num(process.env.RL_REGISTER, 6),
      write: num(process.env.RL_WRITE, 60),
      upload: num(process.env.RL_UPLOAD, 40),
      message: num(process.env.RL_MESSAGE, 40),
      report: num(process.env.RL_REPORT, 10),
      contact: num(process.env.RL_CONTACT, 5),
    },
  },

  seed: {
    demo: bool(process.env.SEED_DEMO, true),
    adminEmail: process.env.ADMIN_EMAIL || 'admin@bii3chri.ma',
    adminPassword: process.env.ADMIN_PASSWORD || '',
  },

  mail: {
    enabled: bool(process.env.SMTP_ENABLED, false),
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Bii3 & Chri Online <no-reply@bii3chri.ma>',
  },

  sms: {
    enabled: bool(process.env.SMS_ENABLED, false),
    provider: process.env.SMS_PROVIDER || '',
    apiKey: process.env.SMS_API_KEY || '',
    sender: process.env.SMS_SENDER || 'Bii3Chri',
  },

  push: {
    enabled: bool(process.env.PUSH_ENABLED, false),
    publicKey: process.env.PUSH_PUBLIC_KEY || '',
    privateKey: process.env.PUSH_PRIVATE_KEY || '',
  },

  payments: {
    // No real payments are executed until a provider is configured & verified.
    provider: process.env.PAYMENT_PROVIDER || 'none',
    cmi: {
      merchantId: process.env.CMI_MERCHANT_ID || '',
      storeKey: process.env.CMI_STORE_KEY || '',
      gatewayUrl: process.env.CMI_GATEWAY_URL || '',
      callbackSecret: process.env.CMI_CALLBACK_SECRET || '',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
  },

  moderation: {
    autoApprove: bool(process.env.MODERATION_AUTO_APPROVE, false),
    bannedTerms: (process.env.MODERATION_BANNED_TERMS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },

  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  serveStatic: bool(process.env.SERVE_STATIC, isProd),
};

export const isPaymentProviderLive =
  (config.payments.provider === 'cmi' &&
    !!config.payments.cmi.merchantId &&
    !!config.payments.cmi.storeKey &&
    !!config.payments.cmi.callbackSecret) ||
  (config.payments.provider === 'stripe' &&
    !!config.payments.stripe.secretKey &&
    !!config.payments.stripe.webhookSecret);

export default config;
