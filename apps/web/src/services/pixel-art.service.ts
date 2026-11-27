import type {
  ExportFormat,
  OutlineMode,
  PixelGrid,
  PixelSettings,
  PresetId,
  StudioMode,
} from '../models/pixel';

export type { PixelGrid } from '../models/pixel';

/**
 * 浏览器本地像素画生成服务
 * ------------------------------------------------------------
 * 处理流程：
 * 1. 边缘感知降采样：平坦区域取平均色，边缘区块取主导色，避免把物体和背景混在一起；
 * 2. 双边滤波：压掉区域内部噪点，同时保留明暗边界；
 * 3. Lab 聚类：把画面收敛到有限色板；
 * 4. 区域平均填色：每个连通区域用自身平均颜色，再匹配到色板；
 * 5. 可选有序抖动：在有限颜色下模拟渐变；
 * 6. 轮廓描边：透明素材 alpha 外轮廓 + 高对比区域边界；
 * 7. 最近邻放大 / 目标分辨率输出。
 *
 * 当前在浏览器本地执行，不上传原图。后端接口仍保留给未来的
 * 服务端批处理、素材库和 GPU 处理。
 */

export type PixelArtOptions = PixelSettings & {
  mode: StudioMode;
  /** 角色类素材自动启用面部细节保护 */
  characterMode: boolean;
  /** 武器使用固定轮廓蒙版，避免高光影响形状 */
  weaponMode: boolean;
};

export interface PixelArtResult {
  /** 低分辨率像素网格，后续预览、手绘修正和多尺寸导出都以它为准 */
  grid: PixelGrid;
  /** 当前设置下默认导出的尺寸，尚未乘以导出倍率 */
  outputWidth: number;
  outputHeight: number;
}

export interface RenderGridOptions {
  /** 下载格式 */
  format: ExportFormat;
  /** 素材模式白底输出时为 true；透明输出时传 false */
  flattenBackground: boolean;
  /** 在默认输出尺寸上继续做最近邻放大 */
  scale?: 1 | 2 | 4;
}

export interface RenderedGrid {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_RENDER_SIDE = 4096;

type Rgb = [number, number, number];

interface LabColor {
  l: number;
  a: number;
  b: number;
}

interface PresetProfile {
  /** 该预设允许的最大色数 */
  colorCap: number;
  /** 低分辨率图上的双边滤波半径 */
  smoothingRadius: number;
  /** 色彩差异权重：越大越保留细节，越小越平滑 */
  colorSigma: number;
  /** 对比度，帮助明暗面更清楚 */
  contrast: number;
  /** 区域之间达到多少 RGB 差异才画内部轮廓线 */
  boundaryThreshold: number;
  /** 开启抖动时的强度（0～1） */
  ditherStrength: number;
  /** 是否绘制内部颜色边界；马赛克预设保留纯区块效果 */
  internalOutlines: boolean;
}

const PRESET_PROFILES: Record<PresetId, PresetProfile> = {
  classic: {
    colorCap: 64,
    smoothingRadius: 2,
    colorSigma: 28,
    contrast: 1.06,
    boundaryThreshold: 95,
    ditherStrength: 0.7,
    internalOutlines: true,
  },
  mosaic: {
    colorCap: 32,
    smoothingRadius: 2,
    colorSigma: 34,
    contrast: 1,
    boundaryThreshold: 112,
    ditherStrength: 0.35,
    internalOutlines: false,
  },
  poster: {
    colorCap: 8,
    smoothingRadius: 1,
    colorSigma: 36,
    contrast: 1.18,
    boundaryThreshold: 80,
    ditherStrength: 0.5,
    internalOutlines: true,
  },
  soft: {
    colorCap: 64,
    smoothingRadius: 2,
    colorSigma: 22,
    contrast: 0.96,
    boundaryThreshold: 132,
    ditherStrength: 0.85,
    internalOutlines: true,
  },
  mono: {
    colorCap: 64,
    smoothingRadius: 1,
    colorSigma: 28,
    contrast: 1.04,
    boundaryThreshold: 100,
    ditherStrength: 0.6,
    internalOutlines: true,
  },
};

/** 单色氛围：带紫色倾向的灰阶 */
const MONO_RAMP = [
  '#151019',
  '#29222e',
  '#453b4c',
  '#655970',
  '#8a7f95',
  '#b4abbc',
  '#dcd6e1',
  '#f7f3fa',
] as const;

/** 标准描边固定使用一个近黑色，避免高色数时混出灰边 */
const STANDARD_OUTLINE_COLOR: Rgb = [20, 13, 28];

const OUTPUT_MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const NEIGHBOR_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
] as const;

/** 4×4 Bayer 有序抖动矩阵：结构稳定，不会像随机抖动一样产生噪点 */
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

const MAX_ANALYSIS_SIDE = 1600;
const MIN_PROCESSING_SOURCE_SIDE = 512;
const MAX_GRID_SIDE = 320;
const MAX_OUTPUT_SIDE = 4096;
const PREVIEW_MIN_LONG_SIDE = 768;
const PREVIEW_MAX_LONG_SIDE = 1024;
const ALPHA_THRESHOLD = 112;
const MIN_REGION_SIZE = 3;

/** 宏像素细节开启后，边缘宏块拆成 2×2 微像素 */
const MACRO_DETAIL_SCALE = 2;
/** 宏块内部颜色差达到此值时，即使不在大边界上也保留细节 */
const MACRO_DETAIL_INTERNAL_THRESHOLD = 96;
/** 相邻宏块平均色差达到此值时，沿结构性边界保留细节 */
const MACRO_DETAIL_EDGE_THRESHOLD = 42;

/** 角色素材在颗粒模式下至少保留的宏观网格长边 */
const MIN_CHARACTER_MACRO_SIDE = 64;
/** 武器素材的最小宏观网格，避免细剑刃在过大的颗粒下消失 */
const MIN_WEAPON_MACRO_SIDE = 64;
/** 素材模式纯色背景替换的容差 */
const ASSET_BACKGROUND_TOLERANCE = 48;
/** 武器固定轮廓蒙版的分析分辨率（长边） */
const WEAPON_MASK_SIDE = 640;
const WEAPON_MASK_CACHE_LIMIT = 6;
/** 同一张原图的武器轮廓只提取一次，参数变化时复用 */
const weaponMaskCache = new Map<string, HTMLCanvasElement>();

interface CanvasLayout {
  /** 实际参与算法处理的像素网格（开启宏细节时为细网格） */
  gridWidth: number;
  gridHeight: number;
  /** 宏观像素块网格 */
  macroWidth: number;
  macroHeight: number;
  outputWidth: number;
  outputHeight: number;
  previewWidth: number;
  previewHeight: number;
}

interface ColorField {
  labels: Int16Array;
  paletteRgb: Rgb[];
  paletteLab: LabColor[];
}

export interface PixelArtEngineInput {
  /** 已经完成边缘感知降采样的低分辨率 RGBA 像素 */
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  options: PixelArtOptions;
}

/**
 * 纯计算像素画引擎。
 * 不依赖 DOM / Canvas，因此既能被 Web Worker 导入，也可以在
 * 不支持 Worker 的环境中回退到主线程同步执行。
 */
export function processLowResolutionPixels({
  pixels,
  width,
  height,
  options,
}: PixelArtEngineInput): Uint8ClampedArray {
  const profile = PRESET_PROFILES[options.preset];
  const alphaMask = createAlphaMask(pixels);
  const hasTransparency = alphaMask.some((alpha) => alpha === 0);

  const smoothed = bilateralFilter(
    pixels,
    alphaMask,
    width,
    height,
    profile.smoothingRadius,
    profile.colorSigma,
  );
  applyContrast(smoothed, alphaMask, profile.contrast);
  const labs = createLabField(smoothed, alphaMask);

  // 最多颜色数由用户控制，并被当前预设的上限约束。
  const effectiveColorCount = Math.min(
    options.colorCount,
    profile.colorCap,
  );

  // 标准描边本身占 1 个颜色，因此色板预留 1 个名额；
  // 关闭轮廓时颜色全部留给画面；Selout 从现有色板取暗部颜色。
  const standardOutline = options.outlineMode === 'standard';
  const paletteColorCount = Math.max(
    2,
    effectiveColorCount - (standardOutline ? 1 : 0),
  );
  const colorField = quantizeAdaptiveColors(
    labs,
    alphaMask,
    width,
    height,
    paletteColorCount,
  );

  const paletteRgb =
    options.preset === 'mono'
      ? buildRampPalette(MONO_RAMP, paletteColorCount)
      : colorField.paletteRgb;
  const paletteLab = paletteRgb.map((color) =>
    rgbToLab(color[0], color[1], color[2]),
  );

  let artPixels: Uint8ClampedArray;

  if (options.dither) {
    const ditherTarget = blurLabField(
      labs,
      alphaMask,
      width,
      height,
      1,
    );
    artPixels = renderOrderedDither(
      ditherTarget,
      alphaMask,
      width,
      height,
      paletteRgb,
      paletteLab,
      profile.ditherStrength,
    );
  } else if (options.macroDetail || options.characterMode) {
    // 宏像素细节保留每个微像素的差异，不做区域平均，
    // 但仍把颜色限制在当前有限色板内。
    artPixels = renderPalettePixels(
      labs,
      alphaMask,
      width,
      height,
      paletteRgb,
      paletteLab,
    );
  } else {
    const mergedLabels = mergeSmallRegions(
      colorField.labels,
      alphaMask,
      width,
      height,
      MIN_REGION_SIZE,
    );
    artPixels = renderQuantizedRegionColors(
      mergedLabels,
      labs,
      alphaMask,
      width,
      height,
      paletteRgb,
      paletteLab,
    );
  }

  if (options.outlineMode !== 'none') {
    applyPixelArtOutlines(
      artPixels,
      alphaMask,
      hasTransparency,
      width,
      height,
      profile,
      STANDARD_OUTLINE_COLOR,
      paletteRgb,
      options.outlineMode,
      options.weaponMode,
    );
  }

  return artPixels;
}

