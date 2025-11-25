import bcrypt from 'bcryptjs';
import { JoinParticipantService } from '../../src/application/participants/joinParticipant.service';
import { SubmitResponsesService } from '../../src/application/participants/submitResponses.service';
import type { AppointmentRepository } from '../../src/infrastructure/appointments/appointmentRepository';
import type { ParticipantRepository } from '../../src/infrastructure/participants/participantRepository';
import type { AvailabilityRepository } from '../../src/infrastructure/availability/availabilityRepository';
import type { AppointmentMetrics } from '../../src/infrastructure/metrics/appointmentMetrics';
import type { TimeSlotTemplateService } from '../../src/application/participants/timeSlotTemplate.service';
import {
  AppointmentNotFoundApplicationError,
  InvalidPinApplicationError,
  InvalidSlotApplicationError,
  NicknameTakenApplicationError,
  ParticipantMismatchApplicationError
} from '../../src/application/errors';

const baseAppointment = {
  id: 'apt-1',
  title: 'Dinner',
  summary: '',
  timeSlotTemplateId: 'tmpl-1',
  createdAt: new Date(),
  updatedAt: new Date()
};

const createMetrics = (): jest.Mocked<AppointmentMetrics> => ({
  incrementAppointmentsCreated: jest.fn(),
  recordHttpRequest: jest.fn(),
  observeAppointmentViewDuration: jest.fn(),
  updateTemplateCacheHitRatio: jest.fn(),
  observeParticipantJoin: jest.fn(),
  observeResponseSubmission: jest.fn(),
  getRegistry: jest.fn(),
  reset: jest.fn()
});

const createLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });

const createDatabase = () => ({ $transaction: jest.fn(async (handler) => handler({})) });

describe('JoinParticipantService', () => {
  const createDependencies = () => {
    const appointmentRepository: jest.Mocked<AppointmentRepository> = {
      create: jest.fn(),
      findById: jest.fn()
    } as unknown as jest.Mocked<AppointmentRepository>;
    const participantRepository: jest.Mocked<ParticipantRepository> = {
      listByAppointment: jest.fn(),
      findByAppointmentAndNickname: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateSubmittedAt: jest.fn()
    } as unknown as jest.Mocked<ParticipantRepository>;
    const availabilityRepository: jest.Mocked<AvailabilityRepository> = {
      listAvailability: jest.fn(),
      listByParticipant: jest.fn(),
      replaceForParticipant: jest.fn()
    } as unknown as jest.Mocked<AvailabilityRepository>;

    return { appointmentRepository, participantRepository, availabilityRepository };
  };

  it('creates a new participant when none exists', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findByAppointmentAndNickname.mockResolvedValue(null);
    deps.participantRepository.create.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: 'hashed',
      submittedAt: null
    });
    deps.availabilityRepository.listByParticipant.mockResolvedValue([]);
    const metrics = createMetrics();
    const service = new JoinParticipantService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      metrics,
      createLogger() as any,
      createDatabase() as any
    );

    const result = await service.execute({ appointmentId: baseAppointment.id, nickname: 'Alice', pin: '1234' }, {});

    expect(result.participantId).toBe('p1');
    expect(deps.participantRepository.create).toHaveBeenCalled();
    expect(metrics.observeParticipantJoin).toHaveBeenCalled();
  });

  it('reuses an existing participant when PIN matches', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    const hashedPin = await bcrypt.hash('9999', 1);
    deps.participantRepository.findByAppointmentAndNickname.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: hashedPin,
      submittedAt: null
    });
    deps.availabilityRepository.listByParticipant.mockResolvedValue([{ participantId: 'p1', slotKey: '2024-05-06#DINNER' }]);

    const service = new JoinParticipantService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    const result = await service.execute({ appointmentId: baseAppointment.id, nickname: 'Alice', pin: '9999' }, {});
    expect(result.responses).toEqual(['2024-05-06#DINNER']);
    expect(result.hasPin).toBe(true);
  });

  it('throws when PIN does not match', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findByAppointmentAndNickname.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: await bcrypt.hash('1111', 1),
      submittedAt: null
    });

    const service = new JoinParticipantService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute({ appointmentId: baseAppointment.id, nickname: 'Alice', pin: '0000' }, {})
    ).rejects.toBeInstanceOf(InvalidPinApplicationError);
  });

  it('maps unique constraint errors to NicknameTakenApplicationError', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    const error: any = new Error('duplicate');
    error.code = '23505';
    deps.participantRepository.create.mockRejectedValue(error);
    deps.participantRepository.findByAppointmentAndNickname.mockResolvedValue(null);
    const service = new JoinParticipantService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute({ appointmentId: baseAppointment.id, nickname: 'Alice', pin: '2222' }, {})
    ).rejects.toBeInstanceOf(NicknameTakenApplicationError);
  });

  it('throws when appointment is missing', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(null as any);
    const service = new JoinParticipantService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute({ appointmentId: baseAppointment.id, nickname: 'Alice', pin: '2222' }, {})
    ).rejects.toBeInstanceOf(AppointmentNotFoundApplicationError);
  });
});

