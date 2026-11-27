/**
 * 前后端共享的“领域类型”定义。
 * 把这些字符串写成联合类型，而不是普通 string，
 * 能让 TypeScript 提前发现拼写错误，也能让编辑器自动补全。
 */
export type PresetId =
  | 'classic'
  | 'mosaic'
  | 'poster'
  | 'soft'
  | 'mono';
export type ExportFormat = 'png' | 'jpg' | 'webp';

/** 限制最终像素画使用的颜色总数 */
export type ColorCount = 8 | 16 | 32 | 64;

/** 按颗粒大小，或直接指定输出尺寸 */
export type SizingMode = 'pixel' | 'resolution';

/** 目标分辨率模式下的长边像素数 */
export type TargetResolution = 32 | 64 | 128 | 256 | 512;

/** 轮廓关闭、标准深色描边，或沿暗部边缘的 Selout */
export type OutlineMode = 'none' | 'standard' | 'selout';

/**
 * 工作台的两种创作模式：
 * - image：把整张照片或插画做成像素画
 * - asset：把树木、石头、角色等单个素材做成游戏用像素资产
 */
export type StudioMode = 'image' | 'asset';

/** 素材工坊支持的素材归类，覆盖 JRPG 常见的自然、角色、装备与世界物件 */
export type AssetCategoryId =
  | 'tree'
  | 'rock'
  | 'character'
  | 'weapon'
  | 'armor'
  | 'monster'
  | 'item'
  | 'building'
  | 'terrain'
  | 'decoration'
  | 'food'
  | 'custom';

export interface PixelSettings {
  /** 像素块大小，数值越大，颗粒越粗 */
  pixelSize: number;
  preset: PresetId;
  format: ExportFormat;
  /** 最多保留多少种颜色 */
  colorCount: ColorCount;
  /** 是否用有序抖动模拟渐变色阶 */
  dither: boolean;
  /** 轮廓样式，默认关闭 */
  outlineMode: OutlineMode;
  /** 边缘宏块是否继续拆成 2×2 微像素 */
  macroDetail: boolean;
  /** 按颗粒大小或目标分辨率导出 */
  sizingMode: SizingMode;
  /** 目标分辨率模式的长边尺寸 */
  targetResolution: TargetResolution;
}

/** 当前画布中展示的图片信息（可能是示例图或用户上传图） */
export interface DisplayImage {
  src: string;
  name: string;
  width: number;
  height: number;
  size: number;
  isDemo: boolean;
}

/** 低分辨率像素网格，预览、手绘、调色板和多尺寸导出共用同一份数据 */
export interface PixelGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** 从当前像素提取的色板，按出现频率排序 */
  palette: string[];
}

/** 批量队列中每张图片的处理状态 */
export type StudioItemStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'error';

/** 批量素材队列中的一项 */
export interface StudioItem {
  id: string;
  /** 当前源图名称，旋转裁剪后仍沿用原始名称 */
  name: string;
  /** 用户最初选择的文件名，用于“恢复原图” */
  originalName: string;
  /** 当前源图的 blob URL；裁剪、旋转后会替换 */
  sourceUrl: string;
  /** 当前源图 Blob，用于本地保存和再次编辑 */
  sourceBlob: Blob | null;
  /** 最初选择的源图 Blob；没有上传（内置示例）时为 null */
  originalBlob: Blob | null;
  width: number;
  height: number;
  size: number;
  isDemo: boolean;
  status: StudioItemStatus;
  error: string;
  /** 当前像素化结果；队列中未处理时为 null */
  grid: PixelGrid | null;
  /** 最近一次自动生成的颜色底图，橡皮擦从这里恢复原色 */
  baseGrid: PixelGrid | null;
  outputWidth: number;
  outputHeight: number;
  /** 是否包含手绘、填充、橡皮或调色板创作 */
  edited: boolean;
}

/** 手绘修正工具 */
export type EditorTool =
  | 'move'
  | 'select'
  | 'brush'
  | 'eraser'
  | 'bucket'
  | 'eyedropper';

/** 画布上当前选中的单个像素块 */
export interface SelectedPixelInfo {
  x: number;
  y: number;
  /** 透明像素没有 HEX */
  hex: string | null;
  transparent: boolean;
}

/** 导出倍率，只影响下载文件，不重新跑像素化 */
export type ExportScale = 1 | 2 | 4;

/** 素材模式的导出底色 */
export type BackgroundMode = 'white' | 'transparent';

/** 后端健康检查的三态，用于顶部状态标签 */
export type ApiStatus = 'checking' | 'online' | 'offline';
