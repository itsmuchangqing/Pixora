import {
  ASSET_CATEGORY_OPTIONS,
  COLOR_COUNT_OPTIONS,
  DEFAULT_ASSET_CATEGORY,
  DEFAULT_SETTINGS,
  FORMAT_OPTIONS,
  PIXEL_SIZE_MAX,
  PIXEL_SIZE_MIN,
  PRESET_OPTIONS,
  SIZING_MODE_OPTIONS,
  TARGET_RESOLUTION_OPTIONS,
} from '../models/pixel-options';
import type {
  AssetCategoryId,
  BackgroundMode,
  ColorCount,
  ExportFormat,
  OutlineMode,
  PixelSettings,
  PresetId,
  SizingMode,
  StudioMode,
  TargetResolution,
} from '../models/pixel';

/**
 * 工作台偏好持久化。
 * ------------------------------------------------------------
 * 只保存可公开的界面设置，不保存图片或处理结果。
 * 读取时会逐项校验，避免旧版本或手工修改的 localStorage
 * 把页面状态注入成非法值。
 */
export interface StudioPreferences {
  settings: PixelSettings;
  mode: StudioMode;
  assetCategory: AssetCategoryId;
  /** 素材模式下载时使用白底还是透明底 */
  backgroundMode: BackgroundMode;
}

const STORAGE_KEY = 'pixora:studio-preferences:v1';

const PRESET_IDS = PRESET_OPTIONS.map((option) => option.id);
const FORMAT_IDS = FORMAT_OPTIONS.map((option) => option.value);
const CATEGORY_IDS = ASSET_CATEGORY_OPTIONS.map((option) => option.id);
const COLOR_COUNTS = COLOR_COUNT_OPTIONS.map((option) => option.value);
const SIZING_MODES = SIZING_MODE_OPTIONS.map((option) => option.value);
const TARGET_RESOLUTIONS = TARGET_RESOLUTION_OPTIONS.map(
  (option) => option.value,
);

export const DEFAULT_PREFERENCES: StudioPreferences = {
  settings: { ...DEFAULT_SETTINGS },
  mode: 'image',
  assetCategory: DEFAULT_ASSET_CATEGORY,
  backgroundMode: 'white',
};

/** 从浏览器存储中读取上一次的工作台设置 */
export function loadStudioPreferences(): StudioPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return normalizeStudioPreferences(JSON.parse(raw) as unknown);
  } catch {
    return cloneDefaults();
  }
}

/**
 * 校验外部来源的设置对象。
 * localStorage 与分享链接都走同一套规则，避免手工构造的 URL
 * 把非法参数注入界面。
 */
export function normalizeStudioPreferences(
  parsed: unknown,
): StudioPreferences {
  if (!isRecord(parsed)) return cloneDefaults();

  const settingsSource = isRecord(parsed.settings)
    ? parsed.settings
    : {};
  const settings: PixelSettings = {
    pixelSize: clampPixelSize(settingsSource.pixelSize),
    preset: pick(
      settingsSource.preset,
      PRESET_IDS,
      DEFAULT_SETTINGS.preset,
    ) as PresetId,
    format: pick(
      settingsSource.format,
      FORMAT_IDS,
      DEFAULT_SETTINGS.format,
    ) as ExportFormat,
    colorCount: pick(
      settingsSource.colorCount,
      COLOR_COUNTS,
      DEFAULT_SETTINGS.colorCount,
    ) as ColorCount,
    dither:
      typeof settingsSource.dither === 'boolean'
        ? settingsSource.dither
        : DEFAULT_SETTINGS.dither,
    outlineMode: pick(
      settingsSource.outlineMode,
      ['none', 'standard', 'selout'] as const,
      DEFAULT_SETTINGS.outlineMode,
    ) as OutlineMode,
    macroDetail:
      typeof settingsSource.macroDetail === 'boolean'
        ? settingsSource.macroDetail
        : DEFAULT_SETTINGS.macroDetail,
    sizingMode: pick(
      settingsSource.sizingMode,
      SIZING_MODES,
      DEFAULT_SETTINGS.sizingMode,
    ) as SizingMode,
    targetResolution: pick(
      settingsSource.targetResolution,
      TARGET_RESOLUTIONS,
      DEFAULT_SETTINGS.targetResolution,
    ) as TargetResolution,
  };

  // 旧版本有独立的 dragon 分类，迁移到合并后的 monster。
  const storedCategory =
    parsed.assetCategory === 'dragon'
      ? 'monster'
      : parsed.assetCategory;

  return {
    settings,
    mode: pick(
      parsed.mode,
      ['image', 'asset'] as const,
      DEFAULT_PREFERENCES.mode,
    ) as StudioMode,
    assetCategory: pick(
      storedCategory,
      CATEGORY_IDS,
      DEFAULT_ASSET_CATEGORY,
    ) as AssetCategoryId,
    backgroundMode: pick(
      parsed.backgroundMode,
      ['white', 'transparent'] as const,
      DEFAULT_PREFERENCES.backgroundMode,
    ) as BackgroundMode,
  };
}

/** 保存最近一次设置；失败时静默降级，不影响主流程 */
export function saveStudioPreferences(preferences: StudioPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // 隐私模式、存储配额满或被禁用时忽略即可。
  }
}

function cloneDefaults(): StudioPreferences {
  return {
    settings: { ...DEFAULT_SETTINGS },
    mode: DEFAULT_PREFERENCES.mode,
    assetCategory: DEFAULT_PREFERENCES.assetCategory,
    backgroundMode: DEFAULT_PREFERENCES.backgroundMode,
  };
}

function clampPixelSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.pixelSize;
  }

  return Math.max(PIXEL_SIZE_MIN, Math.min(PIXEL_SIZE_MAX, Math.round(value)));
}

function pick<T>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
