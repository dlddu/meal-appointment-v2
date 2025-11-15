import type { ActiveTemplateService } from '../application/appointments/activeTemplateService';
import type { CreateAppointmentService } from '../application/appointments/createAppointment.service';
import type { PrometheusAppointmentMetrics } from '../infrastructure/metrics/appointmentMetrics';
import type { ViewAppointmentService } from '../application/appointments/viewAppointment.service';
import type { ViewAppointmentController } from '../presentation/viewAppointment.controller';
import type { InMemoryTemplateCache } from '../infrastructure/templates/inMemoryTemplateCache';

declare global {
  namespace Express {
    interface Locals {
      requestId?: string;
    }

    interface Application {
      locals: {
        metrics: PrometheusAppointmentMetrics;
        activeTemplateService: ActiveTemplateService;
        createAppointmentService: CreateAppointmentService;
        viewAppointmentService: ViewAppointmentService;
        viewAppointmentController: ViewAppointmentController;
        templateCache: InMemoryTemplateCache;
      };
    }
  }
}

export {};
