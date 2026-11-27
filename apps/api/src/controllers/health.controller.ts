import type { RequestHandler } from 'express';
import { sendSuccess } from '../views/api-response.view.js';

export const getHealth: RequestHandler = (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'pixora-api',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
  });
};
