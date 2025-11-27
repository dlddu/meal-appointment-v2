import express from 'express';
import cors from 'cors';
import healthRouter from './presentation/health.router';
import prisma from './infrastructure/prismaClient';
import { logger } from './infrastructure/logger';
import { createAppointmentsRouter } from './presentation/appointments.router';
import { ActiveTemplateService } from './application/appointments/activeTemplateService';
import { DefaultActiveTemplateProvider } from './infrastructure/templates/defaultTemplateProvider';
import { PrismaAppointmentRepository } from './infrastructure/appointments/appointmentRepository';
import { ShareUrlBuilder } from './domain/shareUrlBuilder';
import { CreateAppointmentService } from './application/appointments/createAppointment.service';
import { ViewAppointmentService } from './application/appointments/viewAppointment.service';
import { PrometheusAppointmentMetrics } from './infrastructure/metrics/appointmentMetrics';
import { ApplicationError } from './application/errors';
import { PrismaTemplateRepository } from './infrastructure/templates/templateRepository';
import { PrismaParticipantRepository } from './infrastructure/participants/participantRepository';
import { PrismaAvailabilityRepository } from './infrastructure/availability/availabilityRepository';
import { InMemoryTemplateCache } from './infrastructure/templates/inMemoryTemplateCache';
import { ViewAppointmentController } from './presentation/viewAppointment.controller';
import { createAppointmentPublicRouter } from './presentation/appointmentPublic.router';
import { TimeSlotTemplateService } from './application/participants/timeSlotTemplate.service';
import { JoinParticipantService } from './application/participants/joinParticipant.service';
import { SubmitResponsesService } from './application/participants/submitResponses.service';
import { createParticipationRouter } from './presentation/participation.router';
import { ListTemplatesService } from './application/templates/listTemplates.service';
import { createTemplatesRouter } from './presentation/templates.router';

const app = express();

app.use(cors());

const activeTemplateService = new ActiveTemplateService(new DefaultActiveTemplateProvider());
const appointmentRepository = new PrismaAppointmentRepository();
const shareUrlBuilder = new ShareUrlBuilder();
const metrics = new PrometheusAppointmentMetrics();
const templateRepository = new PrismaTemplateRepository();
const participantRepository = new PrismaParticipantRepository();
const availabilityRepository = new PrismaAvailabilityRepository();
const templateCache = new InMemoryTemplateCache(5 * 60 * 1000, metrics);
const timeSlotTemplateService = new TimeSlotTemplateService(templateRepository, templateCache, logger);
const createAppointmentService = new CreateAppointmentService(
  appointmentRepository,
  shareUrlBuilder,
  activeTemplateService,
  metrics,
  logger,
  prisma
);
const listTemplatesService = new ListTemplatesService(templateRepository, activeTemplateService);
const viewAppointmentService = new ViewAppointmentService(
  appointmentRepository,
  templateRepository,
  participantRepository,
  availabilityRepository,
  templateCache,
  metrics,
  logger
);
const joinParticipantService = new JoinParticipantService(
  appointmentRepository,
  participantRepository,
  availabilityRepository,
  metrics,
  logger,
  prisma
);
const submitResponsesService = new SubmitResponsesService(
  appointmentRepository,
  participantRepository,
  availabilityRepository,
  timeSlotTemplateService,
  metrics,
  logger,
  prisma
);
const viewAppointmentController = new ViewAppointmentController(viewAppointmentService, metrics);

app.locals.metrics = metrics;
app.locals.activeTemplateService = activeTemplateService;
app.locals.createAppointmentService = createAppointmentService;
app.locals.viewAppointmentService = viewAppointmentService;
app.locals.viewAppointmentController = viewAppointmentController;
app.locals.templateCache = templateCache;
app.locals.timeSlotTemplateService = timeSlotTemplateService;
app.locals.joinParticipantService = joinParticipantService;
app.locals.submitResponsesService = submitResponsesService;
app.locals.listTemplatesService = listTemplatesService;

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
app.use('/api/appointments', createAppointmentPublicRouter({ viewAppointmentController }));
app.use(
  '/api/appointments',
  createParticipationRouter({ joinParticipantService, submitResponsesService })
);
app.use('/api/templates', createTemplatesRouter({ listTemplatesService }));

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
