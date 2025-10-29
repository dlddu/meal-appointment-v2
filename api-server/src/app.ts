import express from 'express';
import cors from 'cors';
import healthRouter from './presentation/health.router';
import pino from 'pino';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

app.use(cors());
app.use(express.json());
app.use('/api', healthRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err });
  res.status(500).json({ message: 'Internal Server Error' });
});

export default app;
