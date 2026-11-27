import type { Response } from 'express';
import type { ApiFailure, ApiSuccess } from '../types/api.js';

/** Single JSON response format for every API endpoint. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): void {
  const body: ApiSuccess<T> = {
    success: true,
    data,
  };

  res.status(statusCode).json(body);
}

export function sendFailure(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
): void {
  const body: ApiFailure = {
    success: false,
    error: { code, message },
  };

  res.status(statusCode).json(body);
}
