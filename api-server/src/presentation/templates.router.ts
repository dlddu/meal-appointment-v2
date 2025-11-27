// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import express from 'express';
import type { ListTemplatesService } from '../application/templates/listTemplates.service';
import { ApplicationError, InternalServerApplicationError } from '../application/errors';

export interface TemplatesRouterDependencies {
  listTemplatesService: ListTemplatesService;
}

export function createTemplatesRouter({ listTemplatesService }: TemplatesRouterDependencies): express.Router {
  const router = express.Router();

  router.get('/', async (_req, res, next) => {
    try {
      const templates = await listTemplatesService.execute();
      res.json({
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          status: template.status,
          badge: template.status === 'inactive' ? '준비 중' : undefined
        }))
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        next(error);
        return;
      }
      next(new InternalServerApplicationError());
    }
  });

  return router;
}

export default createTemplatesRouter;
