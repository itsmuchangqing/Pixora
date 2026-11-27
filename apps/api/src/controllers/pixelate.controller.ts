import type { RequestHandler } from 'express';
import {
  COLOR_PALETTES,
  PIXEL_PRESETS,
} from '../models/pixel-options.model.js';
import { requestPixelation } from '../services/pixelate.service.js';
import type { PixelateRequest } from '../services/pixelate.service.js';
import { sendSuccess } from '../views/api-response.view.js';

export const getPixelOptions: RequestHandler = (_req, res) => {
  sendSuccess(res, {
    presets: PIXEL_PRESETS,
    palettes: COLOR_PALETTES,
  });
};

export const createPixelation: RequestHandler = async (req, res, next) => {
  try {
    // Validate multipart fields here once the upload middleware exists.
    const input = (req.body ?? {}) as PixelateRequest;
    await requestPixelation(input);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
};
