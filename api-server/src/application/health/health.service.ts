import prisma from '../../infrastructure/prismaClient';

export class HealthService {
  async check() {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}

export const healthService = new HealthService();