/**
 * 生成像素画。
 * 这是 Service 层唯一的公开入口。
 */
export async function generatePixelArt(
  sourceUrl: string,
  options: PixelArtOptions,
  signal?: AbortSignal,
): Promise<PixelArtResult> {
  throwIfAborted(signal);

  const source = await loadImage(sourceUrl);
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const layout = getLayout(sourceWidth, sourceHeight, options);

  // 小尺寸素材先放大分析图，避免输入只有几十像素时
  // 降采样后几乎没有可用的边缘与颜色信息。
  const prepared = prepareProcessingSource(
    source,
    sourceWidth,
    sourceHeight,
  );

  // P0：边缘感知降采样，避免平均色把物体边界和背景混成脏色。
  // 降采样需要 Canvas，因此留在主线程；后面的高开销计算交给 Worker。
  let lowPixels = downsampleEdgeAware(
    prepared.source,
    prepared.width,
    prepared.height,
    layout.gridWidth,
    layout.gridHeight,
  );

  // 宏像素细节：只有边缘宏块保留 2×2 微像素，平坦块压回大色块。
  // 角色素材自动启用，避免大颗粒下五官被压成一团。
  if (options.macroDetail || options.characterMode) {
    lowPixels = applyAdaptiveMacroDetail(
      lowPixels,
      layout.gridWidth,
      layout.gridHeight,
      layout.macroWidth,
      layout.macroHeight,
      options.characterMode,
    );
  }

  // 素材模式：把纯色背景剔除，最终统一铺成白色背景。
  if (options.mode === 'asset') {
    // 武器先按固定分析分辨率提取轮廓，再把同一张蒙版应用到当前颗粒网格。
    // 这样高光面积再大，也不会让武器外形随颗粒值漂移。
    lowPixels = options.weaponMode
      ? applyWeaponSilhouetteMask(
          lowPixels,
          layout.gridWidth,
          layout.gridHeight,
          prepared.source,
          prepared.width,
          prepared.height,
          sourceUrl,
        )
      : removeSolidAssetBackground(
          lowPixels,
          layout.gridWidth,
          layout.gridHeight,
          true,
        );
  }
  throwIfAborted(signal);

  const artPixels = await processPixelsOffMainThread(
    lowPixels,
    layout.gridWidth,
    layout.gridHeight,
    options,
    signal,
  );
  throwIfAborted(signal);

  return {
    grid: {
      width: layout.gridWidth,
      height: layout.gridHeight,
      data: artPixels,
      palette: extractPalette(artPixels),
    },
    outputWidth: layout.outputWidth,
    outputHeight: layout.outputHeight,
  };
}

/**
 * 从 RGBA 网格中提取实际使用的颜色。
 * 透明像素不进入色板；颜色按出现次数从多到少排序，
 * 这样界面里最先出现的就是画面主色。
 */
