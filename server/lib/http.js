import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { csrfTokenFor, timingSafeEqualStr, clientIp } from './security.js';
import { tooMany, forbidden, AppError } from './errors.js';
import { getSettings } from './settings.js';

const skip = () => !config.security.rateLimitEnabled;

export function limiter(windowMs, max, message = 'too_many_requests') {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    keyGenerator: (req) => clientIp(req),
    handler: (_req, _res, next) => next(tooMany(message)),
  });
}

export const limiters = {
  login: limiter(15 * 60 * 1000, config.security.limits.login, 'too_many_login_attempts'),
  register: limiter(60 * 60 * 1000, config.security.limits.register, 'too_many_registrations'),
  write: limiter(60 * 1000, config.security.limits.write, 'slow_down'),
  upload: limiter(60 * 1000, config.security.limits.upload, 'too_many_uploads'),
  message: limiter(60 * 1000, config.security.limits.message, 'too_many_messages'),
  report: limiter(60 * 60 * 1000, config.security.limits.report, 'too_many_reports'),
  contact: limiter(60 * 60 * 1000, config.security.limits.contact, 'too_many_requests'),
  otp: limiter(15 * 60 * 1000, 6, 'too_many_codes'),
};

/**
 * CSRF protection: header token must match an HMAC of the session id.
 * Combined with SameSite=Lax cookies this blocks cross-site form posts.
 */
export function csrfProtect(req, _res, next) {
  if (!config.security.csrfEnabled) return next();
  // Maintenance mode: read-only, so mutations are refused before CSRF (which may
  // legitimately fail for visitors holding a stale token from before the switch).
  if (req.method !== 'GET' && getSettings().maintenance_mode) {
    const staffRoles = ['support', 'finance', 'moderator', 'admin', 'superadmin'];
    if (!req.user || !staffRoles.includes(req.user.role)) {
      return next(new AppError(503, 'maintenance_mode', 'maintenance_mode'));
    }
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/api/webhooks/')) return next(); // verified by provider signature
  const expected = csrfTokenFor(req.session?.id || 'anon');
  const provided = req.get('x-csrf-token') || req.body?._csrf;
  if (!provided) return next(forbidden('csrf_token_missing'));
  if (!timingSafeEqualStr(provided, expected)) return next(forbidden('csrf_token_invalid'));
  next();
}
