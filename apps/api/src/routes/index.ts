import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { pixelateRouter } from './pixelate.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/pixelate', pixelateRouter);
