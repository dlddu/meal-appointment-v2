// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import express from 'express';
import type { ViewAppointmentController } from './viewAppointment.controller';

export interface AppointmentPublicRouterDependencies {
  viewAppointmentController: ViewAppointmentController;
}

export function createAppointmentPublicRouter({
  viewAppointmentController
}: AppointmentPublicRouterDependencies): express.Router {
  const router = express.Router();

  router.get('/:appointmentId([A-Za-z0-9_-]+)', (req, res, next) => {
    void viewAppointmentController.handle(req, res).catch(next);
  });

  return router;
}

export default createAppointmentPublicRouter;
