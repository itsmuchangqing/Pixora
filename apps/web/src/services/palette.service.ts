import type { PixelGrid } from '../models/pixel';

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/** 把 #rgb / #rrggbb 解析成 0–255 的 RGB，失败返回 null */
export function parseHexColor(value: string): RgbColor | null {
  const normalized = value.trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    return {
      red: Number.parseInt(normalized[0]! + normalized[0], 16),
      green: Number.parseInt(normalized[1]! + normalized[1], 16),
      blue: Number.parseInt(normalized[2]! + normalized[2], 16),
    };
  }

  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return {
      red: Number.parseInt(normalized.slice(0, 2), 16),
      green: Number.parseInt(normalized.slice(2, 4), 16),
      blue: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  return null;
}

export function rgbToHex({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * 把网格中某个颜色替换成另一个颜色。
 * alpha 保持不变，透明区域完全跳过。
 */
export function replaceGridColor(
  data: Uint8ClampedArray,
  fromHex: string,
  toHex: string,
): number {
  const from = parseHexColor(fromHex);
  const to = parseHexColor(toHex);
  if (!from || !to) return 0;

  let changed = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 1) continue;
    if (
      data[index] === from.red &&
      data[index + 1] === from.green &&
      data[index + 2] === from.blue
    ) {
      data[index] = to.red;
      data[index + 1] = to.green;
      data[index + 2] = to.blue;
      changed += 1;
    }
  }

  return changed;
}

/**
 * 把整张网格映射到用户导入的色板。
 * 锁定的源颜色不参与映射，这样可以用少量主色替换画面，
 * 同时保留手动锁住的描边色或品牌色。
 */
export function mapGridToPalette(
  data: Uint8ClampedArray,
  paletteHex: string[],
  lockedColors: ReadonlySet<string>,
): number {
  const palette = paletteHex
    .map(parseHexColor)
    .filter((color): color is RgbColor => Boolean(color));

  if (palette.length === 0) return 0;

  const cache = new Map<string, RgbColor>();
  let changed = 0;
  let mapped = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 1) continue;

    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const key = `${red},${green},${blue}`;
    if (lockedColors.has(rgbToHex({ red, green, blue }))) continue;

    let target = cache.get(key);
    if (!target) {
      target = nearestColor({ red, green, blue }, palette);
      cache.set(key, target);
    }

    if (
      target.red !== red ||
      target.green !== green ||
      target.blue !== blue
    ) {
      data[index] = target.red;
      data[index + 1] = target.green;
      data[index + 2] = target.blue;
      changed += 1;
    }
    mapped += 1;
  }

  return mapped > 0 ? changed : 0;
}

/**
 * 支持常见文本色板：
 * - Lospec .hex：每行一个 #rrggbb
 * - JASC-PAL / GPL：每行 255 0 0 这样的 RGB 三元组
 * - 普通 TXT：混用十六进制和 RGB 三元组
 */
export function parsePaletteText(text: string): string[] {
  const colors: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('//')) continue;

    const hexMatches = line.match(/#?[0-9a-f]{6}\b/gi) ?? [];
    for (const match of hexMatches) {
      const color = parseHexColor(match);
      if (!color) continue;
      const hex = rgbToHex(color);
      if (!seen.has(hex)) {
        seen.add(hex);
        colors.push(hex);
      }
    }

    const parts = line
      .split(/[\s,]+/)
      .map((part) => Number(part))
      .filter((value) => Number.isFinite(value));
    if (parts.length >= 3) {
      const [red, green, blue] = parts;
      if (
        red! >= 0 &&
        red! <= 255 &&
        green! >= 0 &&
        green! <= 255 &&
        blue! >= 0 &&
        blue! <= 255
      ) {
        const hex = rgbToHex({ red, green, blue });
        if (!seen.has(hex)) {
          seen.add(hex);
          colors.push(hex);
        }
      }
    }
  }

  return colors.slice(0, 256);
}

export function gridHasTransparency(grid: PixelGrid): boolean {
  for (let index = 3; index < grid.data.length; index += 4) {
    if (grid.data[index]! < 255) return true;
  }
  return false;
}

function nearestColor(
  source: RgbColor,
  palette: RgbColor[],
): RgbColor {
  let nearest = palette[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const color of palette) {
    // 红绿蓝亮度权重，比直接 RGB 欧氏距离更接近人眼判断。
    const redDelta = (source.red - color.red) * 0.299;
    const greenDelta = (source.green - color.green) * 0.587;
    const blueDelta = (source.blue - color.blue) * 0.114;
    const distance =
      redDelta * redDelta +
      greenDelta * greenDelta +
      blueDelta * blueDelta;

    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = color;
    }
  }

  return nearest;
}
