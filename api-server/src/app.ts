import express from 'express';
import healthRouter from './presentation/health.router';
import prisma from './infrastructure/prismaClient';
import { logger } from './infrastructure/logger';
import { createAppointmentsRouter } from './presentation/appointments.router';
import { ActiveTemplateService } from './application/appointments/activeTemplateService';
import { DefaultActiveTemplateProvider } from './infrastructure/templates/defaultTemplateProvider';
import { PrismaAppointmentRepository } from './infrastructure/appointments/appointmentRepository';
import { ShareUrlBuilder } from './domain/shareUrlBuilder';
import { CreateAppointmentService } from './application/appointments/createAppointment.service';
import { PrometheusAppointmentMetrics } from './infrastructure/metrics/appointmentMetrics';
import { ApplicationError } from './application/errors';

const app = express();

const activeTemplateService = new ActiveTemplateService(new DefaultActiveTemplateProvider());
const appointmentRepository = new PrismaAppointmentRepository();
const shareUrlBuilder = new ShareUrlBuilder();
const metrics = new PrometheusAppointmentMetrics();
const createAppointmentService = new CreateAppointmentService(
  appointmentRepository,
  shareUrlBuilder,
  activeTemplateService,
  metrics,
  logger,
  prisma
);

app.locals.metrics = metrics;
app.locals.activeTemplateService = activeTemplateService;
app.locals.createAppointmentService = createAppointmentService;

app.use(express.json());

app.use((req, res, next) => {
  const requestId = req.header('x-request-id') ?? req.header('request-id');
  if (requestId) {
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
  }
  next();
});

app.use('/api', healthRouter);
app.use('/api/appointments', createAppointmentsRouter({ createAppointmentService, activeTemplateService }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ApplicationError) {
    logger.error({ err, requestId: res.locals.requestId, code: err.code });
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      requestId: res.locals.requestId,
      ...(err.details ?? {})
    });
    return;
  }

  logger.error({ err, requestId: res.locals.requestId }, 'Unhandled error');
  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    requestId: res.locals.requestId
  });
});

export default app;
