import { z } from 'zod';
import { badRequest } from './errors.js';
import { cleanText, normalizeEmail, normalizePhone } from './security.js';

export { z };

/** Validate with a zod schema, throwing a clean 400 with field errors. */
export function validate(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw badRequest('validation_failed', fieldErrors);
  }
  return parsed.data;
}

export const emailSchema = z
  .string()
  .trim()
  .max(190)
  .transform((v, ctx) => {
    const e = normalizeEmail(v);
    if (!e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_email' });
      return z.NEVER;
    }
    return e;
  });

export const phoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_moroccan_phone' });
      return z.NEVER;
    }
    return p;
  });

export const text = (min, max) =>
  z
    .string()
    .superRefine((v, ctx) => {
      const cleaned = cleanText(v, { maxLength: max + 1 });
      if (cleaned.length > max) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_long' });
      if (cleaned.length < min) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_short' });
    })
    .transform((v) => cleanText(v, { maxLength: max }));

export const idSchema = z.coerce.number().int().positive();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const booleanish = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((v) => ['1', 'true', 'yes', 'on', true, 1].includes(typeof v === 'string' ? v.toLowerCase() : v))
  .default(false);

export const cityIdSchema = z.coerce.number().int().positive();
