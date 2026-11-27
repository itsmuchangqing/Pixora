import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { sendFailure } from '../views/api-response.view.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const isHttpError = error instanceof HttpError;
  const statusCode = isHttpError ? error.statusCode : 500;

  if (!isHttpError || statusCode >= 500) {
    console.error('[API Error]', error);
  }

  const code = isHttpError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isHttpError
    ? error.message
    : env.isProduction
      ? 'The server encountered an error. Please try again.'
      : error instanceof Error
        ? error.message
        : 'Unknown error';

  sendFailure(res, statusCode, code, message);
};
