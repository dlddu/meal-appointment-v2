// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import type { Request, Response } from 'express';
import type { ViewAppointmentService } from '../application/appointments/viewAppointment.service';
import {
  AppointmentNotFoundError,
  TemplateUnavailableError,
  TemplateEvaluationError,
  ServiceUnavailableError
} from '../application/appointments/viewAppointment.service';
import type { AppointmentMetrics } from '../infrastructure/metrics/appointmentMetrics';

const ROUTE_LABEL = 'GET /api/appointments/:appointmentId';

export class ViewAppointmentController {
  constructor(private readonly service: ViewAppointmentService, private readonly metrics: AppointmentMetrics) {}

  async handle(req: Request, res: Response): Promise<void> {
    const appointmentId = req.params.appointmentId;
    const requestId = res.locals.requestId;

    try {
      const result = await this.service.execute(appointmentId, { requestId });
      this.metrics.recordHttpRequest(ROUTE_LABEL, 200);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AppointmentNotFoundError) {
        this.metrics.recordHttpRequest(ROUTE_LABEL, 404);
        res.status(404).json({
          error: {
            code: 'APPOINTMENT_NOT_FOUND',
            message: '약속을 찾을 수 없습니다.'
          },
          requestId
        });
        return;
      }

      if (error instanceof TemplateUnavailableError || error instanceof TemplateEvaluationError || error instanceof ServiceUnavailableError) {
        this.metrics.recordHttpRequest(ROUTE_LABEL, 503);
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: '템플릿 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요.'
          },
          requestId
        });
        return;
      }

      this.metrics.recordHttpRequest(ROUTE_LABEL, 500);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '내부 오류가 발생했습니다.'
        },
        requestId
      });
    }
  }
}
