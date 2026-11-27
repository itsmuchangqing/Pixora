export type SourceTransform =
  | 'rotate-left'
  | 'rotate-right'
  | 'flip-horizontal'
  | 'flip-vertical';

export interface SourceSnapshot {
  blob: Blob;
  width: number;
  height: number;
  name: string;
}

export interface NormalizedCropRect {
  /** 全部使用 0–1 的相对坐标，和预览尺寸无关 */
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_SOURCE_SIDE = 6000;

/** 把本地 Blob 解码成图片元素；只在浏览器本地执行 */
export function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    image.src = url;
  });
}

export async function readImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const image = await loadBlobImage(blob);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

/**
 * 旋转或翻转当前源图。
 * 修改的是“送给像素化引擎的原图”，不会直接动生成后的像素。
 */
export async function transformSourceBlob(
  blob: Blob,
  transform: SourceTransform,
): Promise<SourceSnapshot> {
  const image = await loadBlobImage(blob);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const swapsAxes =
    transform === 'rotate-left' || transform === 'rotate-right';
  const width = swapsAxes ? sourceHeight : sourceWidth;
  const height = swapsAxes ? sourceWidth : sourceHeight;
  const bounded = boundDimensions(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = bounded.width;
  canvas.height = bounded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建图片编辑 Canvas');

  context.imageSmoothingEnabled = false;
  const scaleX = bounded.width / width;
  const scaleY = bounded.height / height;

  context.save();
  context.scale(scaleX, scaleY);
  switch (transform) {
    case 'rotate-left':
      context.translate(0, height);
      context.rotate(-Math.PI / 2);
      break;
    case 'rotate-right':
      context.translate(width, 0);
      context.rotate(Math.PI / 2);
      break;
    case 'flip-horizontal':
      context.translate(width, 0);
      context.scale(-1, 1);
      break;
    case 'flip-vertical':
      context.translate(0, height);
      context.scale(1, -1);
      break;
  }
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  context.restore();

  return {
    blob: await canvasToBlob(canvas, 'image/png'),
    width: canvas.width,
    height: canvas.height,
    name: '',
  };
}

/** 按 0–1 的相对区域裁剪源图 */
export async function cropSourceBlob(
  blob: Blob,
  rect: NormalizedCropRect,
): Promise<SourceSnapshot> {
  const image = await loadBlobImage(blob);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const crop = normalizeCropRect(rect);

  const sx = Math.round(crop.x * sourceWidth);
  const sy = Math.round(crop.y * sourceHeight);
  const sw = Math.max(
    1,
    Math.round(crop.width * sourceWidth),
  );
  const sh = Math.max(
    1,
    Math.round(crop.height * sourceHeight),
  );
  const bounded = boundDimensions(sw, sh);

  const canvas = document.createElement('canvas');
  canvas.width = bounded.width;
  canvas.height = bounded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建裁剪 Canvas');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sx,
    sy,
    Math.min(sw, sourceWidth - sx),
    Math.min(sh, sourceHeight - sy),
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return {
    blob: await canvasToBlob(canvas, 'image/png'),
    width: canvas.width,
    height: canvas.height,
    name: '',
  };
}

export function normalizeCropRect(
  rect: NormalizedCropRect,
): NormalizedCropRect {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const width = Math.max(0.01, Math.min(1 - x, rect.width));
  const height = Math.max(0.01, Math.min(1 - y, rect.height));
  return { x, y, width, height };
}

/** 从剪贴板事件里取出第一张图片 */
export function imageFileFromClipboard(
  event: ClipboardEvent,
): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) {
      const extension = file.type.split('/')[1] ?? 'png';
      return new File([file], `pasted-${Date.now()}.${extension}`, {
        type: file.type,
      });
    }
  }

  return null;
}

/** 主动读取系统剪贴板（需要浏览器授权） */
export async function readClipboardImage(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null;

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) =>
        type.startsWith('image/'),
      );
      if (!imageType) continue;

      const blob = await item.getType(imageType);
      const extension = imageType.split('/')[1] ?? 'png';
      return new File([blob], `pasted-${Date.now()}.${extension}`, {
        type: imageType,
      });
    }
  } catch {
    return null;
  }

  return null;
}

function boundDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    MAX_SOURCE_SIDE / Math.max(1, width, height),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片编码失败'));
    }, mimeType);
  });
}
