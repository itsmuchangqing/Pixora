import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import samplePixelArt from '../assets/sample-pixel-art.png';
import {
  ASSET_CATEGORY_OPTIONS,
  DEFAULT_SETTINGS,
} from '../models/pixel-options';
import type {
  AssetCategoryId,
  BackgroundMode,
  DisplayImage,
  ExportScale,
  PixelSettings,
  SelectedPixelInfo,
  StudioItem,
  StudioMode,
  TargetResolution,
} from '../models/pixel';
import type {
  ProjectMeta,
  ProjectPayload,
  SavedProjectItem,
} from '../models/project';
import {
  generatePixelArt,
  getExportDimensions,
  renderGridAtLongSide,
  renderGridBlob,
  renderGridThumbnail,
} from '../services/pixel-art.service';
import {
  createSpriteSheet,
  createZip,
  downloadBlob,
  sanitizeFileName,
  type NamedBlob,
} from '../services/export.service';
import {
  cropSourceBlob,
  imageFileFromClipboard,
  readClipboardImage,
  readImageDimensions,
  transformSourceBlob,
  type NormalizedCropRect,
  type SourceTransform,
} from '../services/image-edit.service';
import {
  parsePaletteText,
  rgbToHex,
} from '../services/palette.service';
import {
  loadStudioPreferences,
  saveStudioPreferences,
} from '../services/preferences.service';
import {
  deleteDraft,
  deleteProjectRecord,
  listProjectMeta,
  loadDraft,
  loadProjectRecord,
  saveDraft,
  saveProjectRecord,
} from '../services/project.service';
import {
  clearShareHash,
  createShareUrl,
  readSharedStateFromUrl,
} from '../services/share.service';
import { clonePixelGrid } from '../utils/pixel-grid';
import { useApiStatus } from './useApiStatus';
import { useImageQueue } from './useImageQueue';
import { usePixelEditing } from './usePixelEditing';

/**
 * MVC 中的 Controller 层（页面控制器）
 * ------------------------------------------------------------
 * 页面所需的状态、批量处理、图片调整、像素编辑和导出流程都在这里编排。
 * View 组件只从本函数拿数据和动作。
 */
