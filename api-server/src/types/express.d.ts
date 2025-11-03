import type { ActiveTemplateService } from '../application/appointments/activeTemplateService';
import type { CreateAppointmentService } from '../application/appointments/createAppointment.service';
import type { PrometheusAppointmentMetrics } from '../infrastructure/metrics/appointmentMetrics';

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
      };
    }
  }
}

export {};
