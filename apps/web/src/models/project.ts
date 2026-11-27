import type {
  AssetCategoryId,
  BackgroundMode,
  ExportScale,
  PixelGrid,
  PixelSettings,
  StudioMode,
} from './pixel';

/** 保存到 IndexedDB 的单个素材；sourceBlob 保证刷新后还能继续 */
export interface SavedProjectItem {
  id: string;
  name: string;
  originalName: string;
  sourceBlob: Blob;
  originalBlob: Blob | null;
  width: number;
  height: number;
  size: number;
  isDemo: boolean;
  grid: PixelGrid | null;
  /** 生成时的原始颜色底图，用于刷新后仍能恢复原色 */
  baseGrid?: PixelGrid | null;
  outputWidth: number;
  outputHeight: number;
  /** 手绘 / 调色板创作标记，打开项目后仍需保护 */
  edited?: boolean;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
  /** 自动保存的草稿不显示在项目列表中 */
  isDraft: boolean;
  thumbnail: Blob | null;
  mode: StudioMode;
  category: AssetCategoryId;
}

export interface ProjectPayload {
  id: string;
  settings: PixelSettings;
  mode: StudioMode;
  assetCategory: AssetCategoryId;
  backgroundMode: BackgroundMode;
  exportScale: ExportScale;
  selectedId: string | null;
  items: SavedProjectItem[];
}

export interface ProjectRecord {
  meta: ProjectMeta;
  payload: ProjectPayload;
}
