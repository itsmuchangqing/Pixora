import type { PixelGrid } from '../models/pixel';

/** 复制一份像素网格，避免当前编辑和生成底图共享同一个 RGBA 缓冲区 */
export function clonePixelGrid(
  grid: PixelGrid | null | undefined,
): PixelGrid | null {
  if (!grid) return null;
  return {
    width: grid.width,
    height: grid.height,
    data: new Uint8ClampedArray(grid.data),
    palette: [...grid.palette],
  };
}
