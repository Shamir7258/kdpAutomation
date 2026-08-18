import { Router, type Request, type Response } from 'express';
import { LocalStorageProvider } from '@kdp/storage';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { requireAuth } from '../auth/auth.guard.js';
import { AppError } from '../../common/errors/app-error.js';
import { getStorageProvider } from './storage-provider.instance.js';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  epub: 'application/epub+zip',
};

/**
 * Dev-only proxy for LocalStorageProvider files — see local-storage-provider.ts. Every key this
 * platform writes is namespaced `<category>/<userId>/...`, so ownership is enforced by checking
 * that segment against the authenticated user rather than trusting the key alone.
 * S3StorageProvider never routes through here — its URLs are presigned and point at the object
 * store directly.
 */
export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.get(
  '/*',
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params[0];
    if (!key) throw AppError.notFound('File not found.');

    const [, ownerId] = key.split('/');
    if (ownerId !== req.user!.id) {
      throw AppError.notFound('File not found.');
    }

    const provider = getStorageProvider();
    if (!(provider instanceof LocalStorageProvider)) {
      throw AppError.notFound('File not found.');
    }
    if (!(await provider.exists(key))) {
      throw AppError.notFound('File not found.');
    }

    const data = await provider.read(key);
    const extension = key.split('.').pop() ?? '';
    const filename = key.split('/').pop() ?? 'download';

    res.set('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }),
);
