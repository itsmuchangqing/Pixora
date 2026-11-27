import type {
  AssetCategoryId,
  ColorCount,
  ExportFormat,
  OutlineMode,
  PixelSettings,
  PresetId,
  SizingMode,
  TargetResolution,
} from './pixel';

/**
 * 界面选项数据
 * ------------------------------------------------------------
 * 目前为了前端可以独立运行，选项先写在这里。
 * 后端的 GET /api/pixelate/options 已预留同类数据，
 * 之后可以改成接口动态读取，界面结构不需要变。
 */
export interface PresetOption {
  id: PresetId;
  label: string;
  caption: string;
  colors: readonly string[];
}

export interface AssetCategoryOption {
  id: AssetCategoryId;
  label: string;
  caption: string;
}

export const DEFAULT_SETTINGS: PixelSettings = {
  pixelSize: 16,
  preset: 'classic',
  format: 'png',
  colorCount: 16,
  dither: false,
  outlineMode: 'none',
  macroDetail: false,
  sizingMode: 'pixel',
  targetResolution: 128,
};

/** 色板数量选项：数值越小，复古感越强 */
export const COLOR_COUNT_OPTIONS: readonly {
  value: ColorCount;
  label: string;
}[] = [
  { value: 8, label: '8' },
  { value: 16, label: '16' },
  { value: 32, label: '32' },
  { value: 64, label: '64' },
];

/** 尺寸调节方式：按像素颗粒，或按目标输出分辨率 */
export const SIZING_MODE_OPTIONS: readonly {
  value: SizingMode;
  label: string;
}[] = [
  { value: 'pixel', label: '颗粒' },
  { value: 'resolution', label: '尺寸' },
];

/** 目标分辨率模式的长边像素数 */
export const TARGET_RESOLUTION_OPTIONS: readonly {
  value: TargetResolution;
  label: string;
}[] = [
  { value: 32, label: '32' },
  { value: 64, label: '64' },
  { value: 128, label: '128' },
  { value: 256, label: '256' },
  { value: 512, label: '512' },
];

/**
 * 每个预设最多使用的颜色数量。
 * 海报需要更少色板，其他预设允许用户选到 64 色。
 */
export const PRESET_COLOR_CAPS: Record<PresetId, ColorCount> = {
  classic: 64,
  mosaic: 32,
  poster: 8,
  soft: 64,
  mono: 64,
};

/** 只显示“开启轮廓”之后的两种风格 */
export const OUTLINE_STYLE_OPTIONS: readonly {
  value: OutlineMode;
  label: string;
}[] = [
  { value: 'standard', label: '标准' },
  { value: 'selout', label: 'Selout' },
];

/** 默认落在最常用的“树木”素材类型上 */
export const DEFAULT_ASSET_CATEGORY: AssetCategoryId = 'tree';

export const PIXEL_SIZE_MIN = 1;
export const PIXEL_SIZE_MAX = 64;
export const PIXEL_SIZE_STEP = 1;

export const PRESET_OPTIONS: readonly PresetOption[] = [
  {
    id: 'classic',
    label: '经典像素',
    caption: '量化 · 清晰轮廓',
    colors: ['#2e1065', '#5b21b6', '#8b5cf6', '#c4b5fd', '#fcd34d', '#a78bfa', '#4c1d95', '#ede9fe'],
  },
  {
    id: 'mosaic',
    label: '马赛克',
    caption: '区块均值 · 柔和',
    colors: ['#6d28d9', '#c4b5fd', '#8b5cf6', '#f5f3ff', '#7c3aed', '#ddd6fe', '#4c1d95', '#ede9fe'],
  },
  {
    id: 'poster',
    label: '复古海报',
    caption: '高对比 · 少色板',
    colors: ['#2e1065', '#fcd34d', '#7c3aed', '#fdba74', '#4c1d95', '#fde68a', '#6d28d9', '#fb923c'],
  },
  {
    id: 'soft',
    label: '柔焦颗粒',
    caption: '柔和 · 渐变色阶',
    colors: ['#ddd6fe', '#c4b5fd', '#a78bfa', '#ede9fe', '#f5f3ff', '#e9d5ff', '#d8b4fe', '#f8f5ff'],
  },
  {
    id: 'mono',
    label: '单色氛围',
    caption: '单色 · 明暗色阶',
    colors: ['#151019', '#29222e', '#453b4c', '#655970', '#8a7f95', '#b4abbc', '#dcd6e1', '#f7f3fa'],
  },
];

/**
 * 素材工坊的分类入口。
 * 分类用于界面标注和导出命名；像素画由浏览器本地引擎统一生成。
 */
export const ASSET_CATEGORY_OPTIONS: readonly AssetCategoryOption[] = [
  {
    id: 'tree',
    label: '树木',
    caption: '植被 / 场景',
  },
  {
    id: 'rock',
    label: '石头',
    caption: '岩石 / 地形',
  },
  {
    id: 'character',
    label: '角色',
    caption: '小人 / NPC',
  },
  {
    id: 'weapon',
    label: '武器',
    caption: '剑 / 法杖',
  },
  {
    id: 'armor',
    label: '防具',
    caption: '铠甲 / 护具',
  },
  {
    id: 'monster',
    label: '怪物',
    caption: '敌人 / 巨龙 / Boss',
  },
  {
    id: 'item',
    label: '道具',
    caption: '药水 / 卷轴',
  },
  {
    id: 'building',
    label: '建筑',
    caption: '房屋 / 城堡',
  },
  {
    id: 'terrain',
    label: '地形',
    caption: '道路 / 地面',
  },
  {
    id: 'decoration',
    label: '装饰',
    caption: '旗帜 / 机关',
  },
  {
    id: 'food',
    label: '食物',
    caption: '料理 / 素材',
  },
  {
    id: 'custom',
    label: '自定义',
    caption: '其它素材',
  },
];

export const FORMAT_OPTIONS: readonly {
  value: ExportFormat;
  label: string;
}[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
];
