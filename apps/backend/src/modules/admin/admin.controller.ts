import type { Request, Response } from 'express';
import type { UpdateUserInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { adminService } from './admin.service.js';

export const adminController = {
  async listUsers(_req: Request, res: Response): Promise<void> {
    ok(res, await adminService.listUsers());
  },

  async updateUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.updateUser(req.user!.id, req.params.userId!, req.body as UpdateUserInput);
    ok(res, user);
  },

  async getValidationRules(_req: Request, res: Response): Promise<void> {
    ok(res, adminService.getValidationRules());
  },

  async getSystemInfo(_req: Request, res: Response): Promise<void> {
    ok(res, await adminService.getSystemInfo());
  },
};
