import { Router } from 'express';
import { healthService } from '../application/health/health.service';

const router = Router();

router.get('/health', async (_req, res, next) => {
  try {
    const result = await healthService.check();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
