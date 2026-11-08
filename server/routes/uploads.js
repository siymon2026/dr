import { Router } from 'express';
import multer from 'multer';
import { db, now } from '../lib/db.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors.js';
import { processListingImage, removeListingImageFiles, saveSquareImage } from '../lib/storage.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxFileMb * 1024 * 1024, files: config.uploads.maxFiles },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
    cb(badRequest('unsupported_image_type'));
  },
});

async function ownedListing(user, listingId) {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(listingId));
  if (!listing) throw notFound('listing_not_found');
  const isStaff = ['admin', 'superadmin', 'moderator'].includes(user.role);
  if (listing.user_id !== user.id && !isStaff) throw forbidden();
  return listing;
}

router.post(
  '/listing/:id',
  requireAuth,
  upload.array('images', config.uploads.maxFiles),
  asyncHandler(async (req, res) => {
    const listing = await ownedListing(req.user, req.params.id);
    if (!req.files?.length) throw badRequest('no_files');

    const existing = db
      .prepare('SELECT COUNT(*) c, COALESCE(MAX(position), -1) max_pos FROM listing_images WHERE listing_id = ?')
      .get(listing.id);
    const room = 15 - existing.c;
    if (room <= 0) throw badRequest('max_images_reached');
    // Reject the whole batch instead of silently dropping photos.
    if (req.files.length > room) throw badRequest('too_many_images', { max: 15, remaining: room });

    const files = req.files;
    const saved = [];
    for (let i = 0; i < files.length; i += 1) {
      const processed = await processListingImage(files[i], req.user.id);
      const position = existing.max_pos + 1 + i;
      const isPrimary = existing.c === 0 && i === 0 ? 1 : 0;
      const info = db
        .prepare(
          `INSERT INTO listing_images (listing_id, path, thumb, width, height, position, is_primary, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(listing.id, processed.path, processed.thumb, processed.width, processed.height, position, isPrimary, now());
      saved.push({
        id: Number(info.lastInsertRowid),
        path: processed.path,
        thumb: processed.thumb,
        position,
        is_primary: !!isPrimary,
      });
    }
    res.status(201).json({ images: saved, remaining: room - saved.length });
  }),
);

router.post(
  '/listing/:id/primary/:imageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await ownedListing(req.user, req.params.id);
    const imageId = Number(req.params.imageId);
    const image = db.prepare('SELECT * FROM listing_images WHERE id = ? AND listing_id = ?').get(imageId, listing.id);
    if (!image) throw notFound('image_not_found');
    db.transaction(() => {
      db.prepare('UPDATE listing_images SET is_primary = 0 WHERE listing_id = ?').run(listing.id);
      db.prepare('UPDATE listing_images SET is_primary = 1 WHERE id = ?').run(imageId);
    })();
    res.json({ ok: true });
  }),
);

router.delete(
  '/listing/:id/:imageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await ownedListing(req.user, req.params.id);
    const image = db
      .prepare('SELECT * FROM listing_images WHERE id = ? AND listing_id = ?')
      .get(Number(req.params.imageId), listing.id);
    if (!image) throw notFound('image_not_found');

    db.prepare('DELETE FROM listing_images WHERE id = ?').run(image.id);
    const remaining = db.prepare('SELECT id FROM listing_images WHERE listing_id = ? ORDER BY position, id').all(listing.id);
    if (image.is_primary && remaining[0]) {
      db.prepare('UPDATE listing_images SET is_primary = 1 WHERE id = ?').run(remaining[0].id);
    }
    await removeListingImageFiles(image.path);
    res.json({ ok: true });
  }),
);

router.post(
  '/avatar',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('no_file');
    const path = await saveSquareImage(req.file.buffer, 'avatars', req.user.id, {
      size: 300,
      mime: req.file.mimetype,
    });
    db.prepare('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?').run(path, now(), req.user.id);
    res.status(201).json({ avatar: path });
  }),
);

router.post(
  '/store-assets',
  requireAuth,
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const out = {};
    if (req.files?.logo?.[0]) {
      out.logo = await saveSquareImage(req.files.logo[0].buffer, 'stores', req.user.id, {
        size: 400,
        mime: req.files.logo[0].mimetype,
      });
    }
    if (req.files?.cover?.[0]) {
      out.cover = await saveSquareImage(req.files.cover[0].buffer, 'stores', req.user.id, {
        size: 1200,
        mime: req.files.cover[0].mimetype,
      });
    }
    if (!Object.keys(out).length) throw badRequest('no_files');
    res.status(201).json(out);
  }),
);

export default router;
