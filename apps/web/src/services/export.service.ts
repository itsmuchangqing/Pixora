import { zipSync } from 'fflate';
import type { PixelGrid } from '../models/pixel';

export interface NamedBlob {
  name: string;
  blob: Blob;
}

export interface SpriteSheetItem {
  name: string;
  grid: PixelGrid;
  width: number;
  height: number;
}

export interface SpriteSheetManifest {
  image: string;
  format: 'RGBA8888';
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  frames: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/** 文件名里去掉 Windows / macOS 不允许的字符 */
export function sanitizeFileName(value: string, fallback = 'image'): string {
  const cleaned = value
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || fallback;
}

/** 创建一个浏览器下载，不经过服务器 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/** 把多个文件打包成 ZIP；图片本身已压缩，因此对图片使用 store 模式 */
export async function createZip(
  files: NamedBlob[],
  extraEntries: Record<string, Uint8Array> = {},
): Promise<Blob> {
  const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    ...extraEntries,
  };

  for (const file of files) {
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    entries[file.name] = [bytes, { level: 0 }];
  }

  const zipped = zipSync(entries);
  const buffer = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/zip' });
}

/**
 * 生成简单精灵表：所有帧使用同一个单元格尺寸，按近似方形排列。
 * 像素画使用最近邻绘制，不会因为合成而变糊。
 */
export async function createSpriteSheet(
  items: SpriteSheetItem[],
  options: {
    flattenBackground: boolean;
    padding?: number;
    maxCellSide?: number;
  },
): Promise<{
  image: Blob;
  manifest: SpriteSheetManifest;
  width: number;
  height: number;
}> {
  if (items.length === 0) throw new Error('没有可合成的素材');

  const padding = Math.max(0, Math.round(options.padding ?? 4));
  const maxCellSide = Math.max(16, options.maxCellSide ?? 512);
  const longestSide = items.reduce(
    (longest, item) =>
      Math.max(longest, item.width, item.height),
    1,
  );
  const cellSide = Math.max(
    1,
    Math.min(maxCellSide, longestSide),
  );
  const columns = Math.min(
    8,
    Math.max(1, Math.ceil(Math.sqrt(items.length))),
  );
  const rows = Math.ceil(items.length / columns);
  const width = columns * cellSide + (columns + 1) * padding;
  const height = rows * cellSide + (rows + 1) * padding;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建精灵表 Canvas');

  if (options.flattenBackground) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = false;

  const manifest: SpriteSheetManifest = {
    image: 'spritesheet.png',
    format: 'RGBA8888',
    cellWidth: cellSide,
    cellHeight: cellSide,
    columns,
    rows,
    frames: [],
  };

  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = padding + column * (cellSide + padding);
    const cellY = padding + row * (cellSide + padding);
    const source = gridToCanvas(item.grid);
    const scale = Math.min(
      cellSide / source.width,
      cellSide / source.height,
    );
    const drawWidth = Math.max(1, Math.round(source.width * scale));
    const drawHeight = Math.max(1, Math.round(source.height * scale));
    const dx = cellX + Math.floor((cellSide - drawWidth) / 2);
    const dy = cellY + Math.floor((cellSide - drawHeight) / 2);

    context.drawImage(source, dx, dy, drawWidth, drawHeight);
    manifest.frames.push({
      name: item.name,
      x: dx,
      y: dy,
      width: drawWidth,
      height: drawHeight,
    });
  });

  return {
    image: await canvasToBlob(canvas, 'image/png'),
    manifest,
    width,
    height,
  };
}

/** 把低分辨率网格变成可以参与 Canvas 合成的元素 */
export function gridToCanvas(grid: PixelGrid): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = grid.width;
  canvas.height = grid.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建像素网格 Canvas');

  const imageData = context.createImageData(grid.width, grid.height);
  imageData.data.set(grid.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
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
