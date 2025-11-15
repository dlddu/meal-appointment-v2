import type { Request, Response } from 'express';
import { ViewAppointmentController } from '../../src/presentation/viewAppointment.controller';
import type { ViewAppointmentService } from '../../src/application/appointments/viewAppointment.service';
import { AppointmentNotFoundError, TemplateUnavailableError, TemplateEvaluationError } from '../../src/application/appointments/viewAppointment.service';
import type { AppointmentMetrics } from '../../src/infrastructure/metrics/appointmentMetrics';

describe('ViewAppointmentController', () => {
  const createMocks = () => {
    const service: jest.Mocked<ViewAppointmentService> = {
      execute: jest.fn()
    } as unknown as jest.Mocked<ViewAppointmentService>;
    const metrics: jest.Mocked<AppointmentMetrics> = {
      incrementAppointmentsCreated: jest.fn(),
      recordHttpRequest: jest.fn(),
      observeAppointmentViewDuration: jest.fn(),
      updateTemplateCacheHitRatio: jest.fn(),
      getRegistry: jest.fn(),
      reset: jest.fn()
    } as unknown as jest.Mocked<AppointmentMetrics>;

    const controller = new ViewAppointmentController(service, metrics);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    } as unknown as Response;

    const req = {
      params: { appointmentId: 'apt-1' },
      headers: {}
    } as unknown as Request;

    return { service, metrics, controller, res, req };
  };

  it('returns 200 with view payload', async () => {
    const { service, controller, res, req, metrics } = createMocks();
    service.execute.mockResolvedValue({
      appointment: {},
      template: {},
      participants: [],
      aggregates: {}
    } as any);

    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ participants: [] }));
    expect(metrics.recordHttpRequest).toHaveBeenCalledWith('GET /api/appointments/:appointmentId', 200);
  });

  it('maps AppointmentNotFoundError to 404', async () => {
    const { service, controller, res, req, metrics } = createMocks();
    res.locals.requestId = 'req-1';
    service.execute.mockRejectedValue(new AppointmentNotFoundError('apt-1'));

    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'APPOINTMENT_NOT_FOUND',
        message: '약속을 찾을 수 없습니다.'
      },
      requestId: 'req-1'
    });
    expect(metrics.recordHttpRequest).toHaveBeenCalledWith('GET /api/appointments/:appointmentId', 404);
  });

  it('maps template errors to 503', async () => {
    const { service, controller, res, req, metrics } = createMocks();
    service.execute.mockRejectedValue(new TemplateUnavailableError('tmpl-1'));

    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '템플릿 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요.'
      },
      requestId: undefined
    });
    expect(metrics.recordHttpRequest).toHaveBeenCalledWith('GET /api/appointments/:appointmentId', 503);
  });

  it('maps TemplateEvaluationError to 503', async () => {
    const { service, controller, res, req } = createMocks();
    service.execute.mockRejectedValue(new TemplateEvaluationError('tmpl-1'));

    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('maps unexpected errors to 500', async () => {
    const { service, controller, res, req, metrics } = createMocks();
    res.locals.requestId = 'rid';
    service.execute.mockRejectedValue(new Error('boom'));

    await controller.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: '내부 오류가 발생했습니다.'
      },
      requestId: 'rid'
    });
    expect(metrics.recordHttpRequest).toHaveBeenCalledWith('GET /api/appointments/:appointmentId', 500);
  });

  it('ignores Accept header values when returning JSON', async () => {
    const { service, controller, res, req } = createMocks();
    service.execute.mockResolvedValue({ appointment: {}, template: {}, participants: [], aggregates: {} } as any);
    req.headers = { accept: 'text/html' } as any;

    await controller.handle(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.any(Object));
  });
});
