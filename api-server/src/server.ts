import 'dotenv/config';
import app from './app';
import prisma from './infrastructure/prismaClient';
import { logger } from './infrastructure/logger';

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
