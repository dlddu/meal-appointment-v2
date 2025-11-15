import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/infrastructure/prismaClient';
import type { TemplateRule } from '../../src/infrastructure/templates/templateRepository';

const ROUTE = '/api/appointments';
const ROUTE_LABEL = 'GET /api/appointments/:appointmentId';

async function insertTemplate(templateId: string, rules: TemplateRule[]) {
  await prisma.query(
    `
      INSERT INTO time_slot_templates (id, name, description, ruleset_json)
      VALUES ($1, $2, $3, $4::jsonb)
    `,
    [templateId, 'Weekly template', 'desc', JSON.stringify(rules)]
  );
}

async function insertAppointment(appointmentId: string, templateId: string) {
  await prisma.query(
    `
      INSERT INTO appointments (id, title, summary, time_slot_template_id)
      VALUES ($1, $2, $3, $4)
    `,
    [appointmentId, 'Team dinner', 'Summary', templateId]
  );
}

async function insertParticipant(participantId: string, appointmentId: string, nickname: string, submittedAt: string) {
  await prisma.query(
    `
      INSERT INTO participants (id, appointment_id, nickname, submitted_at)
      VALUES ($1, $2, $3, $4::timestamptz)
    `,
    [participantId, appointmentId, nickname, submittedAt]
  );
}

async function insertAvailability(appointmentId: string, participantId: string, slotKey: string, submittedAt: string) {
  await prisma.query(
    `
      INSERT INTO slot_availability (appointment_id, participant_id, slot_key, submitted_at)
      VALUES ($1, $2, $3, $4::timestamptz)
    `,
    [appointmentId, participantId, slotKey, submittedAt]
  );
}

describe('GET /api/appointments/:appointmentId', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.query('TRUNCATE TABLE slot_availability RESTART IDENTITY CASCADE;');
    await prisma.query('TRUNCATE TABLE participants RESTART IDENTITY CASCADE;');
    await prisma.query('TRUNCATE TABLE appointments RESTART IDENTITY CASCADE;');
    await prisma.query('TRUNCATE TABLE time_slot_templates RESTART IDENTITY CASCADE;');
    app.locals.metrics.reset();
    app.locals.templateCache.clear();
  });

  it('returns appointment details with aggregates', async () => {
    const templateId = 'tmpl-weekly';
    const appointmentId = '00000000-0000-0000-0000-000000000001';

    await insertTemplate(templateId, [
      { dayPattern: '2024-03-05', mealTypes: ['DINNER'] },
      { dayPattern: '2024-03-06', mealTypes: ['BREAKFAST', 'DINNER'] }
    ]);
    await insertAppointment(appointmentId, templateId);
    await insertParticipant('00000000-0000-0000-0000-000000000010', appointmentId, 'Mina', '2024-03-02T09:00:00Z');
    await insertParticipant('00000000-0000-0000-0000-000000000011', appointmentId, 'Hoon', '2024-03-03T09:00:00Z');
    await insertAvailability(appointmentId, '00000000-0000-0000-0000-000000000010', '2024-03-05#DINNER', '2024-03-02T09:00:00Z');
    await insertAvailability(appointmentId, '00000000-0000-0000-0000-000000000011', '2024-03-05#DINNER', '2024-03-03T09:00:00Z');
    await insertAvailability(appointmentId, '00000000-0000-0000-0000-000000000011', '2024-03-06#BREAKFAST', '2024-03-03T09:00:00Z');

    const response = await request(app).get(`${ROUTE}/${appointmentId}`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['aggregates', 'appointment', 'participants', 'template']);
    expect(response.body.appointment.id).toBe(appointmentId);
    expect(response.body.template.rules).toHaveLength(2);
    expect(response.body.participants).toHaveLength(2);
    expect(response.body.participants[0].responses).toEqual(['2024-03-05#DINNER']);
    expect(response.body.participants[1].responses).toEqual(['2024-03-05#DINNER', '2024-03-06#BREAKFAST']);
    expect(response.body.aggregates.participantCount).toBe(2);
    expect(response.body.aggregates.slotSummaries).toEqual([
      {
        slotKey: '2024-03-05#DINNER',
        date: '2024-03-05',
        mealType: 'DINNER',
        availableCount: 2,
        availabilityRatio: 1
      },
      {
        slotKey: '2024-03-06#BREAKFAST',
        date: '2024-03-06',
        mealType: 'BREAKFAST',
        availableCount: 1,
        availabilityRatio: 0.5
      },
      {
        slotKey: '2024-03-06#DINNER',
        date: '2024-03-06',
        mealType: 'DINNER',
        availableCount: 0,
        availabilityRatio: 0
      }
    ]);

    const metrics = (await app.locals.metrics.getRegistry().getMetricsAsJSON()) as Array<{
      name: string;
      values?: Array<{ value: number; labels: Record<string, string> }>;
    }>;
    const httpCounter = metrics.find((metric) => metric.name === 'http_server_requests_total');
    expect(httpCounter?.values?.some((entry) => entry.labels.route === ROUTE_LABEL && entry.value === 1)).toBe(true);
  });

  it('returns 404 when appointment is missing', async () => {
    const response = await request(app).get(`${ROUTE}/11111111-1111-1111-1111-111111111111`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'APPOINTMENT_NOT_FOUND',
        message: '약속을 찾을 수 없습니다.'
      },
      requestId: undefined
    });
  });

  it('returns 503 when template is unavailable', async () => {
    const templateId = 'tmpl-missing';
    const appointmentId = '00000000-0000-0000-0000-000000000021';
    await insertTemplate('tmpl-other', []);
    await insertAppointment(appointmentId, templateId);

    const response = await request(app).get(`${ROUTE}/${appointmentId}`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('preserves request id headers on error responses', async () => {
    const response = await request(app)
      .get(`${ROUTE}/22222222-2222-2222-2222-222222222222`)
      .set('x-request-id', 'req-123');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.body.requestId).toBe('req-123');
  });

  it('tracks template cache hits across repeated requests', async () => {
    const templateId = 'tmpl-cache';
    const appointmentId = '00000000-0000-0000-0000-000000000031';

    await insertTemplate(templateId, [{ dayPattern: '2024-03-07', mealTypes: ['LUNCH'] }]);
    await insertAppointment(appointmentId, templateId);

    await request(app).get(`${ROUTE}/${appointmentId}`);
    await request(app).get(`${ROUTE}/${appointmentId}`);

    const metrics = (await app.locals.metrics.getRegistry().getMetricsAsJSON()) as Array<{
      name: string;
      values?: Array<{ value: number; labels: Record<string, string> }>;
    }>;
    const gauge = metrics.find((metric) => metric.name === 'template_cache_hit_ratio');
    expect(gauge?.values?.[0]?.value).toBeCloseTo(0.5, 1);
  });

  it('ignores Accept headers and returns JSON', async () => {
    const templateId = 'tmpl-accept';
    const appointmentId = '00000000-0000-0000-0000-000000000041';

    await insertTemplate(templateId, []);
    await insertAppointment(appointmentId, templateId);

    const response = await request(app).get(`${ROUTE}/${appointmentId}`).set('Accept', 'text/html');

    expect(response.type).toBe('application/json');
  });
});
