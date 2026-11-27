import type { RequestHandler } from 'express';
import { sendFailure } from '../views/api-response.view.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendFailure(
    res,
    404,
    'NOT_FOUND',
    `Route not found: ${req.method} ${req.originalUrl}`,
  );
};
