import { Router } from 'express';
import {
  createPixelation,
  getPixelOptions,
} from '../controllers/pixelate.controller.js';

export const pixelateRouter = Router();

pixelateRouter.get('/options', getPixelOptions);
pixelateRouter.post('/', createPixelation);
