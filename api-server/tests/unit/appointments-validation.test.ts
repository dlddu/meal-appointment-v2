import { createAppointmentRequestSchema } from '../../src/presentation/appointments.router';
import { ActiveTemplateService } from '../../src/application/appointments/activeTemplateService';
import { ValidationApplicationError } from '../../src/application/errors';

describe('createAppointmentRequestSchema', () => {
  it('trims title and summary inputs', async () => {
    const result = createAppointmentRequestSchema.parse({
      title: '  Lunch Meeting  ',
      summary: '  Discuss launch  ',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(result.title).toBe('Lunch Meeting');
    expect(result.summary).toBe('Discuss launch');
  });

  it('fails when title is empty after trimming', () => {
    expect(() =>
      createAppointmentRequestSchema.parse({
        title: '   ',
        summary: 'Agenda',
        timeSlotTemplateId: 'default_weekly'
      })
    ).toThrow();
  });

  it('fails when title exceeds 60 characters', () => {
    const longTitle = 'a'.repeat(61);
    expect(() =>
      createAppointmentRequestSchema.parse({
        title: longTitle,
        summary: 'Agenda',
        timeSlotTemplateId: 'default_weekly'
      })
    ).toThrow();
  });

  it('defaults summary to empty string when omitted', () => {
    const result = createAppointmentRequestSchema.parse({
      title: 'Weekly sync',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(result.summary).toBe('');
  });

  it('fails when summary exceeds 200 characters', () => {
    const longSummary = 'a'.repeat(201);
    expect(() =>
      createAppointmentRequestSchema.parse({
        title: 'Weekly sync',
        summary: longSummary,
        timeSlotTemplateId: 'default_weekly'
      })
    ).toThrow();
  });

  it('coerces non-string values into strings', () => {
    const result = createAppointmentRequestSchema.parse({
      title: 123,
      summary: 456,
      timeSlotTemplateId: 789
    });

    expect(result.title).toBe('123');
    expect(result.summary).toBe('456');
    expect(result.timeSlotTemplateId).toBe('789');
  });
});

describe('ActiveTemplateService', () => {
  it('throws validation error when template is inactive', async () => {
    const service = new ActiveTemplateService({
      async loadActiveTemplateIds() {
        return ['default_weekly'];
      }
    });

    await expect(service.ensureTemplateIsActive('nonexistent')).rejects.toBeInstanceOf(ValidationApplicationError);
  });
});
