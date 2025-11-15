import { CreateAppointmentService } from '../../src/application/appointments/createAppointment.service';
import type { AppointmentRepository } from '../../src/infrastructure/appointments/appointmentRepository';
import { ShareUrlBuilder } from '../../src/domain/shareUrlBuilder';
import { ActiveTemplateService } from '../../src/application/appointments/activeTemplateService';
import { ServiceUnavailableApplicationError, ValidationApplicationError } from '../../src/application/errors';

const requestId = 'req-1';

function createService() {
  const repository: jest.Mocked<AppointmentRepository> = {
    create: jest.fn(),
    findById: jest.fn()
  } as unknown as jest.Mocked<AppointmentRepository>;
  const shareUrlBuilder = new ShareUrlBuilder();
  const activeTemplateService = new ActiveTemplateService({
    async loadActiveTemplateIds() {
      return ['default_weekly'];
    }
  });
  const metrics = {
    incrementAppointmentsCreated: jest.fn(),
    recordHttpRequest: jest.fn(),
    observeAppointmentViewDuration: jest.fn(),
    updateTemplateCacheHitRatio: jest.fn(),
    getRegistry: jest.fn(),
    reset: jest.fn()
  };
  const logger = { info: jest.fn(), error: jest.fn() } as any;
  const database = {
    $transaction: jest.fn(async (handler) => handler({} as any))
  };

  const service = new CreateAppointmentService(
    repository,
    shareUrlBuilder,
    activeTemplateService,
    metrics,
    logger,
    database as any
  );

  return { service, repository, metrics, logger, database, activeTemplateService };
}

describe('CreateAppointmentService', () => {
  it('creates an appointment and returns the response DTO', async () => {
    const { service, repository } = createService();
    repository.create.mockResolvedValue({
      id: 'abc',
      title: 'Lunch',
      summary: 'Discuss roadmap',
      timeSlotTemplateId: 'default_weekly',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z')
    });

    const result = await service.execute(
      { title: 'Lunch', summary: 'Discuss roadmap', timeSlotTemplateId: 'default_weekly' },
      { requestId }
    );

    expect(result).toEqual({
      appointmentId: 'abc',
      shareUrl: '/appointments/abc',
      title: 'Lunch',
      summary: 'Discuss roadmap',
      timeSlotTemplateId: 'default_weekly',
      createdAt: new Date('2024-01-01T00:00:00.000Z')
    });
  });

  it('propagates validation errors from the template service', async () => {
    const { service, activeTemplateService } = createService();
    jest.spyOn(activeTemplateService, 'ensureTemplateIsActive').mockRejectedValue(
      new ValidationApplicationError([{ field: 'timeSlotTemplateId', message: 'inactive' }])
    );

    await expect(
      service.execute({ title: 'Lunch', summary: '', timeSlotTemplateId: 'invalid' }, { requestId })
    ).rejects.toBeInstanceOf(ValidationApplicationError);
  });

  it('emits metrics and logs on success', async () => {
    const { service, repository, metrics, logger } = createService();
    repository.create.mockResolvedValue({
      id: 'abc',
      title: 'Lunch',
      summary: 'Discuss roadmap',
      timeSlotTemplateId: 'default_weekly',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z')
    });

    await service.execute({ title: 'Lunch', summary: 'Discuss roadmap', timeSlotTemplateId: 'default_weekly' }, { requestId });

    expect(metrics.incrementAppointmentsCreated).toHaveBeenCalledWith('default_weekly');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'appointment.created', appointmentId: 'abc', requestId }),
      'Appointment created'
    );
  });

  it('throws service unavailable on repository errors', async () => {
    const { service, database } = createService();
    database.$transaction.mockRejectedValue(new Error('db down'));

    await expect(
      service.execute({ title: 'Lunch', summary: '', timeSlotTemplateId: 'default_weekly' }, { requestId })
    ).rejects.toBeInstanceOf(ServiceUnavailableApplicationError);
  });
});
