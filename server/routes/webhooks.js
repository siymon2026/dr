import crypto from 'node:crypto';
import express from 'express';
import { db, now, toJson } from '../lib/db.js';
import { config, isPaymentProviderLive } from '../config.js';
import { logger } from '../lib/logger.js';
import { applyPaidOrder } from '../lib/billing.js';
import { timingSafeEqualStr } from '../lib/security.js';

/**
 * Payment webhooks. Signature verification is mandatory:
 *  - Stripe: HMAC-SHA256 of `${timestamp}.${rawBody}` using STRIPE_WEBHOOK_SECRET
 *  - CMI:    HMAC-SHA256 of the sorted raw fields using CMI_CALLBACK_SECRET
 * Unsigned or invalid calls are recorded and rejected — never applied.
 */
export function registerWebhookRoutes(app) {
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const raw = req.body?.toString('utf8') || '';
      const signature = req.get('stripe-signature') || '';
      const secret = config.payments.stripe.webhookSecret;

      let signatureOk = false;
      if (isPaymentProviderLive && secret) {
        const parts = Object.fromEntries(
          signature
            .split(',')
            .map((p) => p.split('='))
            .filter((p) => p.length === 2),
        );
        if (parts.t && parts.v1) {
          const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
          signatureOk = timingSafeEqualStr(expected, parts.v1);
        }
      }

      const info = db
        .prepare(
          'INSERT INTO payment_webhooks (provider, event, payload, signature_ok, processed, created_at) VALUES (?,?,?,?,?,?)',
        )
        .run('stripe', null, raw.slice(0, 20000), signatureOk ? 1 : 0, 0, now());

      if (!signatureOk) {
        logger.warn({ ip: req.ip }, 'stripe webhook rejected: invalid signature');
        return res.status(400).json({ error: 'invalid_signature' });
      }

      try {
        const event = JSON.parse(raw);
        const reference =
          event?.data?.object?.metadata?.order_reference || event?.data?.object?.client_reference_id;
        const order = reference ? db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference) : null;
        if (order && event.type === 'checkout.session.completed') {
          applyPaidOrder(order.id, { provider: 'stripe', providerRef: event.id });
          db.prepare('UPDATE payment_webhooks SET event = ?, processed = 1 WHERE id = ?').run(event.type, info.lastInsertRowid);
        }
        res.json({ received: true });
      } catch (err) {
        logger.error({ err }, 'stripe webhook parse error');
        res.status(400).json({ error: 'invalid_payload' });
      }
    },
  );

  app.post('/api/webhooks/cmi', express.urlencoded({ extended: false }), (req, res) => {
    const payload = req.body || {};
    const secret = config.payments.cmi.callbackSecret;
    const provided = String(payload.HASH || payload.hash || '');
    let signatureOk = false;
    if (isPaymentProviderLive && secret) {
      const base = Object.keys(payload)
        .filter((k) => !['HASH', 'hash'].includes(k))
        .sort()
        .map((k) => `${k}=${payload[k]}`)
        .join('|');
      const expected = crypto.createHmac('sha256', secret).update(base).digest('base64');
      signatureOk = timingSafeEqualStr(expected, provided);
    }

    db.prepare(
      'INSERT INTO payment_webhooks (provider, event, payload, signature_ok, processed, created_at) VALUES (?,?,?,?,?,?)',
    ).run('cmi', payload.PROCESS ?? null, toJson(payload).slice(0, 20000), signatureOk ? 1 : 0, 0, now());

    if (!signatureOk) {
      logger.warn({ ip: req.ip }, 'cmi webhook rejected: invalid signature');
      return res.status(400).send('invalid_signature');
    }
    const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(String(payload.oid || ''));
    if (order && String(payload.STATUS ?? payload.PROCESS) === 'SUCCESS') {
      applyPaidOrder(order.id, { provider: 'cmi', providerRef: String(payload.TransId || '') });
    }
    res.send('OK');
  });
}

export default registerWebhookRoutes;
