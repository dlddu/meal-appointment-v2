import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/infrastructure/prismaClient';

describe('GET /api/health', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('responds with ok status when database is reachable', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeTruthy();
  });
});
