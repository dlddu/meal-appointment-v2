import { ViewAppointmentService, AppointmentNotFoundError, TemplateUnavailableError, TemplateEvaluationError } from '../../src/application/appointments/viewAppointment.service';
import type { AppointmentRepository } from '../../src/infrastructure/appointments/appointmentRepository';
import type { TemplateRepository, TemplateRecord } from '../../src/infrastructure/templates/templateRepository';
import { TemplateParsingError } from '../../src/infrastructure/templates/templateRepository';
import type { ParticipantRepository } from '../../src/infrastructure/participants/participantRepository';
import type { AvailabilityRepository } from '../../src/infrastructure/availability/availabilityRepository';
import type { AppointmentMetrics } from '../../src/infrastructure/metrics/appointmentMetrics';
import type { TemplateCache } from '../../src/application/appointments/viewAppointment.service';

const baseAppointment = {
  id: 'apt-1',
  title: 'Dinner',
  summary: 'Team dinner',
  timeSlotTemplateId: 'tmpl-1',
  createdAt: new Date('2024-03-01T10:00:00Z'),
  updatedAt: new Date('2024-03-02T11:00:00Z')
};

const baseTemplate: TemplateRecord = {
  id: 'tmpl-1',
  name: 'Weekly',
  description: 'desc',
  rules: [
    { dayPattern: '2024-03-05', mealTypes: ['DINNER'] },
    { dayPattern: '2024-03-06', mealTypes: ['LUNCH'] }
  ]
};

describe('ViewAppointmentService', () => {
  const createDependencies = () => {
    const appointmentRepository: jest.Mocked<AppointmentRepository> = {
      create: jest.fn(),
      findById: jest.fn()
    } as unknown as jest.Mocked<AppointmentRepository>;
    const templateRepository: jest.Mocked<TemplateRepository> = {
      findById: jest.fn()
    } as unknown as jest.Mocked<TemplateRepository>;
    const participantRepository: jest.Mocked<ParticipantRepository> = {
      listByAppointment: jest.fn()
    } as unknown as jest.Mocked<ParticipantRepository>;
    const availabilityRepository: jest.Mocked<AvailabilityRepository> = {
      listAvailability: jest.fn()
    } as unknown as jest.Mocked<AvailabilityRepository>;
    const templateCache: TemplateCache = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    };
    const metrics: jest.Mocked<AppointmentMetrics> = {
      incrementAppointmentsCreated: jest.fn(),
      recordHttpRequest: jest.fn(),
      observeAppointmentViewDuration: jest.fn(),
      updateTemplateCacheHitRatio: jest.fn(),
      observeParticipantJoin: jest.fn(),
      observeResponseSubmission: jest.fn(),
      getRegistry: jest.fn(),
      reset: jest.fn()
    } as unknown as jest.Mocked<AppointmentMetrics>;
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    } as any;

    return {
      appointmentRepository,
      templateRepository,
      participantRepository,
      availabilityRepository,
      templateCache,
      metrics,
      logger
    };
  };

  it('returns slot summaries and participants in sorted order', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment);
    deps.templateCache.get = jest.fn().mockReturnValue(null);
    deps.templateRepository.findById.mockResolvedValue(baseTemplate);
    deps.participantRepository.listByAppointment.mockResolvedValue([
      {
        id: 'p1',
        appointmentId: baseAppointment.id,
        nickname: 'Mina',
        submittedAt: new Date('2024-03-03T12:00:00Z'),
        pinHash: null
      },
      {
        id: 'p2',
        appointmentId: baseAppointment.id,
        nickname: 'Hoon',
        submittedAt: new Date('2024-03-02T12:00:00Z'),
        pinHash: null
      }
    ]);
    deps.availabilityRepository.listAvailability.mockResolvedValue([
      { participantId: 'p2', slotKey: '2024-03-06#LUNCH' },
      { participantId: 'p1', slotKey: '2024-03-05#DINNER' },
      { participantId: 'p2', slotKey: '2024-03-05#DINNER' }
    ]);

    const service = new ViewAppointmentService(
      deps.appointmentRepository,
      deps.templateRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateCache,
      deps.metrics,
      deps.logger
    );

    const result = await service.execute('apt-1', { requestId: 'req-1' });

    expect(result.appointment.id).toBe('apt-1');
    expect(result.template.rules).toHaveLength(2);
    expect(result.aggregates.slotSummaries).toEqual([
      {
        slotKey: '2024-03-05#DINNER',
        date: '2024-03-05',
        mealType: 'DINNER',
        availableCount: 2,
        availabilityRatio: 1
      },
      {
        slotKey: '2024-03-06#LUNCH',
        date: '2024-03-06',
        mealType: 'LUNCH',
        availableCount: 1,
        availabilityRatio: 0.5
      }
    ]);
    expect(result.participants[0].responses).toEqual(['2024-03-05#DINNER']);
    expect(result.participants[1].responses).toEqual(['2024-03-06#LUNCH', '2024-03-05#DINNER']);
    expect(deps.templateRepository.findById).toHaveBeenCalledTimes(1);
    expect(deps.templateCache.set).toHaveBeenCalledWith('tmpl-1', expect.any(Object));
    expect(deps.metrics.observeAppointmentViewDuration).toHaveBeenCalledWith(expect.any(Number), false);
  });

  it('returns zero ratios when there are no participants', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment);
    deps.templateCache.get = jest.fn().mockReturnValue(baseTemplate);
    deps.participantRepository.listByAppointment.mockResolvedValue([]);
    deps.availabilityRepository.listAvailability.mockResolvedValue([]);

    const service = new ViewAppointmentService(
      deps.appointmentRepository,
      deps.templateRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateCache,
      deps.metrics,
      deps.logger
    );

    const result = await service.execute('apt-1', {});

    expect(result.aggregates.participantCount).toBe(0);
    expect(result.aggregates.slotSummaries.every((slot) => slot.availabilityRatio === 0)).toBe(true);
    expect(deps.templateRepository.findById).not.toHaveBeenCalled();
    expect(deps.metrics.observeAppointmentViewDuration).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it('throws AppointmentNotFoundError when appointment is missing', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(null);

    const service = new ViewAppointmentService(
      deps.appointmentRepository,
      deps.templateRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateCache,
      deps.metrics,
      deps.logger
    );

    await expect(service.execute('missing', {})).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws TemplateUnavailableError when template is missing', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment);
    deps.templateCache.get = jest.fn().mockReturnValue(null);
    deps.templateRepository.findById.mockResolvedValue(null);

    const service = new ViewAppointmentService(
      deps.appointmentRepository,
      deps.templateRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateCache,
      deps.metrics,
      deps.logger
    );

    await expect(service.execute('apt-1', {})).rejects.toBeInstanceOf(TemplateUnavailableError);
  });

  it('throws TemplateEvaluationError when template parsing fails', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment);
    deps.templateCache.get = jest.fn().mockReturnValue(null);
    deps.templateRepository.findById.mockImplementation(() => {
      throw new TemplateParsingError();
    });

    const service = new ViewAppointmentService(
      deps.appointmentRepository,
      deps.templateRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateCache,
      deps.metrics,
      deps.logger
    );

    await expect(service.execute('apt-1', {})).rejects.toBeInstanceOf(TemplateEvaluationError);
  });
});
