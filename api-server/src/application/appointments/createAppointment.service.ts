// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import type { ShareUrlBuilder } from '../../domain/shareUrlBuilder';
import type { TransactionClient } from '../../infrastructure/prismaClient';
import type { ActiveTemplateService } from './activeTemplateService';
import type { Logger } from 'pino';
import type { AppointmentMetrics } from '../../infrastructure/metrics/appointmentMetrics';
import type { AppointmentRepository } from '../../infrastructure/appointments/appointmentRepository';
import { ApplicationError, ServiceUnavailableApplicationError } from '../errors';

export interface CreateAppointmentInput {
  title: string;
  summary: string;
  timeSlotTemplateId: string;
}

export interface CreateAppointmentContext {
  requestId?: string;
}

export interface DatabaseClient {
  $transaction<T>(handler: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class CreateAppointmentService {
  constructor(
    private readonly repository: AppointmentRepository,
    private readonly shareUrlBuilder: ShareUrlBuilder,
    private readonly activeTemplateService: ActiveTemplateService,
    private readonly metrics: AppointmentMetrics,
    private readonly logger: Logger,
    private readonly database: DatabaseClient
  ) {}

  async execute(input: CreateAppointmentInput, context: CreateAppointmentContext) {
    await this.activeTemplateService.ensureTemplateIsActive(input.timeSlotTemplateId);

    try {
      const record = await this.database.$transaction(async (tx) => {
        return this.repository.create(
          {
            title: input.title,
            summary: input.summary,
            timeSlotTemplateId: input.timeSlotTemplateId
          },
          tx
        );
      });

      const shareUrl = this.shareUrlBuilder.buildRelativePath(record.id);
      this.logger.info(
        {
          event: 'appointment.created',
          appointmentId: record.id,
          requestId: context.requestId,
          timeSlotTemplateId: record.timeSlotTemplateId,
          titlePreview: record.title.slice(0, 60),
          summaryPreview: record.summary.slice(0, 200)
        },
        'Appointment created'
      );
      this.metrics.incrementAppointmentsCreated(record.timeSlotTemplateId);

      return {
        appointmentId: record.id,
        shareUrl,
        title: record.title,
        summary: record.summary,
        timeSlotTemplateId: record.timeSlotTemplateId,
        createdAt: record.createdAt
      };
    } catch (error) {
      this.logger.error(
        {
          event: 'appointment.create_failed',
          requestId: context.requestId,
          err: error
        },
        'Failed to create appointment'
      );

      if (error instanceof ApplicationError) {
        throw error;
      }

      throw new ServiceUnavailableApplicationError();
    }
  }
}
