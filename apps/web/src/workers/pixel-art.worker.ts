import {
  processLowResolutionPixels,
  type PixelArtOptions,
} from '../services/pixel-art.service';

/**
 * 像素画计算 Worker。
 * ------------------------------------------------------------
 * 主线程只负责图片解码、边缘感知降采样和最终 PNG 编码；
 * Lab 聚类、区域填色、抖动、Selout 与轮廓计算都放到这里执行，
 * 避免调整参数时阻塞页面交互。
 */

interface WorkerRequest {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  options: PixelArtOptions;
}

interface WorkerResponse {
  pixels?: ArrayBuffer;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  const { pixels, width, height, options } = event.data;

  try {
    const output = processLowResolutionPixels({
      pixels: new Uint8ClampedArray(pixels),
      width,
      height,
      options,
    });
    const buffer = output.buffer as ArrayBuffer;

    workerScope.postMessage({ pixels: buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
