import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import type { Database } from '../../db/client.js';
import { writeAudit } from '../../lib/audit.js';
import { ValidationError } from '../../lib/errors.js';

/** The widths stored for every upload: phones load 480, larger screens 960. */
export const MEDIA_WIDTHS = [480, 960] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadedMedia {
  /** The 960-wide image; the 480 one sits beside it as -480.webp */
  url: string;
  srcset: { url: string; width: number }[];
  width: number;
  height: number;
}

/**
 * Stores admin-uploaded photos as small WebP files (low data cost for buyers), with EXIF data
 * (including GPS) stripped. Files go in MEDIA_DIR and are served at /media.
 */
export class MediaService {
  constructor(private readonly deps: { db: Database; dir: string; publicPath: string }) {}

  async upload(actorId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<UploadedMedia> {
    if (!ACCEPTED_TYPES.includes(file.mimetype)) throw new ValidationError('Upload a JPEG, PNG or WebP photo', { path: 'file' });
    let meta: Metadata;
    try {
      meta = await sharp(file.buffer).metadata();
    } catch (err) {
      throw new ValidationError('That file is not a readable image', { path: 'file', cause: String(err) });
    }
    if (!meta.width || !meta.height) throw new ValidationError('That file is not a readable image', { path: 'file' });

    await mkdir(this.deps.dir, { recursive: true });
    const id = randomUUID();
    const srcset: UploadedMedia['srcset'] = [];
    let width = 0;
    let height = 0;
    for (const w of MEDIA_WIDTHS) {
      // rotate() applies the camera orientation before EXIF is dropped (sharp drops metadata by default)
      const info = await sharp(file.buffer).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 70 }).toFile(join(this.deps.dir, `${id}-${String(w)}.webp`));
      srcset.push({ url: `${this.deps.publicPath}/${id}-${String(w)}.webp`, width: info.width });
      width = info.width;
      height = info.height;
    }
    const result = { url: `${this.deps.publicPath}/${id}-960.webp`, srcset, width, height };
    await writeAudit(this.deps.db, { actorId, action: 'media.upload', entity: 'media', entityId: id, after: { ...result, original_name: file.originalname.slice(0, 200) } });
    return result;
  }
}
