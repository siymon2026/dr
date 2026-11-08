/**
 * API client.
 * - Same-origin requests (`/api/...`) so cookies + CSRF work in dev (Vite proxy) and prod.
 * - CSRF token is kept in memory/cookie and attached to every mutating request.
 */

let csrfToken = null;
let onUnauthorized = null;

export function setCsrfToken(token) {
  if (token) csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|;\s*)bc_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code || 'request_failed');
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, { body, form, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = csrfToken || readCsrfCookie();
  if (token && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = token;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'network_error');
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const error = data?.error || {};
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, error.code || `http_${res.status}`, error.message, error.details);
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { body, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, { body, ...opts }),
  put: (path, body, opts) => request('PUT', path, { body, ...opts }),
  del: (path, body, opts) => request('DELETE', path, { body, ...opts }),
  upload: (path, form) => request('POST', path, { form }),
};

export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
