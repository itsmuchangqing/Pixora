import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

/** Create the Express app without binding a port, so tests can reuse it. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Pixora API',
        version: '1.0.0',
        health: '/api/health',
      },
    });
  });

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