export function useStudioController() {
  const sharedState = readSharedStateFromUrl();
  const initialPreferences =
    sharedState?.preferences ?? loadStudioPreferences();
  if (sharedState) clearShareHash();

  const settings = reactive<PixelSettings>({
    ...initialPreferences.settings,
  });

  const studioMode = ref<StudioMode>(initialPreferences.mode);
  const assetCategory = ref<AssetCategoryId>(
    initialPreferences.assetCategory,
  );
  const backgroundMode = ref<BackgroundMode>(
    initialPreferences.backgroundMode,
  );
  const exportScale = ref<ExportScale>(sharedState?.exportScale ?? 1);

  const isAssetMode = computed(() => studioMode.value === 'asset');
  const assetCategoryLabel = computed(
    () =>
      ASSET_CATEGORY_OPTIONS.find(
        (option) => option.id === assetCategory.value,
      )?.label ?? '自定义',
  );

  const {
    items,
    selectedId,
    selectedItem,
    errorMessage: uploadError,
    isLoading,
    acceptedTypes,
    addFiles,
    select,
    remove,
    clear,
    replaceSource,
    restoreItems,
  } = useImageQueue();

  const pixelEditor = usePixelEditing();
  if (sharedState?.lockedColors.length) {
    pixelEditor.setLockedColors(sharedState.lockedColors);
  }

  const sampleImage: DisplayImage = {
    src: samplePixelArt,
    name: 'sample-pixel-lake.png',
    width: 768,
    height: 768,
    size: 0,
    isDemo: true,
  };

  const displayImage = computed<DisplayImage>(() => {
    const item = selectedItem.value;
    if (!item) return sampleImage;
    return {
      src: item.sourceUrl,
      name: item.name,
      width: item.width,
      height: item.height,
      size: item.size,
      isDemo: false,
    };
  });

  const hasSelection = computed(() => Boolean(selectedItem.value));
  const hasGrid = computed(() =>
    Boolean(selectedItem.value?.grid),
  );
  const grid = computed(() => selectedItem.value?.grid ?? null);
  const paletteColors = computed(
    () => selectedItem.value?.grid?.palette ?? [],
  );
  const lockedColors = computed(() => pixelEditor.lockedColors.value);
  const editorTool = pixelEditor.tool;
  const brushColor = pixelEditor.brushColor;
  const brushSize = pixelEditor.brushSize;
  const showPixelGrid = pixelEditor.showGrid;
  const gridVersion = pixelEditor.gridVersion;
  const selectedPixel = ref<{ x: number; y: number } | null>(null);
  const selectedPixelInfo = computed<SelectedPixelInfo | null>(() => {
    void gridVersion.value;
    const item = selectedItem.value;
    const point = selectedPixel.value;
    if (!item?.grid || !point) return null;

    const { width, height, data } = item.grid;
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= width ||
      point.y >= height
    ) {
      return null;
    }

    const offset = (point.y * width + point.x) * 4;
    const alpha = data[offset + 3] ?? 0;
    return {
      x: point.x,
      y: point.y,
      hex:
        alpha === 0
          ? null
          : rgbToHex({
              red: data[offset] ?? 0,
              green: data[offset + 1] ?? 0,
              blue: data[offset + 2] ?? 0,
            }),
      transparent: alpha === 0,
    };
  });
  const canUndo = computed(() =>
    pixelEditor.canUndoItem(selectedItem.value?.id),
  );
  const canRedo = computed(() =>
    pixelEditor.canRedoItem(selectedItem.value?.id),
  );

  let liveColorEditing = false;
  let liveColorValue: string | null = null;

  watch(selectedId, () => {
    finishLiveColorEdit();
    selectedPixel.value = null;
  });

  watch(editorTool, () => {
    finishLiveColorEdit();
  });

  const isSmallSource = computed(() => {
    const item = selectedItem.value;
    return Boolean(
      item &&
        !item.isDemo &&
        Math.max(item.width, item.height) < 512,
    );
  });

  const isWeaponMode = computed(
    () => isAssetMode.value && assetCategory.value === 'weapon',
  );
  const effectiveColorCount = computed(() =>
    Math.min(
      settings.colorCount,
      settings.preset === 'poster'
        ? 8
        : settings.preset === 'mosaic'
          ? 32
          : 64,
    ),
  );
  const isOutlineEnabled = computed(
    () => settings.outlineMode !== 'none',
  );
  const characterProtectionActive = computed(
    () => isAssetMode.value && assetCategory.value === 'character',
  );

  function toggleOutline() {
    settings.outlineMode = isOutlineEnabled.value ? 'none' : 'standard';
  }

  // ---------- 批量处理：串行执行，避免多个 Worker 同时抢 CPU ----------
  const isProcessing = ref(false);
  const processedCount = ref(0);
  const totalToProcess = ref(0);
  const isTransformingSource = ref(false);
  const isExporting = ref(false);
  const isRestoringProject = ref(false);
  const isProjectLoading = ref(false);
  const savedProjects = ref<ProjectMeta[]>([]);

  interface ProcessingConfigSnapshot {
    settings: PixelSettings;
    mode: StudioMode;
    category: AssetCategoryId;
  }

  interface GuardDialogState {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
  }

  const guardDialog = ref<GuardDialogState | null>(null);
  let guardResolver: ((confirmed: boolean) => void) | null = null;
  let suppressSettingsGuard = false;
  let settingsGuardActive = false;

  function currentProcessingConfig(): ProcessingConfigSnapshot {
    return {
      settings: { ...settings },
      mode: studioMode.value,
      category: assetCategory.value,
    };
  }

  function applyProcessingConfig(
    snapshot: ProcessingConfigSnapshot,
  ): void {
    Object.assign(settings, snapshot.settings);
    studioMode.value = snapshot.mode;
    assetCategory.value = snapshot.category;
  }

  let confirmedProcessingConfig = currentProcessingConfig();

  function requestGuard(
    state: GuardDialogState,
  ): Promise<boolean> {
    if (guardResolver) return Promise.resolve(false);
    guardDialog.value = state;
    return new Promise((resolve) => {
      guardResolver = resolve;
    });
  }

  function settleGuard(confirmed: boolean): void {
    const resolver = guardResolver;
    guardResolver = null;
    guardDialog.value = null;
    resolver?.(confirmed);
  }

  function confirmGuard(): void {
    settleGuard(true);
  }

  function cancelGuard(): void {
    settleGuard(false);
  }

  let processingTimer: ReturnType<typeof setTimeout> | undefined;
  let processingRequest = 0;
  let processingAbort: AbortController | null = null;

  const processingLabel = computed(() => {
    if (totalToProcess.value > 1) {
      return `生成中 ${Math.min(
        processedCount.value + 1,
        totalToProcess.value,
      )}/${totalToProcess.value}`;
    }
    return '生成中';
  });

  function processingOptions() {
    return {
      ...settings,
      mode: studioMode.value,
      characterMode:
        isAssetMode.value && assetCategory.value === 'character',
      weaponMode:
        isAssetMode.value && assetCategory.value === 'weapon',
    };
  }

  function abortProcessing() {
    processingRequest += 1;
    processingAbort?.abort();
    processingAbort = null;
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = undefined;
    }
    for (const item of items.value) {
      if (item.status === 'processing') item.status = 'queued';
    }
    isProcessing.value = false;
  }

  /** 只处理排队中的项目；参数变化时会把所有项目重新标记为排队 */
  function schedulePendingProcessing() {
    if (processingTimer) clearTimeout(processingTimer);
    processingAbort?.abort();
    processingAbort = null;
    const requestId = ++processingRequest;

    // 上一轮正在处理的项目重新放回队列，避免中止后永远停在 processing。
    for (const item of items.value) {
      if (item.status === 'processing') item.status = 'queued';
    }

    const targets = items.value.filter(
      (item) => item.status === 'queued',
    );
    if (targets.length === 0) {
      isProcessing.value = false;
      processedCount.value = 0;
      totalToProcess.value = 0;
      return;
    }

    isProcessing.value = true;
    processedCount.value = 0;
    totalToProcess.value = targets.length;

    processingTimer = setTimeout(() => {
      void runProcessingQueue(requestId);
    }, 220);
  }

  async function runProcessingQueue(requestId: number) {
    if (requestId !== processingRequest) return;
    const abortController = new AbortController();
    processingAbort = abortController;

    while (true) {
      if (requestId !== processingRequest) return;
      const item = items.value.find(
        (entry) => entry.status === 'queued',
      );
      if (!item) break;

      item.status = 'processing';
      item.error = '';

      try {
        const result = await generatePixelArt(
          item.sourceUrl,
          processingOptions(),
          abortController.signal,
        );
        if (requestId !== processingRequest) return;

        item.grid = result.grid;
        item.baseGrid = clonePixelGrid(result.grid);
        item.outputWidth = result.outputWidth;
        item.outputHeight = result.outputHeight;
        item.status = 'ready';
        item.edited = false;
        if (item.id === selectedId.value) {
          selectedPixel.value = null;
        }
        processedCount.value += 1;
        pixelEditor.resetHistory(item.id);
      } catch (error) {
        if (
          abortController.signal.aborted ||
          requestId !== processingRequest
        ) {
          return;
        }

        item.status = 'error';
        item.error =
          error instanceof Error ? error.message : '像素化失败';
        processedCount.value += 1;
        console.error('[Pixora] 像素画生成失败', item.name, error);
      }
    }

    if (requestId === processingRequest) {
      isProcessing.value = false;
      processingAbort = null;
      const failed = items.value.find((item) => item.status === 'error');
      if (failed) {
        notify(`${failed.name} 生成失败，可在队列中重试。`);
      }
    }
  }

  function invalidateAllItems() {
    selectedPixel.value = null;
    for (const item of items.value) {
      item.status = 'queued';
      item.error = '';
      item.edited = false;
      pixelEditor.resetHistory(item.id);
    }
  }

  async function handleProcessingSettingsChange(): Promise<void> {
    if (suppressSettingsGuard || isRestoringProject.value) return;
    if (settingsGuardActive) return;

    const editedItems = items.value.filter((item) => item.edited);
    if (items.value.length > 0 && editedItems.length > 0) {
      settingsGuardActive = true;
      const confirmed = await requestGuard({
        title: '重新生成会覆盖手绘修改',
        message: `队列中有 ${editedItems.length} 张素材包含手绘或调色板修改。继续修改尺寸、预设、轮廓或其他生成参数，会重新生成底图并丢失这些修改。可以先取消，保存项目或导出当前结果。`,
        confirmLabel: '继续并重新生成',
      });
      settingsGuardActive = false;

      if (!confirmed) {
        suppressSettingsGuard = true;
        applyProcessingConfig(confirmedProcessingConfig);
        await nextTick();
        suppressSettingsGuard = false;
        return;
      }
    }

    confirmedProcessingConfig = currentProcessingConfig();

    if (items.value.length === 0) {
      abortProcessing();
      return;
    }

    invalidateAllItems();
    schedulePendingProcessing();
  }

  watch(
    () =>
      [
        settings.pixelSize,
        settings.preset,
        settings.colorCount,
        settings.dither,
        settings.outlineMode,
        settings.macroDetail,
        settings.sizingMode,
        settings.targetResolution,
        studioMode.value,
        assetCategory.value,
      ] as const,
    () => {
      void handleProcessingSettingsChange();
    },
    { immediate: true },
  );

  // 新增、移除或更换源图时只处理状态为 queued 的项目。
  watch(
    () =>
      items.value
        .map((item) => `${item.id}:${item.sourceUrl}`)
        .join('|'),
    () => {
      if (isRestoringProject.value) return;
      if (items.value.length === 0) {
        abortProcessing();
        return;
      }
      schedulePendingProcessing();
    },
    { immediate: true },
  );

  // 参数只是导出选项，不触发重新计算。
  const currentExportDimensions = computed(() => {
    const item = selectedItem.value;
    if (!item?.grid) return null;
    return getExportDimensions(
      item.outputWidth,
      item.outputHeight,
      exportScale.value,
    );
  });

  const processedSize = computed(() => currentExportDimensions.value);

  const selectedSourceEdited = computed(() => {
    const item = selectedItem.value;
    return Boolean(
      item?.originalBlob &&
        item.sourceBlob &&
        item.sourceBlob !== item.originalBlob,
    );
  });

  const canExport = computed(
    () =>
      Boolean(selectedItem.value?.grid) &&
      !isProcessing.value &&
      !isExporting.value,
  );

  const readyItems = computed(() =>
    items.value.filter(
      (item): item is StudioItem & { grid: NonNullable<StudioItem['grid']> } =>
        Boolean(item.grid) && item.status === 'ready',
    ),
  );

  const editedItemCount = computed(
    () => items.value.filter((item) => item.edited).length,
  );
  const selectedItemEdited = computed(
    () => Boolean(selectedItem.value?.edited),
  );

  // ---------- API 状态 ----------
  const { status: apiStatus, refresh: refreshApiStatus } = useApiStatus();
  const apiStatusLabel = computed(() => {
    if (apiStatus.value === 'online') return 'API 已连接';
    if (apiStatus.value === 'offline') return '本地模式';
    return '正在连接 API';
  });

  // ---------- Toast ----------
  const toastMessage = ref('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function notify(message: string) {
    toastMessage.value = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage.value = '';
    }, 4000);
  }

  function dismissToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage.value = '';
  }

  // ---------- 文件、示例与队列 ----------
  function handleFilesSelected(files: FileList | File[]) {
    void addFiles(files);
  }

  function handleSelectItem(id: string) {
    select(id);
  }

  async function handleRemoveItem(id: string): Promise<void> {
    const item = items.value.find((entry) => entry.id === id);
    if (!item) return;

    if (item.edited) {
      const confirmed = await requestGuard({
        title: '移除会丢弃手绘修改',
        message: `「${item.name}」包含手绘或调色板修改。移除这张素材后，这些修改无法恢复。`,
        confirmLabel: '仍然移除',
      });
      if (!confirmed) return;
    }

    remove(id);
    pixelEditor.resetHistory(id);
  }

  async function handleClearQueue(): Promise<void> {
    const editedCount = items.value.filter((item) => item.edited).length;
    if (editedCount > 0) {
      const confirmed = await requestGuard({
        title: '清空队列会丢弃手绘修改',
        message: `队列中有 ${editedCount} 张素材包含手绘或调色板修改。清空后这些修改无法恢复。`,
        confirmLabel: '仍然清空',
      });
      if (!confirmed) return;
    }

    abortProcessing();
    clear();
    pixelEditor.resetHistory();
    notify('批量队列已清空。');
  }

  async function handleRetryItem(id: string): Promise<void> {
    const item = items.value.find((entry) => entry.id === id);
    if (!item) return;
    if (item.edited) {
      const confirmed = await requestGuard({
        title: '重试会重新生成底图',
        message: `「${item.name}」包含手绘或调色板修改。重新生成会覆盖这些修改。`,
        confirmLabel: '仍然重试',
      });
      if (!confirmed) return;
    }
    item.status = 'queued';
    item.error = '';
    item.edited = false;
    schedulePendingProcessing();
  }

  // ---------- 源图调整 ----------
  async function sourceBlobFor(item: StudioItem): Promise<Blob> {
    if (item.sourceBlob) return item.sourceBlob;
    const response = await fetch(item.sourceUrl);
    if (!response.ok) throw new Error('读取源图失败');
    return response.blob();
  }

  async function applySourceEdit(
    action: (blob: Blob) => Promise<{
      blob: Blob;
      width: number;
      height: number;
      name?: string;
    }>,
    successMessage: string,
  ) {
    const item = selectedItem.value;
    if (!item) {
      notify('请先选择一张图片。');
      return;
    }
    if (isTransformingSource.value) return;

    if (item.edited) {
      const confirmed = await requestGuard({
        title: '调整图片会覆盖手绘修改',
        message: `「${item.name}」包含手绘或调色板修改。裁剪、旋转或翻转图片会重新生成底图并丢失这些修改。`,
        confirmLabel: '继续调整图片',
      });
      if (!confirmed) return;
    }

    isTransformingSource.value = true;
    try {
      const source = await sourceBlobFor(item);
      // 内置示例第一次被调整时，把当前源图记为“原图”，
      // 这样示例素材也支持恢复，而不是只能恢复用户上传的文件。
      if (!item.originalBlob) item.originalBlob = source;
      const result = await action(source);
      replaceSource(item.id, result);
      selectedPixel.value = null;
      pixelEditor.resetHistory(item.id);
      notify(successMessage);
    } catch (error) {
      console.error('[Pixora] 图片调整失败', error);
      notify('图片调整失败，请重试。');
    } finally {
      isTransformingSource.value = false;
    }
  }

  function handleRotate(direction: 'left' | 'right') {
    const transform: SourceTransform =
      direction === 'left' ? 'rotate-left' : 'rotate-right';
    void applySourceEdit(
      (blob) => transformSourceBlob(blob, transform),
      direction === 'left' ? '已向左旋转 90°。' : '已向右旋转 90°。',
    );
  }

  function handleFlip(direction: 'horizontal' | 'vertical') {
    const transform: SourceTransform =
      direction === 'horizontal'
        ? 'flip-horizontal'
        : 'flip-vertical';
    void applySourceEdit(
      (blob) => transformSourceBlob(blob, transform),
      direction === 'horizontal' ? '已水平翻转。' : '已垂直翻转。',
    );
  }

  function handleCrop(rect: NormalizedCropRect) {
    void applySourceEdit(
      (blob) => cropSourceBlob(blob, rect),
      '已应用裁剪。',
    );
  }

  async function handleRestoreOriginal() {
    const item = selectedItem.value;
    if (!item?.originalBlob) {
      notify('当前图片没有可恢复的原始文件。');
      return;
    }
    if (isTransformingSource.value) return;

    if (item.edited) {
      const confirmed = await requestGuard({
        title: '恢复原图会覆盖手绘修改',
        message: `「${item.name}」包含手绘或调色板修改。恢复原图后会重新生成底图并丢失这些修改。`,
        confirmLabel: '仍然恢复原图',
      });
      if (!confirmed) return;
    }

    isTransformingSource.value = true;
    try {
      const dimensions = await readImageDimensions(item.originalBlob);
      replaceSource(item.id, {
        blob: item.originalBlob,
        width: dimensions.width,
        height: dimensions.height,
        name: item.originalName,
      });
      selectedPixel.value = null;
      pixelEditor.resetHistory(item.id);
      notify('已恢复原始图片。');
    } catch {
      notify('恢复原图失败。');
    } finally {
      isTransformingSource.value = false;
    }
  }

  async function handlePasteButton() {
    const file = await readClipboardImage();
    if (!file) {
      notify('没有读到剪贴板图片，也可以直接按 Ctrl+V。');
      return;
    }
    await addFiles([file]);
    notify('已从剪贴板加入一张图片。');
  }

  function handleWindowPaste(event: ClipboardEvent) {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, select, [contenteditable="true"]',
      )
    ) {
      return;
    }

    const file = imageFileFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    void addFiles([file]).then(() => {
      notify('已从剪贴板加入一张图片。');
    });
  }

  // ---------- 手绘与调色板 ----------
  let lastPaintPoint: { x: number; y: number } | null = null;
  let strokeActive = false;

  function handleEditorStart(x: number, y: number) {
    const item = selectedItem.value;
    if (!item?.grid) return;

    const tool = pixelEditor.tool.value;
    if (tool === 'move') return;

    if (tool === 'select') {
      finishLiveColorEdit();
      const color = pixelEditor.sampleColor(item, x, y);
      selectedPixel.value = { x, y };
      if (color) pixelEditor.setBrushColor(color);
      return;
    }

    if (tool === 'eyedropper') {
      const color = pixelEditor.sampleColor(item, x, y);
      if (color) {
        pixelEditor.setBrushColor(color);
        notify(`已吸取颜色 ${color}。`);
      }
      return;
    }

    if (tool === 'bucket') {
      if (!pixelEditor.beginStroke(item)) return;
      if (pixelEditor.bucketFill(item, x, y)) {
        item.edited = true;
      }
      pixelEditor.syncPalette(item);
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      if (!pixelEditor.beginStroke(item)) return;
      strokeActive = true;
      lastPaintPoint = { x, y };
      if (pixelEditor.paint(item, x, y, tool === 'eraser')) {
        item.edited = true;
      }
    }
  }

  function handleEditorMove(x: number, y: number) {
    const item = selectedItem.value;
    if (!item?.grid || !strokeActive) return;

    const tool = pixelEditor.tool.value;
    if (tool !== 'brush' && tool !== 'eraser') return;

    const previous = lastPaintPoint ?? { x, y };
    const distance = Math.max(
      Math.abs(x - previous.x),
      Math.abs(y - previous.y),
    );
    if (distance === 0) return;

    let changed = false;
    for (let step = 1; step <= distance; step += 1) {
      const pointX = Math.round(
        previous.x + ((x - previous.x) * step) / distance,
      );
      const pointY = Math.round(
        previous.y + ((y - previous.y) * step) / distance,
      );
      if (pixelEditor.paint(item, pointX, pointY, tool === 'eraser')) {
        changed = true;
      }
    }
    if (changed) item.edited = true;
    lastPaintPoint = { x, y };
  }

  function handleEditorEnd() {
    const item = selectedItem.value;
    if (strokeActive && item?.grid) {
      pixelEditor.syncPalette(item);
    }
    strokeActive = false;
    lastPaintPoint = null;
  }

  function handleUndo() {
    if (isProcessing.value) return;
    finishLiveColorEdit();
    const item = selectedItem.value;
    if (!item || !pixelEditor.undo(item)) return;
    item.edited = pixelEditor.canUndoItem(item.id);
    pixelEditor.syncPalette(item);
  }

  function handleRedo() {
    if (isProcessing.value) return;
    finishLiveColorEdit();
    const item = selectedItem.value;
    if (!item || !pixelEditor.redo(item)) return;
    item.edited = true;
    pixelEditor.syncPalette(item);
  }

  function handlePaletteColorChange(from: string, to: string) {
    const item = selectedItem.value;
    if (!item) return;
    if (pixelEditor.lockedColors.value.has(from)) {
      notify('这个颜色已锁定，先解锁才能修改。');
      return;
    }
    if (pixelEditor.changePaletteColor(item, from, to)) {
      item.edited = true;
      notify('已替换画面中的该颜色。');
    }
  }

  function handlePaletteLock(color: string) {
    pixelEditor.toggleLock(color);
  }

  async function handleImportPalette(file: File) {
    const item = selectedItem.value;
    if (!item?.grid) {
      notify('请先上传并生成一张图片。');
      return;
    }

    if (file.size > 512 * 1024) {
      notify('色板文件过大，请使用小于 512 KB 的文本色板。');
      return;
    }

    try {
      const text = await file.text();
      const colors = parsePaletteText(text);
      if (colors.length === 0) {
        notify('没有识别到颜色，支持 .hex / .pal / .txt。');
        return;
      }

      const changed = pixelEditor.importPalette(item, colors);
      if (changed > 0) {
        item.edited = true;
        notify(`已匹配到 ${colors.length} 色色板，修改了 ${changed} 个像素。`);
      } else {
        notify('当前画面已经符合这个色板。');
      }
    } catch {
      notify('色板读取失败。');
    }
  }

  function handleTogglePixelGrid() {
    pixelEditor.toggleGrid();
  }

  function handleClearSelectedPixel() {
    finishLiveColorEdit();
    selectedPixel.value = null;
  }

  /**
   * 结束一次原生颜色选择器的拖动。
   * 拖动过程中只预览；这里集中刷新色板并同步画笔颜色，
   * 整次拖动只占一个撤销步骤。
   */
  function finishLiveColorEdit() {
    if (!liveColorEditing) return;
    const finalColor = liveColorValue;
    liveColorEditing = false;
    liveColorValue = null;
    const item = selectedItem.value;
    pixelEditor.finishPixelColorPreview(item);
    if (item && finalColor) {
      item.edited = true;
      pixelEditor.setBrushColor(finalColor);
    }
  }

  /** 颜色选择器拖动时实时应用，不重复写入历史 */
  function handlePreviewSelectedPixelColor(colorHex: string) {
    if (isProcessing.value) return;
    const item = selectedItem.value;
    const point = selectedPixel.value;
    if (!item?.grid || !point) return;

    const current = selectedPixelInfo.value;
    if (
      !liveColorEditing &&
      current &&
      !current.transparent &&
      current.hex?.toLowerCase() === colorHex.toLowerCase()
    ) {
      return;
    }

    if (!liveColorEditing) {
      if (!pixelEditor.beginStroke(item)) return;
      liveColorEditing = true;
    }

    liveColorValue = colorHex;
    if (pixelEditor.previewPixelColor(item, point.x, point.y, colorHex)) {
      item.edited = true;
    }
  }

  function handleChangeSelectedPixelColor(colorHex: string) {
    if (isProcessing.value) return;
    const wasLive = liveColorEditing;
    finishLiveColorEdit();

    const item = selectedItem.value;
    const point = selectedPixel.value;
    if (!item?.grid || !point) return;

    if (pixelEditor.setPixelColor(item, point.x, point.y, colorHex)) {
      item.edited = true;
      pixelEditor.setBrushColor(colorHex);
      notify('已修改选中像素。');
    } else if (wasLive) {
      // 拖动期间已经应用了最终颜色，这里只同步画笔颜色。
      pixelEditor.setBrushColor(colorHex);
    }
  }

  // ---------- 导出 ----------
  function flattenBackground(format = settings.format): boolean {
    if (format === 'jpg') return true;
    return isAssetMode.value && backgroundMode.value === 'white';
  }

  function uniqueFileName(
    item: StudioItem,
    width: number,
    height: number,
    used: Set<string>,
  ): string {
    const prefix = isAssetMode.value
      ? `asset-${assetCategory.value}`
      : 'art';
    const base = sanitizeFileName(item.name, 'image');
    const stem = `pixora-${prefix}-${base}-${width}x${height}`;
    let candidate = `${stem}.${settings.format}`;
    let index = 2;
    while (used.has(candidate)) {
      candidate = `${stem}-${index}.${settings.format}`;
      index += 1;
    }
    used.add(candidate);
    return candidate;
  }

  async function handleExport() {
    const item = selectedItem.value;
    if (!item?.grid) {
      notify('请先上传图片并等待像素画生成。');
      return;
    }
    if (isProcessing.value) {
      notify('像素画还在生成，请稍候再导出。');
      return;
    }

    isExporting.value = true;
    try {
      const rendered = await renderGridBlob(
        item.grid,
        item.outputWidth,
        item.outputHeight,
        {
          format: settings.format,
          flattenBackground: flattenBackground(),
          scale: exportScale.value,
        },
      );
      const name = uniqueFileName(
        item,
        rendered.width,
        rendered.height,
        new Set(),
      );
      downloadBlob(rendered.blob, name);
      notify(
        isAssetMode.value
          ? `${assetCategoryLabel.value}像素素材已开始下载。`
          : '像素画已开始下载。',
      );
    } catch (error) {
      console.error('[Pixora] 导出失败', error);
      notify('导出失败，请重试。');
    } finally {
      isExporting.value = false;
    }
  }

  async function handleExportAllZip() {
    if (items.value.length === 0) {
      notify('队列里还没有图片。');
      return;
    }
    if (readyItems.value.length !== items.value.length) {
      notify('请等待所有素材生成完成后再打包。');
      return;
    }
    if (isProcessing.value) {
      notify('还有素材正在生成，请稍候。');
      return;
    }

    isExporting.value = true;
    try {
      const used = new Set<string>();
      const files: NamedBlob[] = [];
      for (const item of items.value) {
        if (!item.grid) continue;
        const rendered = await renderGridBlob(
          item.grid,
          item.outputWidth,
          item.outputHeight,
          {
            format: settings.format,
            flattenBackground: flattenBackground(),
            scale: exportScale.value,
          },
        );
        files.push({
          name: uniqueFileName(
            item,
            rendered.width,
            rendered.height,
            used,
          ),
          blob: rendered.blob,
        });
      }

      const manifest = new TextEncoder().encode(
        JSON.stringify(
          {
            app: 'Pixora',
            exportedAt: new Date().toISOString(),
            mode: studioMode.value,
            category: assetCategory.value,
            settings: { ...settings },
            files: files.map((file) => file.name),
          },
          null,
          2,
        ),
      );
      const zip = await createZip(files, {
        'pixora-batch.json': manifest,
      });
      downloadBlob(zip, `pixora-batch-${items.value.length}.zip`);
      notify(`已打包 ${files.length} 张素材。`);
    } catch (error) {
      console.error('[Pixora] 批量打包失败', error);
      notify('批量打包失败，请重试。');
    } finally {
      isExporting.value = false;
    }
  }

  async function handleMultiSizeExport(sizes: TargetResolution[]) {
    const item = selectedItem.value;
    if (!item?.grid) {
      notify('请先选择一张已经生成的图片。');
      return;
    }
    if (sizes.length === 0) {
      notify('请至少选择一个尺寸。');
      return;
    }

    isExporting.value = true;
    try {
      const used = new Set<string>();
      const files: NamedBlob[] = [];
      for (const size of sizes) {
        const rendered = await renderGridAtLongSide(item.grid, size, {
          format: settings.format,
          flattenBackground: flattenBackground(),
        });
        files.push({
          name: uniqueFileName(
            item,
            rendered.width,
            rendered.height,
            used,
          ),
          blob: rendered.blob,
        });
      }
      const zip = await createZip(files);
      downloadBlob(
        zip,
        `pixora-${sanitizeFileName(item.name)}-sizes.zip`,
      );
      notify(`已导出 ${files.length} 个尺寸。`);
    } catch (error) {
      console.error('[Pixora] 多尺寸导出失败', error);
      notify('多尺寸导出失败，请重试。');
    } finally {
      isExporting.value = false;
    }
  }

  async function handleExportSpriteSheet() {
    if (readyItems.value.length === 0) {
      notify('队列里还没有生成完成的素材。');
      return;
    }
    if (isProcessing.value) {
      notify('还有素材正在生成，请稍候。');
      return;
    }

    isExporting.value = true;
    try {
      const sheet = await createSpriteSheet(
        readyItems.value.map((item) => ({
          name: sanitizeFileName(item.name, 'frame'),
          grid: item.grid,
          width: item.outputWidth,
          height: item.outputHeight,
        })),
        {
          flattenBackground: flattenBackground(),
          padding: 4,
        },
      );
      const manifest = new TextEncoder().encode(
        JSON.stringify(sheet.manifest, null, 2),
      );
      const zip = await createZip(
        [{ name: 'spritesheet.png', blob: sheet.image }],
        { 'spritesheet.json': manifest },
      );
      downloadBlob(
        zip,
        `pixora-spritesheet-${readyItems.value.length}.zip`,
      );
      notify(
        `精灵表已导出：${sheet.width} × ${sheet.height} px。`,
      );
    } catch (error) {
      console.error('[Pixora] 精灵表导出失败', error);
      notify('精灵表导出失败，请重试。');
    } finally {
      isExporting.value = false;
    }
  }

  // ---------- 模式、参数与偏好 ----------
  function setStudioMode(mode: StudioMode) {
    studioMode.value = mode;
  }

  function handleReset() {
    Object.assign(settings, DEFAULT_SETTINGS);
    backgroundMode.value = 'white';
    exportScale.value = 1;
    notify('参数已恢复默认值。');
  }

  async function handleShareSettings() {
    const url = createShareUrl({
      preferences: {
        settings: { ...settings },
        mode: studioMode.value,
        assetCategory: assetCategory.value,
        backgroundMode: backgroundMode.value,
      },
      exportScale: exportScale.value,
      lockedColors: [...pixelEditor.lockedColors.value],
    });

    const copied = await copyText(url);
    if (!copied) {
      window.prompt('复制参数链接', url);
    }
    notify(
      copied
        ? '参数链接已复制；链接只包含设置，不包含图片。'
        : '参数链接已生成，请手动复制。',
    );
  }

  async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // 继续尝试旧版复制方式。
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  // ---------- 本地项目与自动保存 ----------
  let draftReady = false;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let draftSaving = false;
  let draftAgain = false;

  async function buildProjectPayload(id: string): Promise<ProjectPayload> {
    const savedItems: SavedProjectItem[] = [];

    for (const item of items.value) {
      let sourceBlob = item.sourceBlob;
      if (!sourceBlob) {
        try {
          sourceBlob = await sourceBlobFor(item);
          item.sourceBlob = sourceBlob;
        } catch {
          continue;
        }
      }

      savedItems.push({
        id: item.id,
        name: item.name,
        originalName: item.originalName,
        sourceBlob,
        originalBlob: item.originalBlob,
        width: item.width,
        height: item.height,
        size: item.size,
        isDemo: item.isDemo,
        grid: item.grid
          ? {
              width: item.grid.width,
              height: item.grid.height,
              data: new Uint8ClampedArray(item.grid.data),
              palette: [...item.grid.palette],
            }
          : null,
        baseGrid: clonePixelGrid(item.baseGrid),
        outputWidth: item.outputWidth,
        outputHeight: item.outputHeight,
        edited: item.edited,
      });
    }

    return {
      id,
      settings: { ...settings },
      mode: studioMode.value,
      assetCategory: assetCategory.value,
      backgroundMode: backgroundMode.value,
      exportScale: exportScale.value,
      selectedId: selectedId.value,
      items: savedItems,
    };
  }

  async function projectThumbnail(): Promise<Blob | null> {
    const item = selectedItem.value;
    if (!item?.grid) return null;
    try {
      return await renderGridThumbnail(item.grid, 360);
    } catch {
      return null;
    }
  }

  async function refreshProjects(): Promise<void> {
    try {
      savedProjects.value = await listProjectMeta();
    } catch (error) {
      console.warn('[Pixora] 读取项目列表失败', error);
      savedProjects.value = [];
    }
  }

  async function handleSaveProject(name: string): Promise<boolean> {
    if (items.value.length === 0) {
      notify('队列里还没有素材，暂时不能保存项目。');
      return false;
    }

    isProjectLoading.value = true;
    try {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `project-${Date.now()}`;
      const payload = await buildProjectPayload(id);
      const now = Date.now();
      const meta: ProjectMeta = {
        id,
        name: name.trim() || '未命名项目',
        createdAt: now,
        updatedAt: now,
        itemCount: payload.items.length,
        isDraft: false,
        thumbnail: await projectThumbnail(),
        mode: payload.mode,
        category: payload.assetCategory,
      };
      await saveProjectRecord(meta, payload);
      await refreshProjects();
      notify(`项目「${meta.name}」已保存。`);
      return true;
    } catch (error) {
      console.error('[Pixora] 项目保存失败', error);
      notify('项目保存失败，可能是浏览器存储空间不足。');
      return false;
    } finally {
      isProjectLoading.value = false;
    }
  }

  async function handleOpenProject(id: string): Promise<boolean> {
    const editedCount = items.value.filter((item) => item.edited).length;
    if (editedCount > 0) {
      const confirmed = await requestGuard({
        title: '打开项目会替换当前队列',
        message: `当前队列中有 ${editedCount} 张素材包含手绘或调色板修改。打开其他项目会替换当前队列，这些修改会丢失。`,
        confirmLabel: '仍然打开项目',
      });
      if (!confirmed) return false;
    }

    isProjectLoading.value = true;
    abortProcessing();
    try {
      const record = await loadProjectRecord(id);
      if (!record) {
        notify('没有找到这个项目。');
        return false;
      }

      isRestoringProject.value = true;
      try {
        Object.assign(settings, record.payload.settings);
        studioMode.value = record.payload.mode;
        assetCategory.value = record.payload.assetCategory;
        backgroundMode.value = record.payload.backgroundMode;
        exportScale.value = record.payload.exportScale;
        restoreItems(
          record.payload.items,
          record.payload.selectedId,
        );
        selectedPixel.value = null;
        pixelEditor.resetHistory();
        await nextTick();
        confirmedProcessingConfig = currentProcessingConfig();
      } finally {
        isRestoringProject.value = false;
      }

      schedulePendingProcessing();
      scheduleDraftSave();
      notify(`已打开项目「${record.meta.name}」。`);
      return true;
    } catch (error) {
      console.error('[Pixora] 项目打开失败', error);
      notify('项目打开失败。');
      return false;
    } finally {
      isProjectLoading.value = false;
    }
  }

  async function handleDeleteProject(id: string): Promise<void> {
    try {
      await deleteProjectRecord(id);
      await refreshProjects();
      notify('项目已删除。');
    } catch (error) {
      console.error('[Pixora] 项目删除失败', error);
      notify('项目删除失败。');
    }
  }

  async function restoreDraftOnStart(): Promise<void> {
    if (sharedState || items.value.length > 0) {
      draftReady = true;
      return;
    }

    try {
      const draft = await loadDraft();
      if (
        draft &&
        draft.payload.items.length > 0 &&
        items.value.length === 0
      ) {
        isRestoringProject.value = true;
        try {
          Object.assign(settings, draft.payload.settings);
          studioMode.value = draft.payload.mode;
          assetCategory.value = draft.payload.assetCategory;
          backgroundMode.value = draft.payload.backgroundMode;
          exportScale.value = draft.payload.exportScale;
          restoreItems(
            draft.payload.items,
            draft.payload.selectedId,
          );
          selectedPixel.value = null;
          pixelEditor.resetHistory();
          await nextTick();
          confirmedProcessingConfig = currentProcessingConfig();
        } finally {
          isRestoringProject.value = false;
        }

        schedulePendingProcessing();
        notify('已恢复上次会话。');
      }
    } catch (error) {
      console.warn('[Pixora] 恢复上次会话失败', error);
    } finally {
      draftReady = true;
    }
  }

  function scheduleDraftSave(): void {
    if (!draftReady || isRestoringProject.value) return;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      void persistDraft();
    }, 1000);
  }

  async function persistDraft(): Promise<void> {
    if (!draftReady || isRestoringProject.value) return;
    if (isProcessing.value) return;
    if (draftSaving) {
      draftAgain = true;
      return;
    }

    draftSaving = true;
    try {
      if (items.value.length === 0) {
        await deleteDraft();
      } else {
        const payload = await buildProjectPayload('pixora-draft');
        await saveDraft(payload);
      }
    } catch (error) {
      console.warn('[Pixora] 自动保存失败', error);
    } finally {
      draftSaving = false;
      if (draftAgain) {
        draftAgain = false;
        scheduleDraftSave();
      }
    }
  }

  watch(
    () =>
      JSON.stringify({
        settings: { ...settings },
        mode: studioMode.value,
        category: assetCategory.value,
        background: backgroundMode.value,
        exportScale: exportScale.value,
        selectedId: selectedId.value,
        items: items.value.map((item) => ({
          id: item.id,
          sourceUrl: item.sourceUrl,
          status: item.status,
          width: item.grid?.width ?? 0,
          height: item.grid?.height ?? 0,
        })),
        gridVersion: gridVersion.value,
      }),
    () => scheduleDraftSave(),
  );

  watch(isProcessing, (processing) => {
    if (!processing) scheduleDraftSave();
  });

  let preferenceTimer: ReturnType<typeof setTimeout> | undefined;
  watch(
    () => ({
      settings: { ...settings },
      mode: studioMode.value,
      assetCategory: assetCategory.value,
      backgroundMode: backgroundMode.value,
    }),
    (preferences) => {
      if (preferenceTimer) clearTimeout(preferenceTimer);
      preferenceTimer = setTimeout(() => {
        saveStudioPreferences(preferences);
      }, 150);
    },
  );

  function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return Boolean(
      element?.closest(
        'input, textarea, select, [contenteditable="true"]',
      ),
    );
  }

  function handleKeyboardShortcut(event: KeyboardEvent) {
    if (isTypingTarget(event.target) || guardDialog.value) return;
    const withModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (withModifier && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) handleRedo();
      else handleUndo();
      return;
    }

    if (withModifier && key === 'y') {
      event.preventDefault();
      handleRedo();
      return;
    }

    if (withModifier && key === 's') {
      event.preventDefault();
      void handleExport();
      return;
    }

    if (withModifier && (key === '1' || key === '2')) {
      event.preventDefault();
      setStudioMode(key === '1' ? 'image' : 'asset');
      return;
    }

    if (withModifier || event.altKey) return;
    const canDraw =
      Boolean(selectedItem.value?.grid) && !isProcessing.value;

    if (event.key === 'Escape' && selectedPixel.value) {
      event.preventDefault();
      finishLiveColorEdit();
      selectedPixel.value = null;
      return;
    }

    if (key === 'g' && hasGrid.value) {
      event.preventDefault();
      pixelEditor.toggleGrid();
      return;
    }

    if (!canDraw) return;

    const shortcuts: Record<string, typeof pixelEditor.tool.value> = {
      v: 'move',
      s: 'select',
      b: 'brush',
      e: 'eraser',
      k: 'bucket',
      i: 'eyedropper',
    };
    const tool = shortcuts[key];
    if (tool) {
      event.preventDefault();
      pixelEditor.setTool(tool);
    }
  }

  onMounted(() => {
    window.addEventListener('paste', handleWindowPaste);
    window.addEventListener('keydown', handleKeyboardShortcut);
    void restoreDraftOnStart();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('paste', handleWindowPaste);
    window.removeEventListener('keydown', handleKeyboardShortcut);
    if (toastTimer) clearTimeout(toastTimer);
    if (draftTimer) clearTimeout(draftTimer);
    if (preferenceTimer) {
      clearTimeout(preferenceTimer);
      saveStudioPreferences({
        settings: { ...settings },
        mode: studioMode.value,
        assetCategory: assetCategory.value,
        backgroundMode: backgroundMode.value,
      });
    }
    if (draftReady) void persistDraft();
    abortProcessing();
  });

  if (sharedState) {
    notify('已从分享链接载入参数。');
  }

  return {
    // 参数与模式
    settings,
    studioMode,
    assetCategory,
    backgroundMode,
    exportScale,
    isAssetMode,
    assetCategoryLabel,
    effectiveColorCount,
    isOutlineEnabled,
    characterProtectionActive,
    isWeaponMode,
    isSmallSource,
    toggleOutline,
    setStudioMode,
    handleReset,

    // 图片与批量队列
    image: displayImage,
    hasSelection,
    hasGrid,
    selectedItem,
    selectedId,
    items,
    selectedImageId: selectedId,
    uploadError,
    isLoading,
    acceptedTypes,
    isProcessing,
    processingLabel,
    processedCount,
    totalToProcess,
    canExport,
    readyItems,
    editedItemCount,
    selectedItemEdited,
    handleFilesSelected,
    handleSelectItem,
    handleRemoveItem,
    handleClearQueue,
    handleRetryItem,

    // 像素网格与编辑
    grid,
    gridVersion,
    selectedPixelInfo,
    paletteColors,
    lockedColors,
    editorTool,
    brushColor,
    brushSize,
    showPixelGrid,
    canUndo,
    canRedo,
    handleEditorStart,
    handleEditorMove,
    handleEditorEnd,
    handleUndo,
    handleRedo,
    handlePaletteColorChange,
    handlePaletteLock,
    handleImportPalette,
    handleTogglePixelGrid,
    handlePreviewSelectedPixelColor,
    handleChangeSelectedPixelColor,
    handleClearSelectedPixel,
    setEditorTool: pixelEditor.setTool,
    setBrushColor: pixelEditor.setBrushColor,
    setBrushSize: pixelEditor.setBrushSize,
    isPaletteColorLocked: pixelEditor.isLocked,

    // 源图调整
    isTransformingSource,
    selectedSourceEdited,
    handleRotate,
    handleFlip,
    handleCrop,
    handleRestoreOriginal,
    handlePasteButton,

    // 导出
    processedSize,
    isExporting,
    handleExport,
    handleExportAllZip,
    handleMultiSizeExport,
    handleExportSpriteSheet,
    handleShareSettings,

    // 本地项目
    savedProjects,
    isProjectLoading,
    refreshProjects,
    handleSaveProject,
    handleOpenProject,
    handleDeleteProject,

    // 破坏性操作确认
    guardDialog,
    confirmGuard,
    cancelGuard,

    // 页面状态
    apiStatus,
    apiStatusLabel,
    toastMessage,
    refreshApiStatus,
    dismissToast,
  };
}
