// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import bcrypt from 'bcryptjs';
import type { Logger } from 'pino';
import type { AppointmentRepository } from '../../infrastructure/appointments/appointmentRepository';
import type { ParticipantRepository } from '../../infrastructure/participants/participantRepository';
import type { AvailabilityRepository } from '../../infrastructure/availability/availabilityRepository';
import type { AppointmentMetrics } from '../../infrastructure/metrics/appointmentMetrics';
import type { TransactionClient } from '../../infrastructure/prismaClient';
import {
  ApplicationError,
  AppointmentNotFoundApplicationError,
  InvalidPinApplicationError,
  NicknameTakenApplicationError,
  ServiceUnavailableApplicationError
} from '../errors';

export interface JoinParticipantInput {
  appointmentId: string;
  nickname: string;
  pin?: string;
}

export interface JoinParticipantContext {
  requestId?: string;
}

export interface JoinParticipantResult {
  participantId: string;
  nickname: string;
  hasPin: boolean;
  submittedAt: string | null;
  responses: string[];
}

interface DatabaseClient {
  $transaction<T>(handler: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class JoinParticipantService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly participantRepository: ParticipantRepository,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly metrics: AppointmentMetrics,
    private readonly logger: Logger,
    private readonly database: DatabaseClient
  ) {}

  async execute(input: JoinParticipantInput, context: JoinParticipantContext): Promise<JoinParticipantResult> {
    const start = Date.now();
    try {
      const appointment = await this.appointmentRepository.findById(input.appointmentId);
      if (!appointment) {
        throw new AppointmentNotFoundApplicationError();
      }

      let participant = await this.participantRepository.findByAppointmentAndNickname(
        input.appointmentId,
        input.nickname
      );
      if (!participant) {
        const pinHash = input.pin ? await bcrypt.hash(input.pin, 10) : null;
        participant = await this.database.$transaction((tx) =>
          this.participantRepository.create(input.appointmentId, input.nickname, pinHash, tx)
        );
      } else if (participant.pinHash) {
        if (!input.pin || !(await bcrypt.compare(input.pin, participant.pinHash))) {
          this.logger.warn(
            { event: 'participant.pin_invalid', appointmentId: input.appointmentId, requestId: context.requestId },
            'PIN validation failed'
          );
          throw new InvalidPinApplicationError();
        }
      }

      const availability = await this.availabilityRepository.listByParticipant(participant.id);
      const responses = availability.map((record) => record.slotKey);

      this.logger.info(
        {
          event: 'participant.joined',
          appointmentId: input.appointmentId,
          participantId: participant.id,
          nickname: participant.nickname,
          hasPin: Boolean(participant.pinHash),
          requestId: context.requestId
        },
        'Participant joined'
      );

      const submittedAt = participant.submittedAt ? participant.submittedAt.toISOString() : null;
      return {
        participantId: participant.id,
        nickname: participant.nickname,
        hasPin: Boolean(participant.pinHash),
        submittedAt,
        responses
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new NicknameTakenApplicationError();
      }
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.logger.error(
        { event: 'participant.join_failed', requestId: context.requestId, appointmentId: input.appointmentId, err: error },
        'Failed to create or reuse participant'
      );
      throw new ServiceUnavailableApplicationError();
    } finally {
      this.metrics.observeParticipantJoin(Date.now() - start);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean((error as { code?: string })?.code === '23505');
  }
}
