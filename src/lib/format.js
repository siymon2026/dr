export function formatPrice(amount, currency = 'MAD', lang = 'ar') {
  const value = Number(amount) || 0;
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-MA';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      numberingSystem: 'latn',
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ${currency}`;
  }
}

export function formatNumber(n, lang = 'en') {
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(Number(n) || 0);
  } catch {
    return String(n ?? 0);
  }
}

export function formatDate(ts, lang = 'ar', { withTime = false } = {}) {
  if (!ts) return '';
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      numberingSystem: 'latn',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

export function timeAgo(ts, t) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('common.justNow');
  if (min < 60) return t('common.minutesAgo', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('common.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('common.daysAgo', { n: days });
  return formatDate(ts);
}

export function timeOnly(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(ts, lang, t) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return t('messages.today');
  if (sameDay(date, yesterday)) return t('messages.yesterday');
  return formatDate(ts, lang);
}

/** Localized name object → string. */
export function pickName(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.ar || obj.en || obj.fr || '';
}

export function initials(name) {
  if (!name) return '؟';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join('').toUpperCase();
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function plural(n, lang) {
  return n;
}
