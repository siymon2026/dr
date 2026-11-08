import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';
import { badRequest } from './errors.js';
import { logger } from './logger.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif']);

const SIZES = {
  full: { width: 1600, quality: 82 },
  thumb: { width: 480, quality: 74 },
  tiny: { width: 160, quality: 70 },
};

function safeDir(...parts) {
  const dir = path.join(config.uploads.dir, ...parts);
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(config.uploads.dir))) throw badRequest('invalid_path');
  return resolved;
}

const id = () => `${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;

/**
 * Validate & normalize an uploaded image into WebP variants.
 * Rejects SVG (XSS vector), oversized files and non-images (magic-byte checked by sharp).
 */
export async function processListingImage(file, userId) {
  if (!file) throw badRequest('no_file');
  if (!ALLOWED.has(file.mimetype)) throw badRequest('unsupported_image_type');
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !ALLOWED_EXT.has(ext)) throw badRequest('unsupported_image_type');
  if (file.size > config.uploads.maxFileMb * 1024 * 1024) throw badRequest('file_too_large');

  const key = id();
  const dir = safeDir('listings', String(userId));
  await fs.mkdir(dir, { recursive: true });

  let pipeline;
  try {
    pipeline = sharp(file.buffer, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
  } catch {
    throw badRequest('corrupt_image');
  }

  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw badRequest('corrupt_image');
  if (meta.width < 120 || meta.height < 120) throw badRequest('image_too_small');

  const out = {};
  for (const [name, opts] of Object.entries(SIZES)) {
    const filename = `${key}-${name}.webp`;
    await sharp(file.buffer, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: opts.width, withoutEnlargement: true })
      .webp({ quality: opts.quality, effort: 4 })
      .toFile(path.join(dir, filename));
    out[name] = `${config.uploads.publicPrefix}/listings/${userId}/${filename}`;
  }

  return {
    path: out.full,
    thumb: out.thumb,
    tiny: out.tiny,
    width: meta.width,
    height: meta.height,
  };
}

export async function removeListingImageFiles(imagePath) {
  if (!imagePath) return;
  const base = imagePath.replace(config.uploads.publicPrefix, '').replace(/^\//, '');
  const dir = path.dirname(path.join(config.uploads.dir, base));
  const name = path.basename(base, '.webp');
  for (const name2 of ['full', 'thumb', 'tiny']) {
    try {
      await fs.unlink(path.join(dir, `${name}-${name2}.webp`));
    } catch {
      /* already gone */
    }
  }
}

/** Store avatars / store logos (single square WebP). */
export async function saveSquareImage(buffer, kind, ownerId, { size = 400, mime = 'image/jpeg' } = {}) {
  if (!ALLOWED.has(mime)) throw badRequest('unsupported_image_type');
  const dir = safeDir(kind, String(ownerId));
  await fs.mkdir(dir, { recursive: true });
  const key = id();
  const filename = `${key}.webp`;
  await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 84 })
    .toFile(path.join(dir, filename));
  return `${config.uploads.publicPrefix}/${kind}/${ownerId}/${filename}`;
}

/** Accept a data URL (used for avatar uploads from the profile form). */
export async function authAvatar(dataUrl, userId) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!match) throw badRequest('invalid_avatar');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 4 * 1024 * 1024) throw badRequest('file_too_large');
  return saveSquareImage(buffer, 'avatars', userId, { size: 300, mime: match[1].toLowerCase() });
}

/** Validate an uploaded buffer as an image without writing to disk (used by chat). */
export async function processChatImage(file, userId) {
  if (!file) throw badRequest('no_file');
  if (!ALLOWED.has(file.mimetype)) throw badRequest('unsupported_image_type');
  const dir = safeDir('chat', String(userId));
  await fs.mkdir(dir, { recursive: true });
  const filename = `${id()}.webp`;
  try {
    await sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(dir, filename));
  } catch (err) {
    logger.warn({ err }, 'chat image processing failed');
    throw badRequest('corrupt_image');
  }
  return `${config.uploads.publicPrefix}/chat/${userId}/${filename}`;
}
