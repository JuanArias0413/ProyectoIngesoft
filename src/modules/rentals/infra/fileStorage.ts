import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { env } from '../../../config/env.js';
import { ValidationError } from '../../../shared/errors.js';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (AC-04.2, AC-04.3)

export function ensureStorageDirectoryExists(): string {
  const dir = path.resolve(env.STORAGE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function resolveStoragePath(fileKey: string): string {
  const storageDir = ensureStorageDirectoryExists();
  const safeName = path.basename(fileKey);
  const resolved = path.resolve(storageDir, safeName);

  if (!resolved.startsWith(storageDir)) {
    throw new ValidationError('Ruta de archivo no permitida');
  }

  return resolved;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const dir = ensureStorageDirectoryExists();
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '.bin';
    const uniqueKey = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
    cb(null, uniqueKey);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        'Tipo de archivo no permitido. Solo se admiten archivos PDF, JPEG o PNG (máx. 5 MB) (AC-04.3)',
      ),
    );
  }
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

export const rentalUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const uploadFields = multerInstance.fields([
    { name: 'archivo', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'voucherFile', maxCount: 1 },
  ]);

  uploadFields(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ValidationError(
              'El archivo supera el tamaño máximo permitido de 5 MB (AC-04.3)',
            ),
          );
        }
        return next(new ValidationError(`Error en carga de archivo: ${err.message}`));
      }
      return next(err);
    }

    // Normalizar req.file si se subió algún archivo
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    if (files) {
      const singleFile =
        files.archivo?.[0] || files.file?.[0] || files.voucherFile?.[0];
      if (singleFile) {
        req.file = singleFile;
      }
    }

    next();
  });
};
