import { computed, onBeforeUnmount, ref } from 'vue';
import type { PixelGrid, StudioItem } from '../models/pixel';
import { clonePixelGrid } from '../utils/pixel-grid';

export interface RestoredItemInput {
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
  baseGrid?: PixelGrid | null;
  outputWidth: number;
  outputHeight: number;
  edited?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_QUEUE_SIZE = 24;

function createItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadImageDimensions(
  objectUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = objectUrl;
  });
}

function validateFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const typeAllowed =
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );

  if (!typeAllowed) {
    return `${file.name}：仅支持 PNG、JPG 或 WEBP`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}：超过 10 MB`;
  }
  return null;
}

/**
 * 批量图片队列（Controller 子模块）。
 * 负责文件校验、object URL 生命周期和当前选中项；
 * 像素化流程仍由 useStudioController 编排。
 */
export function useImageQueue() {
  const items = ref<StudioItem[]>([]);
  const selectedId = ref<string | null>(null);
  const errorMessage = ref('');
  const isLoading = ref(false);

  const selectedItem = computed(
    () =>
      items.value.find((item) => item.id === selectedId.value) ?? null,
  );

  let activeAddRequest = 0;

  function select(id: string): void {
    if (items.value.some((item) => item.id === id)) {
      selectedId.value = id;
    }
  }

  function selectNextAfter(id: string): void {
    const index = items.value.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = items.value[index + 1] ?? items.value[index - 1];
    selectedId.value = next?.id ?? null;
  }

  async function addFiles(files: FileList | File[] | null): Promise<void> {
    const incoming = files ? Array.from(files) : [];
    if (incoming.length === 0) return;

    const available = Math.max(0, MAX_QUEUE_SIZE - items.value.length);
    if (available === 0) {
      errorMessage.value = `一次最多处理 ${MAX_QUEUE_SIZE} 张图片，请先移除队列中的项目。`;
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';
    const currentRequest = ++activeAddRequest;
    const accepted = incoming.slice(0, available);
    const errors: string[] = [];

    if (incoming.length > available) {
      errors.push(
        `队列最多 ${MAX_QUEUE_SIZE} 张，已忽略多余的 ${incoming.length - available} 张。`,
      );
    }

    const created: StudioItem[] = [];

    for (const file of accepted) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      try {
        const dimensions = await loadImageDimensions(objectUrl);
        if (currentRequest !== activeAddRequest) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        created.push({
          id: createItemId(),
          name: file.name,
          originalName: file.name,
          sourceUrl: objectUrl,
          sourceBlob: file,
          originalBlob: file,
          width: dimensions.width,
          height: dimensions.height,
          size: file.size,
          isDemo: false,
          status: 'queued',
          error: '',
          grid: null,
          baseGrid: null,
          outputWidth: dimensions.width,
          outputHeight: dimensions.height,
          edited: false,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        errors.push(`${file.name}：图片读取失败`);
      }
    }

    if (currentRequest === activeAddRequest) {
      if (created.length > 0) {
        items.value.push(...created);
        selectedId.value = created[0]!.id;
      }
      errorMessage.value = errors.join('；');
      isLoading.value = false;
    }
  }

  function remove(id: string): void {
    const target = items.value.find((item) => item.id === id);
    if (!target) return;

    if (target.sourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(target.sourceUrl);
    }
    if (selectedId.value === id) {
      selectNextAfter(id);
    }
    items.value = items.value.filter((item) => item.id !== id);
  }

  function clear(): void {
    for (const item of items.value) {
      if (item.sourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.sourceUrl);
      }
    }
    items.value = [];
    selectedId.value = null;
    errorMessage.value = '';
  }

  /** 从 IndexedDB 草稿或项目恢复队列，保留已经生成好的像素网格 */
  function restoreItems(
    entries: RestoredItemInput[],
    preferredSelectedId?: string | null,
  ): void {
    clear();
    const restored: StudioItem[] = entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      originalName: entry.originalName,
      sourceUrl: URL.createObjectURL(entry.sourceBlob),
      sourceBlob: entry.sourceBlob,
      originalBlob: entry.originalBlob,
      width: entry.width,
      height: entry.height,
      size: entry.size,
      isDemo: entry.isDemo,
      status: entry.grid ? 'ready' : 'queued',
      error: '',
      grid: entry.grid
        ? {
            width: entry.grid.width,
            height: entry.grid.height,
            data: new Uint8ClampedArray(entry.grid.data),
            palette: [...entry.grid.palette],
          }
        : null,
      // 旧项目没有保存底图时，用当前网格兜底，避免橡皮擦退化为透明擦除。
      baseGrid: clonePixelGrid(entry.baseGrid ?? entry.grid),
      outputWidth: entry.outputWidth,
      outputHeight: entry.outputHeight,
      edited: entry.edited ?? false,
    }));

    items.value = restored;
    selectedId.value =
      preferredSelectedId &&
      restored.some((item) => item.id === preferredSelectedId)
        ? preferredSelectedId
        : (restored[0]?.id ?? null);
  }

  /** 旋转、翻转、裁剪后的新源图替换旧源图 */
  function replaceSource(
    id: string,
    source: {
      blob: Blob;
      width: number;
      height: number;
      name?: string;
    },
  ): StudioItem | null {
    const item = items.value.find((entry) => entry.id === id);
    if (!item) return null;

    if (item.sourceUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.sourceUrl);
    }

    const objectUrl = URL.createObjectURL(source.blob);
    item.sourceUrl = objectUrl;
    item.sourceBlob = source.blob;
    item.width = source.width;
    item.height = source.height;
    item.size = source.blob.size;
    if (source.name) item.name = source.name;
    item.status = 'queued';
    item.error = '';
    item.grid = null;
    item.baseGrid = null;
    item.outputWidth = source.width;
    item.outputHeight = source.height;
    item.edited = false;
    return item;
  }

  onBeforeUnmount(() => {
    activeAddRequest += 1;
    clear();
  });

  return {
    items,
    selectedId,
    selectedItem,
    errorMessage,
    isLoading,
    acceptedTypes: ACCEPTED_TYPES.join(','),
    maxQueueSize: MAX_QUEUE_SIZE,
    addFiles,
    select,
    remove,
    clear,
    replaceSource,
    restoreItems,
  };
}
