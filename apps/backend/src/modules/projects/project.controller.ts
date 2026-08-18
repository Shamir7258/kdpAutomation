import type { Request, Response } from 'express';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { projectService } from './project.service.js';

export const projectController = {
  async create(req: Request, res: Response): Promise<void> {
    const project = await projectService.create(req.user!.id, req.body as CreateProjectInput);
    ok(res, project, 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const result = await projectService.list(req.user!.id, req.query as unknown as ListProjectsQuery);
    ok(res, result);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const project = await projectService.getById(req.user!.id, req.params.id!);
    ok(res, project);
  },

  async update(req: Request, res: Response): Promise<void> {
    const project = await projectService.update(req.user!.id, req.params.id!, req.body as UpdateProjectInput);
    ok(res, project);
  },

  async duplicate(req: Request, res: Response): Promise<void> {
    const project = await projectService.duplicate(req.user!.id, req.params.id!);
    ok(res, project, 201);
  },

  async archive(req: Request, res: Response): Promise<void> {
    const project = await projectService.archive(req.user!.id, req.params.id!);
    ok(res, project);
  },

  async restore(req: Request, res: Response): Promise<void> {
    const project = await projectService.restore(req.user!.id, req.params.id!);
    ok(res, project);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await projectService.softDelete(req.user!.id, req.params.id!);
    ok(res, { deleted: true });
  },
};