export function extractPalette(
  data: Uint8ClampedArray,
): string[] {
  const counts = new Map<string, number>();

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < ALPHA_THRESHOLD) continue;
    const key = `${data[index]},${data[index + 1]},${data[index + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([key]) => {
      const [red, green, blue] = key.split(',').map(Number);
      return rgbToHex(red ?? 0, green ?? 0, blue ?? 0);
    });
}

/**
 * 把低分辨率网格按默认输出尺寸渲染成可下载文件。
 * 与生成阶段分开后，调色板修改、手工修像素、导出倍率
 * 都不需要重新跑一遍聚类。
 */
export async function renderGridBlob(
  grid: PixelGrid,
  outputWidth: number,
  outputHeight: number,
  options: RenderGridOptions,
): Promise<RenderedGrid> {
  const requestedScale = options.scale ?? 1;
  const scale = Math.min(
    requestedScale,
    MAX_RENDER_SIDE / Math.max(1, outputWidth, outputHeight),
  );
  const width = clampRenderSide(outputWidth * scale, outputWidth);
  const height = clampRenderSide(outputHeight * scale, outputHeight);
  const canvas = renderGridCanvas(
    grid,
    width,
    height,
    options.flattenBackground,
  );
  const blob = await canvasToBlob(
    canvas,
    OUTPUT_MIME_TYPES[options.format],
    options.format === 'png' ? undefined : 0.92,
  );

  return { blob, width: canvas.width, height: canvas.height };
}

/**
 * 按长边目标尺寸渲染，用于“32 / 64 / 128 / 256 / 512”多尺寸导出。
 * 只做最近邻缩放，不重新量化，因此与当前预览的颜色完全一致。
 */
export async function renderGridAtLongSide(
  grid: PixelGrid,
  longSide: number,
  options: Omit<RenderGridOptions, 'scale'>,
): Promise<RenderedGrid> {
  const target = scaleToLongSide(
    grid.width,
    grid.height,
    Math.max(1, Math.min(MAX_RENDER_SIDE, Math.round(longSide))),
  );
  const canvas = renderGridCanvas(
    grid,
    target.width,
    target.height,
    options.flattenBackground,
  );
  const blob = await canvasToBlob(
    canvas,
    OUTPUT_MIME_TYPES[options.format],
    options.format === 'png' ? undefined : 0.92,
  );

  return { blob, width: canvas.width, height: canvas.height };
}

/** 项目列表、批量队列使用的小缩略图 */
export async function renderGridThumbnail(
  grid: PixelGrid,
  longSide = 360,
): Promise<Blob> {
  const target = scaleToLongSide(grid.width, grid.height, longSide);
  const canvas = renderGridCanvas(
    grid,
    target.width,
    target.height,
    false,
  );
  return canvasToBlob(canvas, 'image/png');
}

function clampRenderSide(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return Math.max(1, fallback);
  return Math.max(1, Math.min(MAX_RENDER_SIDE, Math.round(value)));
}

/** 计算带导出倍率的实际文件尺寸，供界面摘要显示 */
export function getExportDimensions(
  outputWidth: number,
  outputHeight: number,
  scale: 1 | 2 | 4,
): { width: number; height: number } {
  const effectiveScale = Math.min(
    scale,
    MAX_RENDER_SIDE / Math.max(1, outputWidth, outputHeight),
  );
  return {
    width: clampRenderSide(outputWidth * effectiveScale, outputWidth),
    height: clampRenderSide(outputHeight * effectiveScale, outputHeight),
  };
}

function renderGridCanvas(
  grid: PixelGrid,
  width: number,
  height: number,
  flattenBackground: boolean,
): HTMLCanvasElement {
  const lowCanvas = document.createElement('canvas');
  lowCanvas.width = grid.width;
  lowCanvas.height = grid.height;
  const lowContext = lowCanvas.getContext('2d');
  if (!lowContext) throw new Error('浏览器无法创建 Canvas 上下文');

  const lowData = lowContext.createImageData(grid.width, grid.height);
  lowData.data.set(grid.data);
  lowContext.putImageData(lowData, 0, 0);

  return renderCanvas(lowCanvas, width, height, flattenBackground);
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * 让高开销的 Lab 聚类、区域填色、抖动和描边离开主线程。
 * Worker 不可用或创建失败时回退到当前线程，功能不受影响。
 */
function processPixelsOffMainThread(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: PixelArtOptions,
  signal?: AbortSignal,
): Promise<Uint8ClampedArray> {
  throwIfAborted(signal);

  const runOnMainThread = () => {
    throwIfAborted(signal);
    return processLowResolutionPixels({
      pixels,
      width,
      height,
      options,
    });
  };

  if (typeof Worker === 'undefined') {
    return Promise.resolve().then(runOnMainThread);
  }

  return new Promise((resolve, reject) => {
    let worker: Worker;

    try {
      worker = new Worker(
        new URL('../workers/pixel-art.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch {
      try {
        resolve(runOnMainThread());
      } catch (error) {
        reject(error);
      }
      return;
    }

    const transferablePixels = pixels.slice();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };

    const handleAbort = () => {
      finish(() => reject(createAbortError()));
    };

    worker.onmessage = (
      event: MessageEvent<
        { pixels?: ArrayBuffer; error?: string }
      >,
    ) => {
      if (event.data.error) {
        finish(() => {
          try {
            resolve(runOnMainThread());
          } catch (error) {
            reject(error);
          }
        });
        return;
      }

      if (!event.data.pixels) {
        finish(() => reject(new Error('Worker 没有返回像素数据')));
        return;
      }

      finish(() => {
        resolve(new Uint8ClampedArray(event.data.pixels!));
      });
    };

    worker.onerror = () => {
      finish(() => {
        try {
          resolve(runOnMainThread());
        } catch (error) {
          reject(error);
        }
      });
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
    worker.postMessage(
      {
        pixels: transferablePixels.buffer,
        width,
        height,
        options,
      },
      [transferablePixels.buffer],
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError(): DOMException {
  return new DOMException('像素画生成已取消', 'AbortError');
}

/** 读取图片，兼容 blob URL、同源静态图和已经缓存的图片 */
async function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = sourceUrl;

  if (typeof image.decode === 'function') {
    try {
      await image.decode();
      return image;
    } catch {
      // 某些浏览器对已解码的 blob URL 会直接抛错，继续用事件兜底。
    }
  }

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('图片解码失败'));
  });

  return image;
}

/** 计算处理网格、下载尺寸和预览尺寸 */
function getLayout(
  sourceWidth: number,
  sourceHeight: number,
  options: PixelArtOptions,
): CanvasLayout {
  const detailEnabled = options.macroDetail || options.characterMode;
  const detailScale = detailEnabled ? MACRO_DETAIL_SCALE : 1;
  let macroWidth: number;
  let macroHeight: number;
  let gridWidth: number;
  let gridHeight: number;
  let outputWidth: number;
  let outputHeight: number;

  if (options.sizingMode === 'resolution') {
    // 目标分辨率表示最终文件尺寸；开启宏细节时，宏观块变为最终网格的一半。
    const target = scaleToLongSide(
      sourceWidth,
      sourceHeight,
      options.targetResolution,
    );

    if (detailEnabled) {
      outputWidth = makeEven(target.width);
      outputHeight = makeEven(target.height);
      macroWidth = Math.max(1, outputWidth / MACRO_DETAIL_SCALE);
      macroHeight = Math.max(1, outputHeight / MACRO_DETAIL_SCALE);
      gridWidth = outputWidth;
      gridHeight = outputHeight;
    } else {
      macroWidth = target.width;
      macroHeight = target.height;
      gridWidth = target.width;
      gridHeight = target.height;
      outputWidth = target.width;
      outputHeight = target.height;
    }
  } else {
    // 颗粒模式：颗粒越大，宏观像素块越大；宏细节再拆出 2×2 微像素。
    macroWidth = Math.max(
      1,
      Math.round(sourceWidth / Math.max(1, options.pixelSize)),
    );
    macroHeight = Math.max(
      1,
      Math.round(sourceHeight / Math.max(1, options.pixelSize)),
    );

    const gridScale = Math.min(
      1,
      MAX_GRID_SIDE / Math.max(macroWidth, macroHeight),
    );
    macroWidth = Math.max(1, Math.round(macroWidth * gridScale));
    macroHeight = Math.max(1, Math.round(macroHeight * gridScale));

    // 角色素材防止被过大的颗粒压成一团：
    // 宏观网格至少保留 64 像素长边，再用 2× 细节保护五官。
    // 武器同样限制最小网格，避免细剑刃在粗颗粒下直接消失。
    const protectedSide = options.characterMode
      ? MIN_CHARACTER_MACRO_SIDE
      : options.weaponMode
        ? MIN_WEAPON_MACRO_SIDE
        : 0;

    if (protectedSide > 0) {
      const longSide = Math.max(macroWidth, macroHeight);
      if (longSide < protectedSide) {
        const protectionScale = protectedSide / longSide;
        macroWidth = Math.max(
          1,
          Math.round(macroWidth * protectionScale),
        );
        macroHeight = Math.max(
          1,
          Math.round(macroHeight * protectionScale),
        );
      }
    }

    gridWidth = macroWidth * detailScale;
    gridHeight = macroHeight * detailScale;

    const outputScale = Math.min(
      1,
      MAX_OUTPUT_SIDE / Math.max(sourceWidth, sourceHeight),
    );
    outputWidth = Math.max(1, Math.round(sourceWidth * outputScale));
    outputHeight = Math.max(1, Math.round(sourceHeight * outputScale));
  }

  const previewLongSide =
    options.sizingMode === 'resolution'
      ? PREVIEW_MIN_LONG_SIDE
      : Math.min(
          PREVIEW_MAX_LONG_SIDE,
          Math.max(
            PREVIEW_MIN_LONG_SIDE,
            Math.max(outputWidth, outputHeight),
          ),
        );
  const preview = scaleToLongSide(
    gridWidth,
    gridHeight,
    previewLongSide,
  );

  return {
    gridWidth,
    gridHeight,
    macroWidth,
    macroHeight,
    outputWidth,
    outputHeight,
    previewWidth: preview.width,
    previewHeight: preview.height,
  };
}

/** 目标分辨率开启宏细节时，将尺寸对齐到偶数，保证 2×2 网格完整 */
function makeEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/** 按长边等比缩放，用于目标分辨率和预览图 */
function scaleToLongSide(
  width: number,
  height: number,
  longSide: number,
): { width: number; height: number } {
  const scale = longSide / Math.max(1, width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 小图在进入算法前先放大到至少 512px 长边。
 * 这不能凭空产生新细节，但能让降采样、边缘检测和背景识别
 * 有足够的像素参与计算。
 */
function prepareProcessingSource(
  source: HTMLImageElement,
  width: number,
  height: number,
): {
  source: CanvasImageSource;
  width: number;
  height: number;
  upscaled: boolean;
} {
  const longSide = Math.max(width, height);
  if (longSide >= MIN_PROCESSING_SOURCE_SIDE) {
    return { source, width, height, upscaled: false };
  }

  const scale = MIN_PROCESSING_SOURCE_SIDE / Math.max(1, longSide);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建小图放大 Canvas');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  return {
    source: canvas,
    width: targetWidth,
    height: targetHeight,
    upscaled: true,
  };
}

/**
 * P0：边缘感知降采样。
 * 每个低分辨率单元格先采样原始图的一小块区域：
 * - 平坦区域：使用区域平均色；
 * - 检测到边缘：使用该区域出现最多的主导色，避免前景和背景混合。
 */
function downsampleEdgeAware(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  gridWidth: number,
  gridHeight: number,
): Uint8ClampedArray {
  const naturalWidth = sourceWidth;
  const naturalHeight = sourceHeight;
  const analysisScale = Math.min(
    1,
    MAX_ANALYSIS_SIDE / Math.max(naturalWidth, naturalHeight),
  );
  const analysisWidth = Math.max(
    1,
    Math.round(naturalWidth * analysisScale),
  );
  const analysisHeight = Math.max(
    1,
    Math.round(naturalHeight * analysisScale),
  );

  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = analysisWidth;
  analysisCanvas.height = analysisHeight;
  const analysisContext = analysisCanvas.getContext('2d', {
    willReadFrequently: true,
  });
  if (!analysisContext) throw new Error('浏览器无法创建分析 Canvas');

  analysisContext.imageSmoothingEnabled = true;
  analysisContext.imageSmoothingQuality = 'high';
  analysisContext.drawImage(
    source,
    0,
    0,
    analysisWidth,
    analysisHeight,
  );
  const sourceData = analysisContext.getImageData(
    0,
    0,
    analysisWidth,
    analysisHeight,
  ).data;

  const output = new Uint8ClampedArray(gridWidth * gridHeight * 4);
  const binCounts = new Uint16Array(512);
  const binSums = new Uint32Array(512 * 3);

  for (let gy = 0; gy < gridHeight; gy += 1) {
    const sy0 = (gy * analysisHeight) / gridHeight;
    const sy1 = ((gy + 1) * analysisHeight) / gridHeight;
    const sampleY = Math.max(
      1,
      Math.min(8, Math.ceil(sy1 - sy0)),
    );

    for (let gx = 0; gx < gridWidth; gx += 1) {
      const sx0 = (gx * analysisWidth) / gridWidth;
      const sx1 = ((gx + 1) * analysisWidth) / gridWidth;
      const sampleX = Math.max(
        1,
        Math.min(8, Math.ceil(sx1 - sx0)),
      );

      let colorSamples = 0;
      let opaqueSamples = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let minAlpha = 255;
      let maxAlpha = 0;
      let minLuma = 255;
      let maxLuma = 0;
      let minChannel = 255;
      let maxChannel = 0;
      const touchedBins: number[] = [];

      for (let iy = 0; iy < sampleY; iy += 1) {
        const py = Math.min(
          analysisHeight - 1,
          Math.floor(
            sy0 + ((iy + 0.5) / sampleY) * (sy1 - sy0),
          ),
        );

        for (let ix = 0; ix < sampleX; ix += 1) {
          const px = Math.min(
            analysisWidth - 1,
            Math.floor(
              sx0 + ((ix + 0.5) / sampleX) * (sx1 - sx0),
            ),
          );
          const offset = (py * analysisWidth + px) * 4;
          const alpha = sourceData[offset + 3];
          minAlpha = Math.min(minAlpha, alpha);
          maxAlpha = Math.max(maxAlpha, alpha);

          if (alpha < 32) continue;

          const red = sourceData[offset];
          const green = sourceData[offset + 1];
          const blue = sourceData[offset + 2];
          const luma =
            0.2126 * red + 0.7152 * green + 0.0722 * blue;

          colorSamples += 1;
          if (alpha >= ALPHA_THRESHOLD) opaqueSamples += 1;
          sumR += red;
          sumG += green;
          sumB += blue;
          minLuma = Math.min(minLuma, luma);
          maxLuma = Math.max(maxLuma, luma);
          minChannel = Math.min(minChannel, red, green, blue);
          maxChannel = Math.max(maxChannel, red, green, blue);

          if (alpha >= 96) {
            const bin =
              ((red >> 5) << 6) |
              ((green >> 5) << 3) |
              (blue >> 5);
            if (binCounts[bin] === 0) touchedBins.push(bin);
            binCounts[bin] += 1;
            binSums[bin * 3] += red;
            binSums[bin * 3 + 1] += green;
            binSums[bin * 3 + 2] += blue;
          }
        }
      }

      const totalSamples = sampleX * sampleY;
      const alphaFraction = opaqueSamples / totalSamples;
      let alpha = 255;
      if (minAlpha < 240) {
        alpha = alphaFraction >= 0.32 ? 255 : 0;
        if (alphaFraction < 0.18) alpha = 0;
      }

      const pixelOffset = (gy * gridWidth + gx) * 4;

      if (alpha === 0 || colorSamples === 0) {
        for (const bin of touchedBins) {
          binCounts[bin] = 0;
          binSums[bin * 3] = 0;
          binSums[bin * 3 + 1] = 0;
          binSums[bin * 3 + 2] = 0;
        }
        continue;
      }

      let dominantBin = -1;
      let dominantCount = 0;
      for (const bin of touchedBins) {
        if (binCounts[bin] > dominantCount) {
          dominantCount = binCounts[bin];
          dominantBin = bin;
        }
      }

      const hasAlphaEdge = minAlpha < 235 && maxAlpha > 80;
      const isEdge =
        maxLuma - minLuma >= 24 ||
        maxChannel - minChannel >= 36 ||
        hasAlphaEdge;

      let red = Math.round(sumR / colorSamples);
      let green = Math.round(sumG / colorSamples);
      let blue = Math.round(sumB / colorSamples);

      // 边缘格取主导色，不把前景、背景平均成过渡色。
      if (isEdge && dominantBin >= 0 && dominantCount >= 2) {
        red = Math.round(binSums[dominantBin * 3] / dominantCount);
        green = Math.round(
          binSums[dominantBin * 3 + 1] / dominantCount,
        );
        blue = Math.round(
          binSums[dominantBin * 3 + 2] / dominantCount,
        );
      }

      output[pixelOffset] = red;
      output[pixelOffset + 1] = green;
      output[pixelOffset + 2] = blue;
      output[pixelOffset + 3] = alpha;

      for (const bin of touchedBins) {
        binCounts[bin] = 0;
        binSums[bin * 3] = 0;
        binSums[bin * 3 + 1] = 0;
        binSums[bin * 3 + 2] = 0;
      }
    }
  }

  return output;
}

/**
 * 方案 A：自适应宏像素细节。
 * 开启后先得到 2× 细分网格，再逐个宏观块判断：
 * - 平坦块：填回平均色，视觉上仍是一个大像素；
 * - 边缘块：保留 2×2 个微像素，形成局部细节。
 */
function applyAdaptiveMacroDetail(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  macroWidth: number,
  macroHeight: number,
  characterMode = false,
): Uint8ClampedArray {
  if (
    width !== macroWidth * MACRO_DETAIL_SCALE ||
    height !== macroHeight * MACRO_DETAIL_SCALE
  ) {
    return pixels;
  }

  // 角色素材降低细节门槛，优先保住眼睛、嘴巴、脸颊等小区域；
  // 普通素材则更保守，避免把照片纹理全部细分。
  const internalThreshold = characterMode
    ? 44
    : MACRO_DETAIL_INTERNAL_THRESHOLD;
  const edgeThreshold = characterMode
    ? 24
    : MACRO_DETAIL_EDGE_THRESHOLD;

  const cellCount = macroWidth * macroHeight;
  const averages: Array<Rgb | null> = new Array(cellCount).fill(null);
  const internalSpread = new Float32Array(cellCount);
  const detailMask = new Uint8Array(cellCount);
  const cellIndices: number[][] = new Array(cellCount);

  // 第一遍：计算每个宏观块的平均色、内部差异和透明状态。
  for (let my = 0; my < macroHeight; my += 1) {
    for (let mx = 0; mx < macroWidth; mx += 1) {
      const cellIndex = my * macroWidth + mx;
      const indices = [
        (my * MACRO_DETAIL_SCALE) * width + mx * MACRO_DETAIL_SCALE,
        (my * MACRO_DETAIL_SCALE) * width + mx * MACRO_DETAIL_SCALE + 1,
        (my * MACRO_DETAIL_SCALE + 1) * width + mx * MACRO_DETAIL_SCALE,
        (my * MACRO_DETAIL_SCALE + 1) * width +
          mx * MACRO_DETAIL_SCALE +
          1,
      ];
      cellIndices[cellIndex] = indices;

      const opaqueCount = indices.reduce(
        (count, index) =>
          count + (pixels[index * 4 + 3] === 255 ? 1 : 0),
        0,
      );

      if (opaqueCount === 0) continue;

      // 透明混边必须保留，否则素材轮廓会被压掉。
      if (opaqueCount < indices.length) {
        detailMask[cellIndex] = 1;
        continue;
      }

      const colors = indices.map((index) => [
        pixels[index * 4],
        pixels[index * 4 + 1],
        pixels[index * 4 + 2],
      ] as Rgb);

      let maxDistance = 0;
      for (let i = 0; i < colors.length; i += 1) {
        for (let j = i + 1; j < colors.length; j += 1) {
          maxDistance = Math.max(
            maxDistance,
            rgbDistance(colors[i], colors[j]),
          );
        }
      }

      internalSpread[cellIndex] = maxDistance;
      averages[cellIndex] = [
        Math.round(
          colors.reduce((sum, color) => sum + color[0], 0) /
            colors.length,
        ),
        Math.round(
          colors.reduce((sum, color) => sum + color[1], 0) /
            colors.length,
        ),
        Math.round(
          colors.reduce((sum, color) => sum + color[2], 0) /
            colors.length,
        ),
      ];

      if (maxDistance >= internalThreshold) {
        detailMask[cellIndex] = 1;
      }
    }
  }

  // 第二遍：只有位于宏观结构边界上的块，或内部差异极大的块，才保留 2×2 细节。
  for (let my = 0; my < macroHeight; my += 1) {
    for (let mx = 0; mx < macroWidth; mx += 1) {
      const cellIndex = my * macroWidth + mx;
      const average = averages[cellIndex];
      if (!average) continue;

      let neighborContrast = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = mx + dx;
          const ny = my + dy;
          if (nx < 0 || nx >= macroWidth || ny < 0 || ny >= macroHeight) {
            continue;
          }
          const neighbor = averages[ny * macroWidth + nx];
          if (!neighbor) continue;
          neighborContrast = Math.max(
            neighborContrast,
            rgbDistance(average, neighbor),
          );
        }
      }

      if (neighborContrast >= edgeThreshold) {
        detailMask[cellIndex] = 1;
      }
    }
  }

  // 清除没有相邻细节的孤立纹理点，防止画面重新变得很脏。
  const filteredMask = new Uint8Array(detailMask);
  for (let my = 0; my < macroHeight; my += 1) {
    for (let mx = 0; mx < macroWidth; mx += 1) {
      const cellIndex = my * macroWidth + mx;
      if (detailMask[cellIndex] === 0) continue;

      // 角色素材的孤立细节可能正是眼睛或嘴巴，不做孤立点清理。
      if (characterMode) continue;
      if (
        internalSpread[cellIndex] >=
        MACRO_DETAIL_INTERNAL_THRESHOLD * 1.3
      ) {
        continue;
      }

      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = mx + dx;
          const ny = my + dy;
          if (nx < 0 || nx >= macroWidth || ny < 0 || ny >= macroHeight) {
            continue;
          }
          neighbors += detailMask[ny * macroWidth + nx];
        }
      }

      if (neighbors === 0) filteredMask[cellIndex] = 0;
    }
  }

  // 第三遍：非细节宏块填回平均色，视觉上仍是一个大像素。
  const output = new Uint8ClampedArray(pixels);
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const average = averages[cellIndex];
    if (!average || filteredMask[cellIndex] === 1) continue;

    for (const index of cellIndices[cellIndex]) {
      const offset = index * 4;
      output[offset] = average[0];
      output[offset + 1] = average[1];
      output[offset + 2] = average[2];
      output[offset + 3] = 255;
    }
  }

  return output;
}

function rgbDistance(first: Rgb, second: Rgb): number {
  const dr = first[0] - second[0];
  const dg = first[1] - second[1];
  const db = first[2] - second[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 游戏素材的纯色背景处理。
 * 从图像四边开始做连通区域填充，把背景变为透明；
 * 后续输出统一铺白底，因此不会保留原始背景颜色。
 *
 * 如果图片本身已有透明通道，直接跳过；如果边缘颜色不统一，
 * 也不会强行抠图，避免误删素材主体。
 */
function removeSolidAssetBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  removeEnclosedBackground = true,
): Uint8ClampedArray {
  const pixelCount = width * height;
  let hasTransparency = false;

  for (let index = 0; index < pixelCount; index += 1) {
    if (pixels[index * 4 + 3] === 0) {
      hasTransparency = true;
      break;
    }
  }

  // 已经有透明背景时，不需要再猜纯色背景。
  if (hasTransparency) return pixels;

  const borderIndices = new Set<number>();
  for (let x = 0; x < width; x += 1) {
    borderIndices.add(x);
    borderIndices.add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    borderIndices.add(y * width);
    borderIndices.add(y * width + width - 1);
  }

  const binCounts = new Uint32Array(512);
  const binSums = new Uint32Array(512 * 3);
  const touchedBins: number[] = [];

  for (const index of borderIndices) {
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const bin =
      ((red >> 5) << 6) | ((green >> 5) << 3) | (blue >> 5);

    if (binCounts[bin] === 0) touchedBins.push(bin);
    binCounts[bin] += 1;
    binSums[bin * 3] += red;
    binSums[bin * 3 + 1] += green;
    binSums[bin * 3 + 2] += blue;
  }

  let dominantBin = -1;
  let dominantCount = 0;
  for (const bin of touchedBins) {
    if (binCounts[bin] > dominantCount) {
      dominantCount = binCounts[bin];
      dominantBin = bin;
    }
  }

  // 四边颜色不够统一，说明不是可靠的纯色背景，直接跳过。
  if (
    dominantBin < 0 ||
    dominantCount / borderIndices.size < 0.55
  ) {
    return pixels;
  }

  const background: Rgb = [
    Math.round(binSums[dominantBin * 3] / dominantCount),
    Math.round(binSums[dominantBin * 3 + 1] / dominantCount),
    Math.round(binSums[dominantBin * 3 + 2] / dominantCount),
  ];

  const backgroundLuma =
    0.2126 * background[0] +
    0.7152 * background[1] +
    0.0722 * background[2];

  // 纯白背景要特别保守：白发、白衣服与背景非常接近，
  // 使用较低容差可以保住带灰色阴影的浅色头发。
  const backgroundTolerance =
    backgroundLuma > 240 ? 18 : ASSET_BACKGROUND_TOLERANCE;

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const isBackgroundColor = (index: number): boolean => {
    const offset = index * 4;
    return (
      rgbDistance(
        [
          pixels[offset],
          pixels[offset + 1],
          pixels[offset + 2],
        ],
        background,
      ) <= backgroundTolerance
    );
  };

  for (const index of borderIndices) {
    if (!isBackgroundColor(index) || visited[index] === 1) continue;
    visited[index] = 1;
    queue[tail++] = index;
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);

    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0 || visited[neighbor] === 1) continue;
      if (!isBackgroundColor(neighbor)) continue;
      visited[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }

  // 极小区域不处理，避免把错误颜色当成背景。
  if (tail / pixelCount < 0.02) return pixels;

  /**
   * 处理被头发、手臂或披风包围起来的“洞”。
   * 这些区域没有和画布边缘连通，正常 flood fill 不会进入。
   *
   * 为避免误删和背景同色的眼白、衣服：
   * - 只接受与背景色非常接近的像素；
   * - 只清理面积较大的连通块；
   * - 小面积色块保留下来。
   * 武器模式会跳过这段，因为大面积高光可能就是武器本体。
   */
  if (removeEnclosedBackground) {
    // 人设图通常带明暗变化，背景洞不一定与边缘色完全相同，
    // 因此用更宽松的容差和更低面积门槛来捕捉发丝包围区域。
    // 小面积阈值仍用于保护眼白、牙齿和亮色细节。
    // 白色背景改用更严格的容差，防止把白发和白衣也清掉。
    const enclosedTolerance = backgroundLuma > 240 ? 18 : 40;
    const minEnclosedArea = Math.max(
      32,
      Math.floor(pixelCount * 0.008),
    );
    const candidateVisited = new Uint8Array(pixelCount);
    const strongBackground = (index: number): boolean => {
      const offset = index * 4;
      return (
        pixels[offset + 3] === 255 &&
        rgbDistance(
          [
            pixels[offset],
            pixels[offset + 1],
            pixels[offset + 2],
          ],
          background,
        ) <= enclosedTolerance
      );
    };

    for (let start = 0; start < pixelCount; start += 1) {
      if (
        visited[start] === 1 ||
        candidateVisited[start] === 1 ||
        !strongBackground(start)
      ) {
        continue;
      }

      let compHead = 0;
      let compTail = 0;
      const component: number[] = [];
      queue[compTail++] = start;
      candidateVisited[start] = 1;

      while (compHead < compTail) {
        const index = queue[compHead++];
        component.push(index);
        const x = index % width;
        const y = Math.floor(index / width);

        const neighbors = [
          x > 0 ? index - 1 : -1,
          x < width - 1 ? index + 1 : -1,
          y > 0 ? index - width : -1,
          y < height - 1 ? index + width : -1,
        ];

        for (const neighbor of neighbors) {
          if (
            neighbor < 0 ||
            visited[neighbor] === 1 ||
            candidateVisited[neighbor] === 1 ||
            !strongBackground(neighbor)
          ) {
            continue;
          }
          candidateVisited[neighbor] = 1;
          queue[compTail++] = neighbor;
        }
      }

      // 大面积封闭色块才视作背景洞，避免删除眼白、扣子等小细节。
      if (component.length < minEnclosedArea) continue;
      for (const index of component) {
        visited[index] = 1;
      }
    }
  }

  const output = new Uint8ClampedArray(pixels);
  for (let index = 0; index < pixelCount; index += 1) {
    if (visited[index] === 1) {
      output[index * 4 + 3] = 0;
    }
  }

  return output;
}

/**
 * 武器固定轮廓蒙版。
 * ------------------------------------------------------------
 * 先在固定的 640px 分析图上识别武器外形：
 * - 有透明通道时直接用 alpha；
 * - 纯色背景时只删除与画布边缘连通的背景；
 * - 大面积高光即使与背景同色，只要被武器本体包围就会保留。
 *
 * 得到轮廓后，只把这张蒙版按覆盖率缩放到当前颗粒网格。
 * 因此用户改变像素颗粒时，武器外形不会重新猜一次。
 */
function applyWeaponSilhouetteMask(
  lowPixels: Uint8ClampedArray,
  gridWidth: number,
  gridHeight: number,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  cacheKey: string,
): Uint8ClampedArray {
  let maskCanvas = weaponMaskCache.get(cacheKey);

  if (!maskCanvas) {
    const maskSize = scaleToLongSide(
      sourceWidth,
      sourceHeight,
      WEAPON_MASK_SIDE,
    );
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = maskSize.width;
    analysisCanvas.height = maskSize.height;
    const analysisContext = analysisCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    if (!analysisContext) return lowPixels;

    analysisContext.imageSmoothingEnabled = true;
    analysisContext.imageSmoothingQuality = 'high';
    analysisContext.drawImage(
      source,
      0,
      0,
      maskSize.width,
      maskSize.height,
    );

    const analysisData = analysisContext.getImageData(
      0,
      0,
      maskSize.width,
      maskSize.height,
    ).data;
    let hasTransparency = false;

    for (
      let index = 0;
      index < maskSize.width * maskSize.height;
      index += 1
    ) {
      if (analysisData[index * 4 + 3] < ALPHA_THRESHOLD) {
        hasTransparency = true;
        break;
      }
    }

    let foregroundAlpha: Uint8ClampedArray;

    if (hasTransparency) {
      foregroundAlpha = new Uint8ClampedArray(
        maskSize.width * maskSize.height,
      );
      for (let index = 0; index < foregroundAlpha.length; index += 1) {
        foregroundAlpha[index] =
          analysisData[index * 4 + 3] >= ALPHA_THRESHOLD ? 255 : 0;
      }
    } else {
      // 纯色背景：用从低到高的多档容差尝试轮廓。
      // 武器刀刃和高光常常与背景非常接近，一开始就用大容差
      // 会把整块刀身当成背景删掉；取“能清掉边框背景的最小容差”
      // 可以优先保留与背景相近的主体。
      foregroundAlpha = extractWeaponAlpha(
        analysisData,
        maskSize.width,
        maskSize.height,
      );
    }

    maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskSize.width;
    maskCanvas.height = maskSize.height;
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) return lowPixels;

    const maskData = maskContext.createImageData(
      maskSize.width,
      maskSize.height,
    );
    for (let index = 0; index < foregroundAlpha.length; index += 1) {
      const offset = index * 4;
      maskData.data[offset] = 255;
      maskData.data[offset + 1] = 255;
      maskData.data[offset + 2] = 255;
      maskData.data[offset + 3] = foregroundAlpha[index] ?? 0;
    }
    maskContext.putImageData(maskData, 0, 0);

    if (weaponMaskCache.size >= WEAPON_MASK_CACHE_LIMIT) {
      const oldestKey = weaponMaskCache.keys().next().value;
      if (oldestKey) weaponMaskCache.delete(oldestKey);
    }
    weaponMaskCache.set(cacheKey, maskCanvas);
  }

  // 按覆盖率缩放蒙版；固定分析图来源，不随颗粒大小重新提取。
  const lowMaskCanvas = document.createElement('canvas');
  lowMaskCanvas.width = gridWidth;
  lowMaskCanvas.height = gridHeight;
  const lowMaskContext = lowMaskCanvas.getContext('2d', {
    willReadFrequently: true,
  });
  if (!lowMaskContext) return lowPixels;

  lowMaskContext.imageSmoothingEnabled = true;
  lowMaskContext.imageSmoothingQuality = 'high';
  lowMaskContext.drawImage(
    maskCanvas,
    0,
    0,
    gridWidth,
    gridHeight,
  );
  const lowMaskData = lowMaskContext.getImageData(
    0,
    0,
    gridWidth,
    gridHeight,
  ).data;

  const output = new Uint8ClampedArray(lowPixels);
  for (let index = 0; index < gridWidth * gridHeight; index += 1) {
    if (lowMaskData[index * 4 + 3] >= 128) {
      output[index * 4 + 3] = 255;
    } else {
      output[index * 4 + 3] = 0;
    }
  }

  return output;
}

/**
 * 提取武器前景 alpha。
 * 从最低容差开始尝试，只要求“画布边缘的背景大多被清掉”，
 * 不追求把所有近似背景的内部像素都删掉。对于一个高光面积
 * 很大的武器，这比单次大容差更安全。
 */
function extractWeaponAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixelCount = width * height;
  const background = detectBorderBackground(pixels, width, height);
  if (!background) {
    const allOpaque = new Uint8ClampedArray(pixelCount);
    allOpaque.fill(255);
    return allOpaque;
  }

  const backgroundLuma =
    0.2126 * background[0] +
    0.7152 * background[1] +
    0.0722 * background[2];
  const candidates =
    backgroundLuma > 240
      ? [6, 10, 14, 18, 24, 32]
      : [8, 12, 16, 20, 24, 32, 48];
  let fallback: Uint8Array | null = null;
  let fallbackRatio = 0;
  let chosen: Uint8Array | null = null;

  for (const tolerance of candidates) {
    const mask = buildBorderBackgroundMask(
      pixels,
      width,
      height,
      background,
      tolerance,
    );
    const foregroundRatio = 1 - mask.removedCount / pixelCount;

    if (foregroundRatio < 0.015) continue;
    if (
      mask.borderRemovedRatio >= 0.5 &&
      mask.borderRemovedRatio > fallbackRatio
    ) {
      fallback = mask.visited;
      fallbackRatio = mask.borderRemovedRatio;
    }
    if (mask.borderRemovedRatio >= 0.8) {
      chosen = mask.visited;
      break;
    }
  }

  const removed = chosen ?? fallback;
  const alpha = new Uint8ClampedArray(pixelCount);
  // 找不到可靠的背景时全部保留，宁可留背景也不要删武器。
  if (!removed) {
    alpha.fill(255);
    return alpha;
  }

  for (let index = 0; index < pixelCount; index += 1) {
    alpha[index] = removed[index] === 1 ? 0 : 255;
  }
  return alpha;
}

/** 从四边颜色估计纯色背景；边缘不够统一时返回 null */
function detectBorderBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb | null {
  const binCounts = new Uint32Array(512);
  const binSums = new Uint32Array(512 * 3);
  const touchedBins: number[] = [];
  let borderCount = 0;

  const visit = (index: number) => {
    borderCount += 1;
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const bin =
      ((red >> 5) << 6) | ((green >> 5) << 3) | (blue >> 5);
    if (binCounts[bin] === 0) touchedBins.push(bin);
    binCounts[bin] += 1;
    binSums[bin * 3] += red;
    binSums[bin * 3 + 1] += green;
    binSums[bin * 3 + 2] += blue;
  };

  for (let x = 0; x < width; x += 1) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    visit(y * width);
    visit(y * width + width - 1);
  }

  let dominantBin = -1;
  let dominantCount = 0;
  for (const bin of touchedBins) {
    if (binCounts[bin] > dominantCount) {
      dominantCount = binCounts[bin];
      dominantBin = bin;
    }
  }

  if (
    dominantBin < 0 ||
    borderCount === 0 ||
    dominantCount / borderCount < 0.55
  ) {
    return null;
  }

  return [
    Math.round(binSums[dominantBin * 3] / dominantCount),
    Math.round(
      binSums[dominantBin * 3 + 1] / dominantCount,
    ),
    Math.round(
      binSums[dominantBin * 3 + 2] / dominantCount,
    ),
  ];
}

/** 从四边开始按容差填充背景，返回被删像素和边缘清理比例 */
function buildBorderBackgroundMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  background: Rgb,
  tolerance: number,
): {
  visited: Uint8Array;
  removedCount: number;
  borderRemovedRatio: number;
} {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  let borderTotal = 0;
  let borderRemoved = 0;

  const isBackground = (index: number): boolean => {
    const offset = index * 4;
    return (
      rgbDistance(
        [
          pixels[offset],
          pixels[offset + 1],
          pixels[offset + 2],
        ],
        background,
      ) <= tolerance
    );
  };

  const enqueue = (index: number) => {
    if (visited[index] === 1) return;
    if (!isBackground(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    borderTotal += 2;
    const top = x;
    const bottom = (height - 1) * width + x;
    if (isBackground(top)) borderRemoved += 1;
    if (isBackground(bottom)) borderRemoved += 1;
    enqueue(top);
    enqueue(bottom);
  }
  for (let y = 0; y < height; y += 1) {
    borderTotal += 2;
    const left = y * width;
    const right = y * width + width - 1;
    if (isBackground(left)) borderRemoved += 1;
    if (isBackground(right)) borderRemoved += 1;
    enqueue(left);
    enqueue(right);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  return {
    visited,
    removedCount: tail,
    borderRemovedRatio:
      borderTotal > 0 ? borderRemoved / borderTotal : 0,
  };
}

/** 用二值 alpha 清理透明边缘，像素画需要清晰、干净的轮廓 */
function createAlphaMask(data: Uint8ClampedArray): Uint8Array {
  const mask = new Uint8Array(data.length / 4);

  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = data[index * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  }

  return mask;
}

/**
 * 双边滤波：
 * - 离得越近的像素权重越高；
 * - 颜色差越大的像素权重越低。
 * 平面内的噪点会被抹平，物体边界和明暗分界可以保留。
 */
function bilateralFilter(
  source: Uint8ClampedArray,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  colorSigma: number,
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(source);

  const output = new Uint8ClampedArray(source.length);
  const spatialSigma = Math.max(1, radius) * 1.15;
  const colorSigmaSquared = 2 * colorSigma * colorSigma;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const offset = pixelIndex * 4;

      if (alphaMask[pixelIndex] === 0) {
        output.set(source.subarray(offset, offset + 4), offset);
        continue;
      }

      const centerR = source[offset];
      const centerG = source[offset + 1];
      const centerB = source[offset + 2];
      let weightedR = 0;
      let weightedG = 0;
      let weightedB = 0;
      let weightSum = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighborIndex = ny * width + nx;
          if (alphaMask[neighborIndex] === 0) continue;

          const neighborOffset = neighborIndex * 4;
          const dr = source[neighborOffset] - centerR;
          const dg = source[neighborOffset + 1] - centerG;
          const db = source[neighborOffset + 2] - centerB;
          const colorDistance = dr * dr + dg * dg + db * db;
          const spatialDistance = dx * dx + dy * dy;
          const weight =
            Math.exp(
              -spatialDistance / (2 * spatialSigma * spatialSigma),
            ) * Math.exp(-colorDistance / colorSigmaSquared);

          weightedR += source[neighborOffset] * weight;
          weightedG += source[neighborOffset + 1] * weight;
          weightedB += source[neighborOffset + 2] * weight;
          weightSum += weight;
        }
      }

      if (weightSum > 0) {
        output[offset] = Math.round(weightedR / weightSum);
        output[offset + 1] = Math.round(weightedG / weightSum);
        output[offset + 2] = Math.round(weightedB / weightSum);
      } else {
        output[offset] = centerR;
        output[offset + 1] = centerG;
        output[offset + 2] = centerB;
      }

      output[offset + 3] = 255;
    }
  }

  return output;
}

/** 调整对比度，让受光面和高光更清楚 */
function applyContrast(
  data: Uint8ClampedArray,
  alphaMask: Uint8Array,
  contrast: number,
): void {
  if (Math.abs(contrast - 1) < 0.001) return;

  for (let index = 0; index < alphaMask.length; index += 1) {
    if (alphaMask[index] === 0) continue;

    const offset = index * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[offset + channel];
      data[offset + channel] = clampByte(
        (value - 128) * contrast + 128,
      );
    }
  }
}

/** 把低分辨率 RGB 预先转换成 Lab */
function createLabField(
  data: Uint8ClampedArray,
  alphaMask: Uint8Array,
): Float32Array {
  const labs = new Float32Array(alphaMask.length * 3);

  for (let index = 0; index < alphaMask.length; index += 1) {
    if (alphaMask[index] === 0) continue;

    const offset = index * 4;
    const lab = rgbToLab(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    labs[index * 3] = lab.l;
    labs[index * 3 + 1] = lab.a;
    labs[index * 3 + 2] = lab.b;
  }

  return labs;
}

/** 对 Lab 场做小半径均值平滑，用作抖动目标，减少随机彩点 */
function blurLabField(
  labs: Float32Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const output = new Float32Array(labs.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alphaMask[index] === 0) continue;

      let sumL = 0;
      let sumA = 0;
      let sumB = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighborIndex = ny * width + nx;
          if (alphaMask[neighborIndex] === 0) continue;

          sumL += labs[neighborIndex * 3];
          sumA += labs[neighborIndex * 3 + 1];
          sumB += labs[neighborIndex * 3 + 2];
          count += 1;
        }
      }

      if (count > 0) {
        output[index * 3] = sumL / count;
        output[index * 3 + 1] = sumA / count;
        output[index * 3 + 2] = sumB / count;
      }
    }
  }

  return output;
}

/**
 * 自适应色板：
 * - 在 Lab 空间里用最远点初始化 + k-means 聚类；
 * - 最多保留 maxColors 种颜色；
 * - 返回聚类标签和色板。
 */
function quantizeAdaptiveColors(
  labs: Float32Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  maxColors: number,
): ColorField {
  const pixelCount = width * height;
  const opaqueIndices: number[] = [];

  for (let index = 0; index < pixelCount; index += 1) {
    if (alphaMask[index] === 1) opaqueIndices.push(index);
  }

  if (opaqueIndices.length === 0) {
    return {
      labels: new Int16Array(pixelCount),
      paletteRgb: [[0, 0, 0]],
      paletteLab: [{ l: 0, a: 0, b: 0 }],
    };
  }

  const sampleStep = Math.max(
    1,
    Math.floor(opaqueIndices.length / 5000),
  );
  const samples: LabColor[] = [];

  for (let i = 0; i < opaqueIndices.length; i += sampleStep) {
    const pixel = opaqueIndices[i];
    samples.push({
      l: labs[pixel * 3],
      a: labs[pixel * 3 + 1],
      b: labs[pixel * 3 + 2],
    });
  }

  const clusterCount = Math.min(maxColors, samples.length);
  const centers = initializeCenters(samples, clusterCount);
  refineCenters(samples, centers, 8);

  const labels = new Int16Array(pixelCount);
  labels.fill(-1);

  for (const pixel of opaqueIndices) {
    labels[pixel] = nearestCenterIndex(
      labs[pixel * 3],
      labs[pixel * 3 + 1],
      labs[pixel * 3 + 2],
      centers,
    );
  }

  return {
    labels,
    paletteLab: centers,
    paletteRgb: centers.map((center) =>
      labToRgb(center.l, center.a, center.b),
    ),
  };
}

/** 用最远点初始化色板，让颜色覆盖暗部、亮部和不同色相 */
function initializeCenters(
  samples: LabColor[],
  count: number,
): LabColor[] {
  const centers: LabColor[] = [];
  if (count <= 0) return centers;

  const average = samples.reduce(
    (sum, sample) => ({
      l: sum.l + sample.l / samples.length,
      a: sum.a + sample.a / samples.length,
      b: sum.b + sample.b / samples.length,
    }),
    { l: 0, a: 0, b: 0 },
  );

  centers.push(average);

  while (centers.length < count) {
    let farthest = samples[0];
    let farthestDistance = -1;

    for (const sample of samples) {
      const distance = nearestCenterDistance(sample, centers);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = sample;
      }
    }

    centers.push({ ...farthest });
    if (farthestDistance <= 0.0001) break;
  }

  while (centers.length < count) {
    centers.push({ ...samples[centers.length % samples.length] });
  }

  return centers;
}

/** 对采样颜色执行 k-means 迭代 */
function refineCenters(
  samples: LabColor[],
  centers: LabColor[],
  iterations: number,
): void {
  const sums = centers.map(() => ({ l: 0, a: 0, b: 0 }));
  const counts = centers.map(() => 0);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const sum of sums) {
      sum.l = 0;
      sum.a = 0;
      sum.b = 0;
    }
    counts.fill(0);

    for (const sample of samples) {
      const index = nearestCenterIndex(
        sample.l,
        sample.a,
        sample.b,
        centers,
      );
      sums[index].l += sample.l;
      sums[index].a += sample.a;
      sums[index].b += sample.b;
      counts[index] += 1;
    }

    let moved = 0;
    for (let index = 0; index < centers.length; index += 1) {
      if (counts[index] === 0) continue;

      const nextL = sums[index].l / counts[index];
      const nextA = sums[index].a / counts[index];
      const nextB = sums[index].b / counts[index];
      moved +=
        Math.abs(centers[index].l - nextL) +
        Math.abs(centers[index].a - nextA) +
        Math.abs(centers[index].b - nextB);
      centers[index] = { l: nextL, a: nextA, b: nextB };
    }

    if (moved < 0.8) break;
  }
}

/** 把固定色阶扩展或压缩到用户选定的颜色数量 */
function buildRampPalette(
  stops: readonly string[],
  count: number,
): Rgb[] {
  const colors = stops.map((hex) => hexToRgb(hex));
  if (count <= 1) return [colors[0]];
  if (count === colors.length) return colors.map((color) => [...color]);

  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const position = t * (colors.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(colors.length - 1, leftIndex + 1);
    const local = position - leftIndex;
    const left = colors[leftIndex];
    const right = colors[rightIndex];

    return [
      Math.round(left[0] + (right[0] - left[0]) * local),
      Math.round(left[1] + (right[1] - left[1]) * local),
      Math.round(left[2] + (right[2] - left[2]) * local),
    ];
  });
}

/**
 * 合并面积过小的同色区域。
 * 1～2 像素的小块通常来自纹理噪点，并到相邻大区域后画面更干净。
 */
function mergeSmallRegions(
  labels: Int16Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  minSize: number,
): Int16Array {
  const output = new Int16Array(labels);
  const visited = new Uint8Array(labels.length);
  const queue = new Int32Array(labels.length);

  for (let start = 0; start < labels.length; start += 1) {
    if (alphaMask[start] === 0 || visited[start] === 1) continue;

    const label = labels[start];
    if (label < 0) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    const component: number[] = [];
    const borderCounts = new Map<number, number>();

    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);

      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const neighborIndex = ny * width + nx;
        if (alphaMask[neighborIndex] === 0) continue;

        const neighborLabel = labels[neighborIndex];
        if (neighborLabel === label) {
          if (visited[neighborIndex] === 0) {
            visited[neighborIndex] = 1;
            queue[tail++] = neighborIndex;
          }
        } else if (neighborLabel >= 0) {
          borderCounts.set(
            neighborLabel,
            (borderCounts.get(neighborLabel) ?? 0) + 1,
          );
        }
      }
    }

    if (component.length < minSize && borderCounts.size > 0) {
      let dominantLabel = label;
      let dominantCount = 0;

      for (const [neighborLabel, count] of borderCounts) {
        if (count > dominantCount) {
          dominantCount = count;
          dominantLabel = neighborLabel;
        }
      }

      if (dominantLabel !== label) {
        for (const index of component) {
          output[index] = dominantLabel;
        }
      }
    }
  }

  return output;
}

/**
 * 每个连通区域取自身颜色的平均值，再匹配到有限色板。
 * 这是控制画面“脏色”和保证色数上限的核心步骤。
 */
function renderQuantizedRegionColors(
  labels: Int16Array,
  labs: Float32Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  paletteRgb: Rgb[],
  paletteLab: LabColor[],
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(labels.length * 4);
  const visited = new Uint8Array(labels.length);
  const queue = new Int32Array(labels.length);

  for (let start = 0; start < labels.length; start += 1) {
    if (alphaMask[start] === 0 || visited[start] === 1) continue;

    const label = labels[start];
    if (label < 0) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    const component: number[] = [];
    let sumL = 0;
    let sumA = 0;
    let sumB = 0;

    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      sumL += labs[index * 3];
      sumA += labs[index * 3 + 1];
      sumB += labs[index * 3 + 2];

      const x = index % width;
      const y = Math.floor(index / width);

      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const neighborIndex = ny * width + nx;
        if (
          alphaMask[neighborIndex] === 1 &&
          visited[neighborIndex] === 0 &&
          labels[neighborIndex] === label
        ) {
          visited[neighborIndex] = 1;
          queue[tail++] = neighborIndex;
        }
      }
    }

    const count = component.length;
    const paletteIndex = nearestCenterIndex(
      sumL / count,
      sumA / count,
      sumB / count,
      paletteLab,
    );
    const color = paletteRgb[paletteIndex] ?? [0, 0, 0];

    for (const index of component) {
      const offset = index * 4;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = 255;
    }
  }

  return output;
}

/**
 * P1：有序抖动。
 * 每个像素在最近的两个色板颜色之间，按 Bayer 阈值选择；
 * 从而在有限色板下模拟更平滑的明暗渐变。
 */
function renderOrderedDither(
  labs: Float32Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  paletteRgb: Rgb[],
  paletteLab: LabColor[],
  strength: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(alphaMask.length * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alphaMask[index] === 0) continue;

      const nearest = nearestTwoCenters(
        labs[index * 3],
        labs[index * 3 + 1],
        labs[index * 3 + 2],
        paletteLab,
      );

      let paletteIndex = nearest.first;
      if (nearest.second >= 0) {
        const firstColor = paletteLab[nearest.first];
        const secondColor = paletteLab[nearest.second];
        const targetL = labs[index * 3];
        const targetA = labs[index * 3 + 1];
        const targetB = labs[index * 3 + 2];
        const paletteGap = colorDistance(firstColor, secondColor);

        // 把目标颜色投影到两个色板颜色形成的线段上：
        // 只有目标颜色确实接近这段混色时，才参与抖动，
        // 避免把蓝海和黄土等无关颜色混成随机彩点。
        const abL = secondColor.l - firstColor.l;
        const abA = secondColor.a - firstColor.a;
        const abB = secondColor.b - firstColor.b;
        const atL = targetL - firstColor.l;
        const atA = targetA - firstColor.a;
        const atB = targetB - firstColor.b;
        const denominator = abL * abL + abA * abA + abB * abB;
        const projection =
          denominator > 0
            ? clamp01(
                (atL * abL + atA * abA + atB * abB) / denominator,
              )
            : 0;
        const mixL = firstColor.l + abL * projection;
        const mixA = firstColor.a + abA * projection;
        const mixB = firstColor.b + abB * projection;
        const residual = Math.sqrt(
          (targetL - mixL) ** 2 +
            (targetA - mixA) ** 2 +
            (targetB - mixB) ** 2,
        );

        if (paletteGap <= 30 && residual <= 3.5) {
          const ratio = Math.min(projection, 0.5) * strength;
          const threshold =
            (BAYER_4X4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

          if (ratio > threshold) {
            paletteIndex = nearest.second;
          }
        }
      }

      const color = paletteRgb[paletteIndex] ?? [0, 0, 0];
      const offset = index * 4;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = 255;
    }
  }

  return output;
}

/**
 * 宏像素细节模式使用的逐像素量化。
 * 不平滑区域、不做区域平均，从而保留 2×2 微像素之间的差异。
 */
function renderPalettePixels(
  labs: Float32Array,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  paletteRgb: Rgb[],
  paletteLab: LabColor[],
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(alphaMask.length * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alphaMask[index] === 0) continue;

      const paletteIndex = nearestCenterIndex(
        labs[index * 3],
        labs[index * 3 + 1],
        labs[index * 3 + 2],
        paletteLab,
      );
      const color = paletteRgb[paletteIndex] ?? [0, 0, 0];
      const offset = index * 4;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = 255;
    }
  }

  return output;
}

/**
 * 深色轮廓：
 * - 透明素材：沿 alpha 轮廓加 1 像素深色描边；
 * - 不透明图片：沿高对比区域边界描边；
 * - Selout 模式会选暗部一侧并使用局部深色，而不是统一纯黑。
 */
function applyPixelArtOutlines(
  pixels: Uint8ClampedArray,
  alphaMask: Uint8Array,
  hasTransparency: boolean,
  width: number,
  height: number,
  profile: PresetProfile,
  outlineColor: Rgb,
  paletteRgb: Rgb[],
  outlineMode: OutlineMode,
  silhouetteOnly = false,
): void {
  const silhouette = new Uint8Array(width * height);
  const selective = outlineMode === 'selout';
  // 武器只描外轮廓，不描刀身内部高光与阴影的分界，
  // 否则细长武器会被内部黑线吞掉。
  const boundaryEdges =
    !silhouetteOnly && profile.internalOutlines
      ? findColorBoundaryEdges(
          pixels,
          alphaMask,
          width,
          height,
          profile.boundaryThreshold,
          selective,
        )
      : new Uint8Array(width * height);

  if (hasTransparency) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (alphaMask[index] === 0) continue;

        const left = x > 0 ? alphaMask[index - 1] : 0;
        const right = x < width - 1 ? alphaMask[index + 1] : 0;
        const up = y > 0 ? alphaMask[index - width] : 0;
        const down = y < height - 1 ? alphaMask[index + width] : 0;

        if (left === 0 || right === 0 || up === 0 || down === 0) {
          silhouette[index] = 1;
        }
      }
    }
  }

  for (let index = 0; index < alphaMask.length; index += 1) {
    if (alphaMask[index] === 0) continue;

    const isSilhouette = silhouette[index] === 1;
    const isBoundary = boundaryEdges[index] === 1;
    if (!isSilhouette && !isBoundary) continue;

    const offset = index * 4;

    if (selective) {
      // Selout：从色板中选一个更暗的颜色，既形成暗部描边又不会增加色数。
      const darker = findDarkerPaletteColor(
        pixels[offset],
        pixels[offset + 1],
        pixels[offset + 2],
        paletteRgb,
      );
      if (darker) {
        pixels[offset] = darker[0];
        pixels[offset + 1] = darker[1];
        pixels[offset + 2] = darker[2];
      }
      continue;
    }

    // 标准描边使用一个固定颜色，避免每条边混出不同深浅、
    // 导致实际颜色数量失控。
    pixels[offset] = outlineColor[0];
    pixels[offset + 1] = outlineColor[1];
    pixels[offset + 2] = outlineColor[2];
  }
}

/** Selout 用：在当前色板里找比边缘像素更暗、颜色最接近的一档 */
function findDarkerPaletteColor(
  red: number,
  green: number,
  blue: number,
  paletteRgb: Rgb[],
): Rgb | null {
  const currentLuma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  let best: Rgb | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let darkest: Rgb | null = null;
  let darkestLuma = Number.POSITIVE_INFINITY;

  for (const color of paletteRgb) {
    const luma = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
    if (luma < darkestLuma) {
      darkestLuma = luma;
      darkest = color;
    }

    if (
      color[0] === red &&
      color[1] === green &&
      color[2] === blue
    ) {
      continue;
    }

    if (luma > currentLuma * 0.82) continue;

    const dr = color[0] - red;
    const dg = color[1] - green;
    const db = color[2] - blue;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }

  if (best) return best;
  return darkestLuma < currentLuma * 0.94 ? darkest : null;
}

function colorDistance(first: LabColor, second: LabColor): number {
  const dl = first.l - second.l;
  const da = first.a - second.a;
  const db = first.b - second.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * 高对比区域边界。
 * 标准模式把黑线放在较亮的一侧；Selout 模式放在较暗的一侧。
 */
function findColorBoundaryEdges(
  pixels: Uint8ClampedArray,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  preferDarkSide: boolean,
): Uint8Array {
  const edges = new Uint8Array(width * height);

  const markBoundary = (first: number, second: number) => {
    if (alphaMask[first] === 0 || alphaMask[second] === 0) return;

    const firstOffset = first * 4;
    const secondOffset = second * 4;
    const dr = pixels[firstOffset] - pixels[secondOffset];
    const dg = pixels[firstOffset + 1] - pixels[secondOffset + 1];
    const db = pixels[firstOffset + 2] - pixels[secondOffset + 2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance < threshold) return;

    const firstLuma =
      0.2126 * pixels[firstOffset] +
      0.7152 * pixels[firstOffset + 1] +
      0.0722 * pixels[firstOffset + 2];
    const secondLuma =
      0.2126 * pixels[secondOffset] +
      0.7152 * pixels[secondOffset + 1] +
      0.0722 * pixels[secondOffset + 2];

    const target = preferDarkSide
      ? firstLuma <= secondLuma
        ? first
        : second
      : firstLuma >= secondLuma
        ? first
        : second;
    edges[target] = 1;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alphaMask[index] === 0) continue;
      if (x < width - 1) markBoundary(index, index + 1);
      if (y < height - 1) markBoundary(index, index + width);
    }
  }

  return removeSmallEdgeComponents(edges, width, height, 2);
}

/** 删除长度不足 minSize 的孤立边缘组件 */
function removeSmallEdgeComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minSize: number,
): Uint8Array {
  const result = new Uint8Array(mask);
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] === 1) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component: number[] = [];

    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);

      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const neighborIndex = ny * width + nx;
        if (mask[neighborIndex] === 1 && visited[neighborIndex] === 0) {
          visited[neighborIndex] = 1;
          queue[tail++] = neighborIndex;
        }
      }
    }

    if (component.length < minSize) {
      for (const index of component) {
        result[index] = 0;
      }
    }
  }

  return result;
}

/** 最近邻放大到指定尺寸；JPEG 会先铺白色背景 */
function renderCanvas(
  lowCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  flattenBackground: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建输出 Canvas');

  if (flattenBackground) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(lowCanvas, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片编码失败'));
      },
      mimeType,
      quality,
    );
  });
}

function nearestCenterIndex(
  l: number,
  a: number,
  b: number,
  centers: LabColor[],
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < centers.length; index += 1) {
    const center = centers[index];
    const dl = l - center.l;
    const da = a - center.a;
    const db = b - center.b;
    const distance = dl * dl + da * da + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function nearestCenterDistance(
  color: LabColor,
  centers: LabColor[],
): number {
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const center of centers) {
    const dl = color.l - center.l;
    const da = color.a - center.a;
    const db = color.b - center.b;
    bestDistance = Math.min(bestDistance, dl * dl + da * da + db * db);
  }

  return bestDistance;
}

/** 同时返回最近和次近的色板，用于抖动 */
function nearestTwoCenters(
  l: number,
  a: number,
  b: number,
  centers: LabColor[],
): {
  first: number;
  second: number;
  firstDistance: number;
  secondDistance: number;
} {
  let first = 0;
  let second = -1;
  let firstDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < centers.length; index += 1) {
    const center = centers[index];
    const dl = l - center.l;
    const da = a - center.a;
    const db = b - center.b;
    const distance = dl * dl + da * da + db * db;

    if (distance < firstDistance) {
      secondDistance = firstDistance;
      second = first;
      firstDistance = distance;
      first = index;
    } else if (distance < secondDistance) {
      secondDistance = distance;
      second = index;
    }
  }

  return { first, second, firstDistance, secondDistance };
}

// ---------- 颜色转换工具 ----------

function rgbToLab(red: number, green: number, blue: number): LabColor {
  const r = srgbToLinear(red / 255);
  const g = srgbToLinear(green / 255);
  const b = srgbToLinear(blue / 255);

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const fx = xyzPivot(x);
  const fy = xyzPivot(y);
  const fz = xyzPivot(z);

  return {
    l: Math.max(0, 116 * fy - 16),
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToRgb(l: number, a: number, b: number): Rgb {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const x = 0.95047 * xyzPivotInverse(fx);
  const y = 1 * xyzPivotInverse(fy);
  const z = 1.08883 * xyzPivotInverse(fz);

  const r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const blue = x * 0.0557 + y * -0.204 + z * 1.057;

  return [
    clampByte(linearToSrgb(r) * 255),
    clampByte(linearToSrgb(g) * 255),
    clampByte(linearToSrgb(blue) * 255),
  ];
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function srgbToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

function xyzPivot(value: number): number {
  return value > 0.008856
    ? Math.cbrt(value)
    : 7.787 * value + 16 / 116;
}

function xyzPivotInverse(value: number): number {
  const cube = value ** 3;
  return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
