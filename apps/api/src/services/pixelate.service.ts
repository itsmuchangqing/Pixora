import { HttpError } from '../utils/http-error.js';

export interface PixelateRequest {
  pixelSize: number;
  preset: string;
  palette: string;
  format: 'png' | 'jpg' | 'webp';
}

/**
 * Optional server-side processing entry point.
 * The browser remains the default processing path; implement this when a
 * deployment needs uploads, batch processing or server-side history.
 */
export async function requestPixelation(
  _input: PixelateRequest,
): Promise<never> {
  throw new HttpError(
    501,
    'PIXELATE_NOT_IMPLEMENTED',
    'Server-side pixelation is not implemented. Processing currently happens in the browser.',
  );
}