describe('SubmitResponsesService', () => {
  const createDependencies = () => {
    const appointmentRepository: jest.Mocked<AppointmentRepository> = {
      create: jest.fn(),
      findById: jest.fn()
    } as unknown as jest.Mocked<AppointmentRepository>;
    const participantRepository: jest.Mocked<ParticipantRepository> = {
      listByAppointment: jest.fn(),
      findByAppointmentAndNickname: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateSubmittedAt: jest.fn()
    } as unknown as jest.Mocked<ParticipantRepository>;
    const availabilityRepository: jest.Mocked<AvailabilityRepository> = {
      listAvailability: jest.fn(),
      listByParticipant: jest.fn(),
      replaceForParticipant: jest.fn()
    } as unknown as jest.Mocked<AvailabilityRepository>;
    const templateService: jest.Mocked<TimeSlotTemplateService> = {
      buildValidator: jest.fn()
    } as unknown as jest.Mocked<TimeSlotTemplateService>;

    return { appointmentRepository, participantRepository, availabilityRepository, templateService };
  };

  it('replaces responses and returns summary', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findById.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: null,
      submittedAt: null
    });
    deps.templateService.buildValidator.mockResolvedValue({ isValid: () => true } as any);
    deps.participantRepository.listByAppointment.mockResolvedValue([
      { id: 'p1', appointmentId: baseAppointment.id, nickname: 'Alice', pinHash: null, submittedAt: new Date() }
    ] as any);
    deps.availabilityRepository.listAvailability.mockResolvedValue([
      { participantId: 'p1', slotKey: '2024-05-06#DINNER' }
    ]);
    const metrics = createMetrics();
    const service = new SubmitResponsesService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateService,
      metrics,
      createLogger() as any,
      createDatabase() as any
    );

    const result = await service.execute(
      {
        appointmentId: baseAppointment.id,
        participantId: 'p1',
        nickname: 'Alice',
        availableSlots: ['2024-05-06#DINNER'],
        pin: undefined
      },
      { requestId: 'req-1' }
    );

    expect(deps.availabilityRepository.replaceForParticipant).toHaveBeenCalled();
    expect(deps.participantRepository.updateSubmittedAt).toHaveBeenCalled();
    expect(result.selected).toEqual(['2024-05-06#DINNER']);
    expect(result.summary.participantCount).toBe(1);
    expect(metrics.observeResponseSubmission).toHaveBeenCalled();
  });

  it('deduplicates slots before saving', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findById.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: null,
      submittedAt: null
    });
    deps.templateService.buildValidator.mockResolvedValue({ isValid: () => true } as any);
    deps.participantRepository.listByAppointment.mockResolvedValue([] as any);
    deps.availabilityRepository.listAvailability.mockResolvedValue([]);
    const service = new SubmitResponsesService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateService,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await service.execute(
      {
        appointmentId: baseAppointment.id,
        participantId: 'p1',
        nickname: 'Alice',
        availableSlots: ['2024-05-06#DINNER', '2024-05-06#DINNER'],
        pin: undefined
      },
      {}
    );

    const call = deps.availabilityRepository.replaceForParticipant.mock.calls[0];
    expect(call[2]).toEqual(['2024-05-06#DINNER']);
  });

  it('rejects mismatched participants', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findById.mockResolvedValue({
      id: 'p1',
      appointmentId: 'other',
      nickname: 'Alice',
      pinHash: null,
      submittedAt: null
    });
    const service = new SubmitResponsesService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateService,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute(
        { appointmentId: baseAppointment.id, participantId: 'p1', nickname: 'Bob', availableSlots: [], pin: undefined },
        {}
      )
    ).rejects.toBeInstanceOf(ParticipantMismatchApplicationError);
  });

  it('rejects invalid PINs', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findById.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: await bcrypt.hash('1111', 1),
      submittedAt: null
    });
    deps.templateService.buildValidator.mockResolvedValue({ isValid: () => true } as any);
    const service = new SubmitResponsesService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateService,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute(
        {
          appointmentId: baseAppointment.id,
          participantId: 'p1',
          nickname: 'Alice',
          availableSlots: [],
          pin: '0000'
        },
        {}
      )
    ).rejects.toBeInstanceOf(InvalidPinApplicationError);
  });

  it('rejects invalid slots from the template validator', async () => {
    const deps = createDependencies();
    deps.appointmentRepository.findById.mockResolvedValue(baseAppointment as any);
    deps.participantRepository.findById.mockResolvedValue({
      id: 'p1',
      appointmentId: baseAppointment.id,
      nickname: 'Alice',
      pinHash: null,
      submittedAt: null
    });
    deps.templateService.buildValidator.mockResolvedValue({ isValid: () => false } as any);
    const service = new SubmitResponsesService(
      deps.appointmentRepository,
      deps.participantRepository,
      deps.availabilityRepository,
      deps.templateService,
      createMetrics(),
      createLogger() as any,
      createDatabase() as any
    );

    await expect(
      service.execute(
        {
          appointmentId: baseAppointment.id,
          participantId: 'p1',
          nickname: 'Alice',
          availableSlots: ['2024-05-06#DINNER'],
          pin: undefined
        },
        {}
      )
    ).rejects.toBeInstanceOf(InvalidSlotApplicationError);
  });
});
