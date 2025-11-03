import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/infrastructure/prismaClient';

describe('POST /api/appointments', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.query('TRUNCATE TABLE appointments RESTART IDENTITY CASCADE;');
    app.locals.metrics.reset();
  });

  it('creates an appointment and returns 201 with payload', async () => {
    const response = await request(app).post('/api/appointments').send({
      title: 'Team Lunch',
      summary: 'Monthly sync',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(response.status).toBe(201);
    expect(response.body.shareUrl).toMatch(/^\/appointments\//);
    expect(response.body.summary).toBe('Monthly sync');
    expect(response.body.createdAt).toMatch(/Z$/);

    const dbResult = await prisma.query('SELECT * FROM appointments WHERE id = $1', [response.body.appointmentId]);
    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].summary).toBe('Monthly sync');
  });

  it('defaults summary to empty string when omitted', async () => {
    const response = await request(app).post('/api/appointments').send({
      title: 'Team Lunch',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(response.status).toBe(201);
    expect(response.body.summary).toBe('');

    const dbResult = await prisma.query('SELECT summary FROM appointments WHERE id = $1', [response.body.appointmentId]);
    expect(dbResult.rows[0].summary).toBe('');
  });

  it('rejects inactive template identifiers', async () => {
    const response = await request(app).post('/api/appointments').send({
      title: 'Team Lunch',
      summary: '',
      timeSlotTemplateId: 'unknown_template'
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'timeSlotTemplateId' })
      ])
    );
  });

  it('rejects titles longer than 60 characters', async () => {
    const response = await request(app).post('/api/appointments').send({
      title: 'a'.repeat(61),
      summary: '',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when the repository layer fails', async () => {
    const transactionSpy = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('database unavailable'));

    const response = await request(app).post('/api/appointments').send({
      title: 'Team Lunch',
      summary: '',
      timeSlotTemplateId: 'default_weekly'
    });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SERVICE_UNAVAILABLE');

    transactionSpy.mockRestore();
  });

  it('returns 500 for unexpected errors while preserving requestId', async () => {
    const spy = jest
      .spyOn(app.locals.createAppointmentService, 'execute')
      .mockRejectedValueOnce(new Error('unexpected'));

    const response = await request(app)
      .post('/api/appointments')
      .set('x-request-id', 'req-123')
      .send({
        title: 'Team Lunch',
        summary: '',
        timeSlotTemplateId: 'default_weekly'
      });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.requestId).toBe('req-123');

    spy.mockRestore();
  });

  it('increments Prometheus metrics on success', async () => {
    await request(app).post('/api/appointments').send({
      title: 'Team Lunch',
      summary: '',
      timeSlotTemplateId: 'default_weekly'
    });

    const metrics = (await app.locals.metrics.getRegistry().getMetricsAsJSON()) as Array<{
      name: string;
      values?: Array<{ value: number; labels: Record<string, string> }>;
    }>;
    const counter = metrics.find((metric) => metric.name === 'appointments_created_total');
    expect(counter?.values?.[0]?.value).toBe(1);
    expect(counter?.values?.[0]?.labels?.time_slot_template_id).toBe('default_weekly');
  });
});
