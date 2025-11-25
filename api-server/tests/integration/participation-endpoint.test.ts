import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import prisma from '../../src/infrastructure/prismaClient';

async function resetDatabase() {
  await prisma.query('TRUNCATE TABLE slot_availability, participants, appointments, time_slot_templates RESTART IDENTITY CASCADE;');
}

async function seedAppointment() {
  const templateId = 'tmpl-weekly';
  await prisma.query(
    `INSERT INTO time_slot_templates (id, name, description, ruleset_json) VALUES ($1, $2, $3, $4)` ,
    [templateId, 'Weekly', 'Weekday dinners', JSON.stringify([{ dayPattern: 'WEEKDAY', mealTypes: ['DINNER'] }])]
  );
  const appointmentId = '00000000-0000-4000-8000-000000000099';
  await prisma.query(
    `INSERT INTO appointments (id, title, summary, time_slot_template_id) VALUES ($1, $2, $3, $4)`,
    [appointmentId, 'Team Dinner', 'Plan meals', templateId]
  );
  return appointmentId;
}

async function insertParticipant(appointmentId: string, nickname: string, pin?: string) {
  const pinHash = pin ? await bcrypt.hash(pin, 4) : null;
  const result = await prisma.query(
    `INSERT INTO participants (appointment_id, nickname, pin_hash, submitted_at) VALUES ($1, $2, $3, NULL) RETURNING id`,
    [appointmentId, nickname, pinHash]
  );
  return result.rows[0].id as string;
}

describe('Participation endpoints', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    app.locals.metrics.reset();
  });

  it('creates a new participant session and stores hashed PIN', async () => {
    const appointmentId = await seedAppointment();

    const response = await request(app)
      .post(`/api/appointments/${appointmentId}/participants`)
      .send({ nickname: 'Mina', pin: '1234' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ nickname: 'Mina', hasPin: true, submittedAt: null, responses: [] });

    const dbRow = await prisma.query('SELECT pin_hash FROM participants WHERE id = $1', [response.body.participantId]);
    expect(dbRow.rows[0].pin_hash).toBeTruthy();
    expect(dbRow.rows[0].pin_hash).not.toBe('1234');
  });

  it('rejects invalid pins for existing participants', async () => {
    const appointmentId = await seedAppointment();
    await insertParticipant(appointmentId, 'Hoon', '5555');

    const response = await request(app)
      .post(`/api/appointments/${appointmentId}/participants`)
      .send({ nickname: 'Hoon', pin: '0000' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('INVALID_PIN');
  });

  it('submits availability and returns summary', async () => {
    const appointmentId = await seedAppointment();
    const participantId = await insertParticipant(appointmentId, 'Mina', '1234');

    const response = await request(app)
      .put(`/api/appointments/${appointmentId}/participants/${participantId}/responses`)
      .send({ nickname: 'Mina', pin: '1234', availableSlots: ['2024-05-06#DINNER'] });

    expect(response.status).toBe(200);
    expect(response.body.selected).toEqual(['2024-05-06#DINNER']);
    expect(response.body.summary.participantCount).toBe(1);

    const slots = await prisma.query('SELECT slot_key FROM slot_availability WHERE participant_id = $1', [participantId]);
    expect(slots.rows.map((row) => row.slot_key)).toEqual(['2024-05-06#DINNER']);
  });

  it('rejects slot submissions that fail validation', async () => {
    const appointmentId = await seedAppointment();
    const participantId = await insertParticipant(appointmentId, 'Mina');

    const response = await request(app)
      .put(`/api/appointments/${appointmentId}/participants/${participantId}/responses`)
      .send({ nickname: 'Mina', availableSlots: ['2024-05-07#BREAKFAST'] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SLOT');
  });

  it('returns mismatch error when nickname does not match participant', async () => {
    const appointmentId = await seedAppointment();
    const participantId = await insertParticipant(appointmentId, 'Mina');

    const response = await request(app)
      .put(`/api/appointments/${appointmentId}/participants/${participantId}/responses`)
      .send({ nickname: 'Other', availableSlots: [] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PARTICIPANT_MISMATCH');
  });
});
