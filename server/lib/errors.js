export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg = 'invalid_request', details) => new AppError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'authentication_required') => new AppError(401, 'unauthorized', msg);
export const forbidden = (msg = 'permission_denied') => new AppError(403, 'forbidden', msg);
export const notFound = (msg = 'not_found') => new AppError(404, 'not_found', msg);
export const conflict = (msg = 'conflict') => new AppError(409, 'conflict', msg);
export const tooMany = (msg = 'too_many_requests') => new AppError(429, 'rate_limited', msg);
export const serverError = (msg = 'internal_error') => new AppError(500, 'server_error', msg);

/** Wrap async express handlers so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
