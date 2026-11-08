import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';

let transporter = null;

function getTransport() {
  if (!config.mail.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    logger.info({ to, subject }, 'mail disabled (SMTP not configured) — message logged only');
    return { skipped: true };
  }
  const info = await transport.sendMail({
    from: config.mail.from,
    to,
    subject,
    text,
    html: html || undefined,
  });
  logger.info({ to, subject, id: info.messageId }, 'mail sent');
  return info;
}

/**
 * SMS delivery is provider-agnostic. Wire a Moroccan gateway (e.g. Twilio,
 * Infobip, local aggregator) by implementing `deliver` below and enabling
 * SMS_ENABLED with credentials in .env.
 */
export async function sendSms(to, message) {
  if (!config.sms.enabled) {
    logger.info({ to }, 'sms disabled (no provider configured) — message logged only');
    return { skipped: true };
  }
  logger.info({ to, provider: config.sms.provider }, 'sms dispatched to provider adapter');
  // TODO(provider): call the configured gateway REST API with config.sms.apiKey.
  return { queued: true, preview: message.slice(0, 20) };
}
