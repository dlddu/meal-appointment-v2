import {
  joinParticipantRequestSchema,
  submitResponsesRequestSchema
} from '../../src/presentation/participation.router';

describe('participation request validation', () => {
  it('trims nickname values', () => {
    const result = joinParticipantRequestSchema.parse({ nickname: ' Alice ', pin: '1234' });
    expect(result.nickname).toBe('Alice');
  });

  it('rejects empty nicknames', () => {
    const result = joinParticipantRequestSchema.safeParse({ nickname: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects nicknames longer than 30 characters', () => {
    const result = joinParticipantRequestSchema.safeParse({ nickname: 'a'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('allows missing pin values', () => {
    const result = joinParticipantRequestSchema.parse({ nickname: 'Bob' });
    expect(result.pin).toBeUndefined();
  });

  it('rejects short pins', () => {
    const result = joinParticipantRequestSchema.safeParse({ nickname: 'Bob', pin: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects long pins', () => {
    const result = joinParticipantRequestSchema.safeParse({ nickname: 'Bob', pin: '1'.repeat(13) });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate slot keys', () => {
    const result = submitResponsesRequestSchema.safeParse({
      nickname: 'Bob',
      availableSlots: ['2024-05-06#DINNER', '2024-05-06#DINNER']
    });
    expect(result.success).toBe(false);
  });

  it('rejects slot keys with invalid format', () => {
    const result = submitResponsesRequestSchema.safeParse({
      nickname: 'Bob',
      availableSlots: ['20240506#DINNER']
    });
    expect(result.success).toBe(false);
  });

  it('passes valid payloads through', () => {
    const result = submitResponsesRequestSchema.parse({
      nickname: 'Carol',
      pin: '1234',
      availableSlots: ['2024-05-06#DINNER', '2024-05-07#LUNCH']
    });
    expect(result.availableSlots).toEqual(['2024-05-06#DINNER', '2024-05-07#LUNCH']);
  });
});
