import type { ActiveTemplateService } from '../application/appointments/activeTemplateService';
import type { CreateAppointmentService } from '../application/appointments/createAppointment.service';
import type { PrometheusAppointmentMetrics } from '../infrastructure/metrics/appointmentMetrics';
import type { ViewAppointmentService } from '../application/appointments/viewAppointment.service';
import type { ViewAppointmentController } from '../presentation/viewAppointment.controller';
import type { InMemoryTemplateCache } from '../infrastructure/templates/inMemoryTemplateCache';
import type { TimeSlotTemplateService } from '../application/participants/timeSlotTemplate.service';
import type { JoinParticipantService } from '../application/participants/joinParticipant.service';
import type { SubmitResponsesService } from '../application/participants/submitResponses.service';
import type { ListTemplatesService } from '../application/templates/listTemplates.service';

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
        timeSlotTemplateService: TimeSlotTemplateService;
        joinParticipantService: JoinParticipantService;
        submitResponsesService: SubmitResponsesService;
        listTemplatesService: ListTemplatesService;
      };
    }
  }
}

export {};
