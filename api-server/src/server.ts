import 'dotenv/config';
import app from './app';
import pino from 'pino';
import prisma from './infrastructure/prismaClient';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const port = Number(process.env.PORT ?? 4000);

async function start() {
  try {
    await prisma.$connect();
    app.listen(port, () => {
      logger.info({ port }, 'API server listening');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

void start();
