<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import {
  Boxes,
  GitCompareArrows,
  Image as ImageIcon,
  Keyboard,
  LoaderCircle,
  Minus,
  MousePointer2,
  Plus,
  Scan,
  UploadCloud,
} from 'lucide-vue-next';
import type {
  BackgroundMode,
  DisplayImage,
  EditorTool,
  PixelGrid,
  SelectedPixelInfo,
  StudioMode,
} from '../../models/pixel';
import { SAMPLE_ASSETS } from '../../models/samples';
import {
  gridHasTransparency,
  rgbToHex,
} from '../../services/palette.service';
import EditorToolbar from './EditorToolbar.vue';
import ShortcutsDialog from './ShortcutsDialog.vue';

const props = defineProps<{
  image: DisplayImage;
  mode: StudioMode;
  assetCategoryLabel: string;
  grid: PixelGrid | null;
  gridVersion: number;
  isProcessing: boolean;
  processingLabel: string;
  outputSize: { width: number; height: number } | null;
  hasSelection: boolean;
  backgroundMode: BackgroundMode;
  editorTool: EditorTool;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  showPixelGrid: boolean;
  isTransformingSource: boolean;
  selectedSourceEdited: boolean;
  hasManualEdits: boolean;
  selectedPixel: SelectedPixelInfo | null;
}>();

const emit = defineEmits<{
  'files-selected': [files: FileList | File[]];
  rotate: [direction: 'left' | 'right'];
  flip: [direction: 'horizontal' | 'vertical'];
  crop: [];
  paste: [];
  restore: [];
  'editor-start': [x: number, y: number];
  'editor-move': [x: number, y: number];
  'editor-end': [];
  undo: [];
  redo: [];
  'set-tool': [tool: EditorTool];
  'set-brush-color': [color: string];
  'set-brush-size': [size: number];
  'toggle-grid': [];
  'open-palette': [];
  'preview-pixel-color': [color: string];
  'change-pixel-color': [color: string];
}>();

const isAssetMode = computed(() => props.mode === 'asset');
const hasGrid = computed(() => Boolean(props.grid));
const showAssetEmpty = computed(
  () => isAssetMode.value && !props.hasSelection,
);

const previewLabel = computed(() => {
  if (showAssetEmpty.value) return '等待素材';
  if (isAssetMode.value) return `${props.assetCategoryLabel}素材`;
  return props.image.isDemo ? '示例预览' : '你的图片';
});

const displayedSize = computed(
  () =>
    props.outputSize ?? {
      width: props.image.width,
      height: props.image.height,
    },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const stageCanvasRef = ref<HTMLElement | null>(null);
const displayCanvasSize = ref({ width: 0, height: 0 });
const selectionRect = ref<{
  left: number;
  top: number;
  width: number;
  height: number;
} | null>(null);
let selectionAnimationFrame = 0;

const compareMode = ref(false);
const comparePosition = ref(50);
const zoom = ref(100);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const isSpaceHeld = ref(false);
const isPointerOverStage = ref(false);
const showShortcuts = ref(false);
const hoverInfo = ref<{
  x: number;
  y: number;
  hex: string | null;
  transparent: boolean;
} | null>(null);

const MAX_ZOOM = 1600;

const gridTransparent = computed(() => {
  void props.gridVersion;
  return props.grid ? gridHasTransparency(props.grid) : false;
});

const showCheckerboard = computed(
  () =>
    gridTransparent.value &&
    (!isAssetMode.value || props.backgroundMode === 'transparent'),
);

const pixelGridStyle = computed(() => {
  if (!props.grid) return {};
  return {
    backgroundImage:
      'linear-gradient(to right, rgba(255,255,255,.42) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.42) 1px, transparent 1px)',
    backgroundSize: `${100 / props.grid.width}% ${100 / props.grid.height}%`,
  };
});

const showGridOverlay = computed(
  () =>
    props.showPixelGrid &&
    hasGrid.value &&
    !compareMode.value &&
    !!props.grid &&
    Math.max(props.grid.width, props.grid.height) <= 256,
);

function scheduleSelectionRectUpdate() {
  if (selectionAnimationFrame) {
    cancelAnimationFrame(selectionAnimationFrame);
  }
  selectionAnimationFrame = requestAnimationFrame(() => {
    selectionAnimationFrame = 0;
    updateSelectionRect();
  });
}

/**
 * 选框画在缩放层外面，用屏幕坐标定位。
 * 这样 1px 边框不会随着画布放大变成几十像素厚，
 * 选中块内部始终保留原来的颜色。
 */
function updateSelectionRect() {
  const canvas = canvasRef.value;
  const stage = stageCanvasRef.value;
  const grid = props.grid;
  const selected = props.selectedPixel;

  if (!canvas || !stage || !grid || !selected || compareMode.value) {
    selectionRect.value = null;
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    selectionRect.value = null;
    return;
  }

  const cellWidth = canvasRect.width / grid.width;
  const cellHeight = canvasRect.height / grid.height;
  selectionRect.value = {
    left:
      canvasRect.left -
      stageRect.left +
      selected.x * cellWidth,
    top:
      canvasRect.top -
      stageRect.top +
      selected.y * cellHeight,
    width: cellWidth,
    height: cellHeight,
  };
}

const artboardTransform = computed(
  () =>
    `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value / 100})`,
);

const canvasDisplayStyle = computed(() => {
  if (!hasGrid.value) return {};
  return {
    width: `${displayCanvasSize.value.width}px`,
    height: `${displayCanvasSize.value.height}px`,
  };
});

const stageCursorClass = computed(() => {
  if (isSpaceHeld.value || !hasGrid.value || props.isProcessing) {
    return isPanning.value ? 'is-panning' : 'is-grab';
  }
  if (props.editorTool === 'select') return 'is-select';
  if (props.editorTool === 'brush' || props.editorTool === 'eraser') {
    return 'is-drawing';
  }
  if (props.editorTool === 'bucket') return 'is-bucket';
  if (props.editorTool === 'eyedropper') return 'is-pick';
  return isPanning.value ? 'is-panning' : 'is-grab';
});

const sourceLabel = computed(() => {
  if (props.isProcessing) return '正在生成像素画';
  if (hasGrid.value) {
    return isAssetMode.value ? '像素素材预览' : '像素画预览';
  }
  if (showAssetEmpty.value) return '等待上传素材';
  return isAssetMode.value ? '本地素材' : '示例作品';
});

const statusText = computed(() => {
  if (props.isProcessing) return props.processingLabel;
  if (hasGrid.value) return '已生成';
  return '';
});

// 像素网格数据直接画到 canvas，手工修像素时只需重绘这张小画布。
watch(
  () => [props.grid, props.gridVersion] as const,
  drawGrid,
  { immediate: true, flush: 'post' },
);

watch(
  () => [props.grid, props.gridVersion] as const,
  () => {
    void nextTick(updateCanvasDisplaySize);
  },
  { flush: 'post' },
);

watch(compareMode, () => {
  void nextTick(updateCanvasDisplaySize);
});

watch(
  () => props.grid,
  () => {
    hoverInfo.value = null;
  },
);

// 只有“切换到吸管”时才自动打开色板。
// 如果监听整个 grid，任何参数重新生成都会再次触发，导致用户刚回到参数页
// 就被拽回色板页。
watch(
  () => props.editorTool,
  (tool) => {
    if (tool !== 'move') compareMode.value = false;
    if (tool === 'eyedropper') emit('open-palette');
  },
);

watch(
  () => props.grid,
  (grid) => {
    if (!grid) compareMode.value = false;
  },
);

// 坐标变化才代表选中了另一个像素；颜色变化、撤销等不应再次切页。
watch(
  () =>
    props.selectedPixel
      ? `${props.selectedPixel.x}:${props.selectedPixel.y}`
      : '',
  (key) => {
    if (key) emit('open-palette');
    scheduleSelectionRectUpdate();
  },
);

watch(
  () =>
    [
      props.grid,
      zoom.value,
      panX.value,
      panY.value,
      compareMode.value,
      displayCanvasSize.value.width,
      displayCanvasSize.value.height,
    ] as const,
  () => scheduleSelectionRectUpdate(),
  { flush: 'post' },
);

let resizeObserver: ResizeObserver | null = null;

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable="true"]',
    ),
  );
}

function handleZoomShortcut(event: KeyboardEvent) {
  if (isTypingTarget(event.target)) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === '[') {
    event.preventDefault();
    zoomOut();
  } else if (event.key === ']') {
    event.preventDefault();
    zoomIn();
  }
}

function handleSpaceDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || isTypingTarget(event.target)) return;
  if (!isPointerOverStage.value || !hasGrid.value) return;
  event.preventDefault();
  isSpaceHeld.value = true;
}

function handleSpaceUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    isSpaceHeld.value = false;
  }
}

function resetSpaceState() {
  isSpaceHeld.value = false;
}

onMounted(() => {
  updateCanvasDisplaySize();
  window.addEventListener('keydown', handleZoomShortcut);
  window.addEventListener('keydown', handleSpaceDown);
  window.addEventListener('keyup', handleSpaceUp);
  window.addEventListener('blur', resetSpaceState);
  if (stageCanvasRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasDisplaySize();
    });
    resizeObserver.observe(stageCanvasRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleZoomShortcut);
  window.removeEventListener('keydown', handleSpaceDown);
  window.removeEventListener('keyup', handleSpaceUp);
  window.removeEventListener('blur', resetSpaceState);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (selectionAnimationFrame) {
    cancelAnimationFrame(selectionAnimationFrame);
    selectionAnimationFrame = 0;
  }
  detachWindowPointerEvents();
});

function updateCanvasDisplaySize() {
  const stage = stageCanvasRef.value;
  const grid = props.grid;
  if (!stage || !grid) {
    displayCanvasSize.value = { width: 0, height: 0 };
    selectionRect.value = null;
    return;
  }

  const style = window.getComputedStyle(stage);
  const paddingX =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight);
  const paddingY =
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom);
  const availableWidth = Math.max(
    80,
    stage.clientWidth - paddingX - 22,
  );
  const availableHeight = Math.max(
    80,
    stage.clientHeight - paddingY - 18,
  );
  const maxWidth = Math.min(availableWidth, 720);
  const maxHeight = Math.min(availableHeight, 470);
  const scale = Math.min(
    maxWidth / grid.width,
    maxHeight / grid.height,
  );

  displayCanvasSize.value = {
    width: Math.max(32, Math.round(grid.width * scale)),
    height: Math.max(32, Math.round(grid.height * scale)),
  };
  scheduleSelectionRectUpdate();
}

function drawGrid() {
  const canvas = canvasRef.value;
  const grid = props.grid;
  if (!canvas || !grid) return;

  if (canvas.width !== grid.width) canvas.width = grid.width;
  if (canvas.height !== grid.height) canvas.height = grid.height;

  const context = canvas.getContext('2d');
  if (!context) return;
  const imageData = context.createImageData(grid.width, grid.height);
  imageData.data.set(grid.data);
  context.putImageData(imageData, 0, 0);
}

function gridPointFromEvent(
  event: PointerEvent,
): { x: number; y: number } | null {
  const point = gridPointInsideEvent(event);
  const grid = props.grid;
  if (!point || !grid) return null;
  return {
    x: Math.max(0, Math.min(grid.width - 1, point.x)),
    y: Math.max(0, Math.min(grid.height - 1, point.y)),
  };
}

/** 只返回真正落在画布内部的点，用于悬停取色 */
function gridPointInsideEvent(
  event: PointerEvent,
): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  const grid = props.grid;
  if (!canvas || !grid) return null;

  const rect = canvas.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX >= rect.right ||
    event.clientY < rect.top ||
    event.clientY >= rect.bottom
  ) {
    return null;
  }

  return {
    x: Math.floor(
      ((event.clientX - rect.left) / rect.width) * grid.width,
    ),
    y: Math.floor(
      ((event.clientY - rect.top) / rect.height) * grid.height,
    ),
  };
}

function handleStageHover(event: PointerEvent) {
  const grid = props.grid;
  if (!grid || props.isProcessing || showAssetEmpty.value) {
    hoverInfo.value = null;
    return;
  }

  const point = gridPointInsideEvent(event);
  if (!point) {
    hoverInfo.value = null;
    return;
  }

  const offset = (point.y * grid.width + point.x) * 4;
  const alpha = grid.data[offset + 3] ?? 0;
  hoverInfo.value = {
    x: point.x,
    y: point.y,
    hex:
      alpha === 0
        ? null
        : rgbToHex({
            red: grid.data[offset] ?? 0,
            green: grid.data[offset + 1] ?? 0,
            blue: grid.data[offset + 2] ?? 0,
          }),
    transparent: alpha === 0,
  };
}

let editPointerId: number | null = null;
let panPointerId: number | null = null;
let panStart = { x: 0, y: 0 };
let isPainting = false;

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return;

  const target = event.target as HTMLElement;
  if (
    target.closest(
      'button, input, label, .asset-empty, .compare-controls',
    )
  ) {
    return;
  }

  if (isSpaceHeld.value) {
    startPan(event);
    return;
  }

  const onCanvas = Boolean(target.closest('.pixel-surface'));
  if (
    onCanvas &&
    hasGrid.value &&
    !props.isProcessing &&
    props.editorTool !== 'move' &&
    !compareMode.value
  ) {
    const point = gridPointFromEvent(event);
    if (!point) return;

    event.preventDefault();
    editPointerId = event.pointerId;
    isPainting =
      props.editorTool === 'brush' || props.editorTool === 'eraser';
    emit('editor-start', point.x, point.y);
    attachWindowPointerEvents();
    return;
  }

  startPan(event);
}

function startPan(event: PointerEvent) {
  event.preventDefault();
  panPointerId = event.pointerId;
  isPanning.value = true;
  panStart = {
    x: event.clientX - panX.value,
    y: event.clientY - panY.value,
  };
  attachWindowPointerEvents();
}

function handleWindowPointerMove(event: PointerEvent) {
  if (
    editPointerId === event.pointerId &&
    isPainting &&
    (props.editorTool === 'brush' || props.editorTool === 'eraser')
  ) {
    const point = gridPointFromEvent(event);
    if (point) emit('editor-move', point.x, point.y);
    return;
  }

  if (panPointerId === event.pointerId) {
    panX.value = event.clientX - panStart.x;
    panY.value = event.clientY - panStart.y;
  }
}

function handleWindowPointerUp(event: PointerEvent) {
  if (editPointerId === event.pointerId) {
    editPointerId = null;
    isPainting = false;
    emit('editor-end');
    detachWindowPointerEvents();
  } else if (panPointerId === event.pointerId) {
    panPointerId = null;
    isPanning.value = false;
    detachWindowPointerEvents();
  }
}

function handleWindowPointerCancel(event: PointerEvent) {
  handleWindowPointerUp(event);
}

let windowPointerAttached = false;

function attachWindowPointerEvents() {
  if (windowPointerAttached) return;
  windowPointerAttached = true;
  window.addEventListener('pointermove', handleWindowPointerMove);
  window.addEventListener('pointerup', handleWindowPointerUp);
  window.addEventListener('pointercancel', handleWindowPointerCancel);
}

function detachWindowPointerEvents() {
  if (!windowPointerAttached) return;
  windowPointerAttached = false;
  window.removeEventListener('pointermove', handleWindowPointerMove);
  window.removeEventListener('pointerup', handleWindowPointerUp);
  window.removeEventListener('pointercancel', handleWindowPointerCancel);
}

function setZoom(value: number) {
  zoom.value = Math.max(25, Math.min(MAX_ZOOM, Math.round(value)));
}

function zoomIn() {
  setZoom(zoom.value * 2);
}

function zoomOut() {
  setZoom(zoom.value / 2);
}

function resetView() {
  zoom.value = 100;
  panX.value = 0;
  panY.value = 0;
}

function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(
    event.deltaY < 0 ? zoom.value * 1.25 : zoom.value / 1.25,
  );
}

function toggleCompare() {
  if (!hasGrid.value) return;
  compareMode.value = !compareMode.value;
  if (compareMode.value) {
    setZoom(100);
    panX.value = 0;
    panY.value = 0;
    emit('set-tool', 'move');
  }
}

// ---------- 上传 / 拖拽 ----------
const isDragging = ref(false);
let dragDepth = 0;

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function handleDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return;
  dragDepth += 1;
  isDragging.value = true;
}

function handleDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  dragDepth = 0;
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    emit('files-selected', files);
  }
}

onBeforeUnmount(detachWindowPointerEvents);
</script>

<template>
  <div
    class="image-stage"
    :class="{ 'is-asset-mode': isAssetMode }"
    @pointerenter="isPointerOverStage = true"
    @pointerleave="
      isPointerOverStage = false;
      hoverInfo = null;
    "
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <header class="stage-header">
      <span class="preview-badge">
        <span class="preview-dot" aria-hidden="true"></span>
        {{ previewLabel }}
      </span>

      <div class="stage-meta">
        <span
          v-if="props.isProcessing"
          class="processing-chip"
          aria-live="polite"
        >
          <LoaderCircle
            class="processing-spin"
            :size="11"
            :stroke-width="2"
          />
          {{ props.processingLabel }}
        </span>

        <span
          v-if="props.hasManualEdits && hasGrid"
          class="edited-chip"
        >
          已编辑
        </span>

        <span
          v-if="hoverInfo"
          class="hover-color"
          aria-live="polite"
        >
          <span
            class="hover-swatch"
            :class="{ 'is-transparent': hoverInfo.transparent }"
            :style="{
              backgroundColor: hoverInfo.hex ?? 'transparent',
            }"
          ></span>
          <span class="hover-hex">
            {{ hoverInfo.transparent ? '透明' : hoverInfo.hex?.toUpperCase() }}
          </span>
          <span class="hover-coords">
            {{ hoverInfo.x }}, {{ hoverInfo.y }}
          </span>
        </span>

        <button
          v-if="hasGrid && !props.isProcessing"
          class="compare-button"
          :class="{ 'is-active': compareMode }"
          type="button"
          @click="toggleCompare"
        >
          <GitCompareArrows :size="11" :stroke-width="2" />
          {{ compareMode ? '退出对比' : '对比原图' }}
        </button>

        <span v-if="!showAssetEmpty" class="image-dimensions">
          {{ displayedSize.width }} × {{ displayedSize.height }} px
        </span>
        <span v-else class="image-dimensions">
          {{
            props.backgroundMode === 'transparent'
              ? '输出透明背景'
              : '输出白色背景'
          }}
        </span>
      </div>
    </header>

    <EditorToolbar
      v-if="props.hasSelection"
      :has-selection="props.hasSelection"
      :has-grid="hasGrid"
      :is-processing="props.isProcessing"
      :is-transforming-source="props.isTransformingSource"
      :selected-source-edited="props.selectedSourceEdited"
      :editor-tool="props.editorTool"
      :brush-color="props.brushColor"
      :brush-size="props.brushSize"
      :can-undo="props.canUndo"
      :can-redo="props.canRedo"
      :show-pixel-grid="props.showPixelGrid"
      :has-selected-pixel="Boolean(props.selectedPixel)"
      :selected-pixel-color="props.selectedPixel?.hex ?? null"
      @crop="emit('crop')"
      @rotate="emit('rotate', $event)"
      @flip="emit('flip', $event)"
      @paste="emit('paste')"
      @restore="emit('restore')"
      @set-tool="emit('set-tool', $event)"
      @set-brush-color="emit('set-brush-color', $event)"
      @set-brush-size="emit('set-brush-size', $event)"
      @undo="emit('undo')"
      @redo="emit('redo')"
      @toggle-grid="emit('toggle-grid')"
      @open-palette="emit('open-palette')"
      @preview-pixel-color="emit('preview-pixel-color', $event)"
      @change-pixel-color="emit('change-pixel-color', $event)"
    />

    <div
      ref="stageCanvasRef"
      class="stage-canvas"
      :class="[stageCursorClass, { 'has-asset-empty': showAssetEmpty }]"
      @pointerdown="handlePointerDown"
      @pointermove="handleStageHover"
      @pointerleave="hoverInfo = null"
      @wheel="handleWheel"
    >
      <div v-if="showAssetEmpty" class="asset-empty">
        <span class="asset-empty-icon" aria-hidden="true">
          <Boxes :size="24" :stroke-width="1.7" />
        </span>
        <strong>{{ props.assetCategoryLabel }}素材还没有上传</strong>
        <p>在右侧上传素材图片，支持一次选择多张。</p>
        <span class="asset-empty-hint">
          <UploadCloud :size="12" :stroke-width="1.9" />
          建议使用纯色背景素材
        </span>

        <div class="sample-section">
          <span class="sample-title">示例素材</span>
          <div class="sample-grid">
            <div
              v-for="sample in SAMPLE_ASSETS"
              :key="sample.id"
              class="sample-card"
            >
              <img :src="sample.src" alt="" />
              <span>{{ sample.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="artboard" :style="{ transform: artboardTransform }">
        <span class="corner corner-tl" aria-hidden="true"></span>
        <span class="corner corner-tr" aria-hidden="true"></span>
        <span class="corner corner-bl" aria-hidden="true"></span>
        <span class="corner corner-br" aria-hidden="true"></span>

        <div
          class="pixel-surface"
          :class="{
            'has-checkerboard': showCheckerboard,
            'is-processing': props.isProcessing,
          }"
        >
          <canvas
            v-if="hasGrid"
            ref="canvasRef"
            class="preview-canvas"
            :style="canvasDisplayStyle"
            aria-label="浏览器生成的像素画预览"
          ></canvas>
          <img
            v-else
            class="preview-image"
            :src="props.image.src"
            :alt="
              isAssetMode
                ? `${props.assetCategoryLabel}素材的本地预览`
                : '图片的本地预览'
            "
            draggable="false"
          />

          <div
            v-if="hasGrid"
            class="transparency-backdrop"
            aria-hidden="true"
          ></div>

          <div
            v-if="hasGrid && compareMode"
            class="compare-original"
            :style="{
              clipPath: `inset(0 ${100 - comparePosition}% 0 0)`,
            }"
            aria-hidden="true"
          >
            <img :src="props.image.src" alt="" draggable="false" />
          </div>
          <span
            v-if="hasGrid && compareMode"
            class="compare-divider"
            :style="{ left: `${comparePosition}%` }"
            aria-hidden="true"
          ></span>

          <span
            v-if="showGridOverlay"
            class="pixel-grid-overlay"
            :style="pixelGridStyle"
            aria-hidden="true"
          ></span>
        </div>
      </div>

      <span
        v-if="selectionRect"
        class="pixel-selection-screen"
        :style="{
          left: `${selectionRect.left}px`,
          top: `${selectionRect.top}px`,
          width: `${selectionRect.width}px`,
          height: `${selectionRect.height}px`,
        }"
        aria-hidden="true"
      ></span>
    </div>

    <div v-if="compareMode && hasGrid" class="compare-controls">
      <span>原图</span>
      <input
        v-model.number="comparePosition"
        type="range"
        min="0"
        max="100"
        step="1"
        aria-label="原图与像素画对比位置"
      />
      <span>像素画</span>
    </div>

    <footer class="stage-toolbar" :class="{ 'is-empty-asset': showAssetEmpty }">
      <template v-if="!showAssetEmpty">
        <div class="zoom-control" role="group" aria-label="预览缩放">
          <button
            class="tool-button"
            type="button"
            title="缩小预览（[）"
            aria-label="缩小预览"
            :disabled="zoom <= 25"
            @click="zoomOut"
          >
            <Minus :size="14" :stroke-width="2" />
          </button>
          <button
            class="zoom-value"
            type="button"
            title="恢复 100% 并居中"
            @click="resetView"
          >
            {{ zoom }}%
          </button>
          <button
            class="tool-button"
            type="button"
            title="放大预览（]）"
            aria-label="放大预览"
            :disabled="zoom >= MAX_ZOOM"
            @click="zoomIn"
          >
            <Plus :size="14" :stroke-width="2" />
          </button>
          <button
            class="fit-button"
            type="button"
            title="适应窗口"
            aria-label="适应窗口"
            @click="resetView"
          >
            <Scan :size="12" :stroke-width="1.9" />
            适应
          </button>
        </div>

        <span class="toolbar-divider" aria-hidden="true"></span>
      </template>

      <span class="source-label">
        <ImageIcon :size="13" :stroke-width="1.9" />
        {{ sourceLabel }}
      </span>

      <span
        v-if="statusText && props.isProcessing"
        class="status-text"
      >{{ statusText }}</span>

      <span class="toolbar-spacer"></span>

      <button
        class="shortcut-help"
        type="button"
        title="查看快捷键"
        @click="showShortcuts = true"
      >
        <Keyboard :size="12" :stroke-width="1.9" />
        快捷键
      </button>

      <span class="drag-hint">
        <MousePointer2 :size="12" :stroke-width="1.8" />
        {{ isAssetMode ? '拖入素材可继续添加' : '拖入图片可继续添加' }}
      </span>
    </footer>

    <ShortcutsDialog
      v-if="showShortcuts"
      @close="showShortcuts = false"
    />

    <Transition name="drop">
      <div v-if="isDragging" class="drop-overlay" aria-hidden="true">
        <div class="drop-message">
          <span class="drop-icon">
            <UploadCloud :size="22" :stroke-width="1.8" />
          </span>
          <strong>
            {{ isAssetMode ? '松开鼠标，加入素材' : '松开鼠标，加入图片' }}
          </strong>
          <span>支持 PNG / JPG / WEBP</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.image-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 720px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 44% 36% at 50% 46%, rgba(139, 92, 246, 0.1), transparent 70%),
    #f9f7fc;
}

.stage-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 12px;
}

.stage-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}

.edited-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--violet-200);
  border-radius: var(--radius-full);
  color: var(--violet-700);
  background: var(--white);
  font-size: 9px;
  font-weight: 620;
  white-space: nowrap;
}

.hover-color {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px 3px 4px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--color-ink-soft);
  background: rgba(255, 255, 255, 0.82);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}

.hover-swatch {
  width: 13px;
  height: 13px;
  border: 1px solid rgba(41, 25, 61, 0.18);
  border-radius: 4px;
  background-color: var(--white);
}

.hover-swatch.is-transparent {
  background-image:
    linear-gradient(45deg, #ddd6e6 25%, transparent 25%),
    linear-gradient(-45deg, #ddd6e6 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd6e6 75%),
    linear-gradient(-45deg, transparent 75%, #ddd6e6 75%);
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
  background-size: 8px 8px;
}

.hover-hex {
  font-family: var(--font-mono, monospace);
  font-size: 8.5px;
  font-weight: 600;
}

.hover-coords {
  color: var(--color-subtle);
  font-size: 8px;
}

.processing-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid var(--violet-100);
  border-radius: var(--radius-full);
  color: var(--violet-700);
  background: var(--violet-25);
  font-size: 9px;
  font-weight: 620;
  white-space: nowrap;
}

.processing-spin {
  animation: stage-spin 0.8s linear infinite;
}

@keyframes stage-spin {
  to {
    transform: rotate(360deg);
  }
}

.compare-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--color-muted);
  background: rgba(255, 255, 255, 0.75);
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 150ms ease,
    border-color 150ms ease,
    background 150ms ease;
}

.compare-button:hover,
.compare-button.is-active {
  color: var(--violet-700);
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border: 1px solid rgba(226, 218, 237, 0.9);
  border-radius: var(--radius-full);
  color: var(--color-muted);
  background: rgba(255, 255, 255, 0.74);
  font-size: 11.5px;
  font-weight: 600;
  box-shadow: var(--shadow-xs);
  backdrop-filter: blur(8px);
}

.preview-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--violet-500);
  box-shadow: 0 0 0 3px var(--violet-100);
}

.image-dimensions {
  color: var(--color-subtle);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.stage-canvas {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 16px clamp(24px, 4.5vw, 58px) 22px;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.stage-canvas::after {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(81, 50, 120, 0.11) 1px, transparent 1px);
  background-size: 18px 18px;
  content: '';
  mask-image: radial-gradient(ellipse at center, #000 5%, transparent 74%);
  pointer-events: none;
}

.stage-canvas.is-grab {
  cursor: grab;
}

.stage-canvas.is-panning {
  cursor: grabbing;
}

.stage-canvas.is-select {
  cursor: default;
}

.stage-canvas.is-drawing {
  cursor: crosshair;
}

.stage-canvas.is-bucket {
  cursor: copy;
}

.stage-canvas.is-pick {
  cursor: crosshair;
}

.asset-empty {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  width: min(100%, 460px);
  padding: 30px 26px 24px;
  border: 1.5px dashed var(--violet-200);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: var(--shadow-xs);
  text-align: center;
  backdrop-filter: blur(8px);
}

.asset-empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  border: 1px solid var(--violet-200);
  border-radius: 15px;
  color: var(--violet-600);
  background: var(--violet-50);
  box-shadow: var(--shadow-xs);
}

.asset-empty strong {
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.asset-empty p {
  max-width: 320px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.7;
}

.asset-empty-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-subtle);
  font-size: 10px;
}

.sample-section {
  width: 100%;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--color-line);
}

.sample-title {
  display: block;
  margin-bottom: 8px;
  color: var(--violet-700);
  font-size: 10px;
  font-weight: 650;
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.sample-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  color: var(--color-muted);
  background: var(--white);
  font-size: 9px;
  cursor: default;
}

.sample-card img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 5px;
  object-fit: cover;
}

.artboard {
  position: relative;
  z-index: 1;
  display: flex;
  max-width: 100%;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 15px;
  background: var(--white);
  box-shadow: var(--shadow-artwork);
  will-change: transform;
}

.pixel-surface {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: 7px;
  background: var(--white);
}

.pixel-surface.has-checkerboard {
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #eee9f5 25%, transparent 25%),
    linear-gradient(-45deg, #eee9f5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee9f5 75%),
    linear-gradient(-45deg, transparent 75%, #eee9f5 75%);
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-size: 16px 16px;
}

.preview-canvas {
  position: relative;
  z-index: 1;
  display: block;
  image-rendering: pixelated;
}

.preview-image {
  position: relative;
  z-index: 1;
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: min(50vh, 450px);
  border-radius: 7px;
  object-fit: contain;
  image-rendering: pixelated;
}

.transparency-backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  background-color: #fff;
}

.has-checkerboard .transparency-backdrop {
  background-color: transparent;
}

.compare-original {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
}

.compare-original img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.compare-divider {
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--white);
  box-shadow: 0 0 0 1px rgba(20, 13, 28, 0.4);
  pointer-events: none;
}

.pixel-grid-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  pointer-events: none;
}

.pixel-selection-screen {
  position: absolute;
  z-index: 6;
  box-sizing: border-box;
  border: 1px solid rgba(124, 58, 237, 0.95);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.9),
    0 0 0 3px rgba(124, 58, 237, 0.16);
  background: transparent;
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 17px;
  height: 17px;
  border-color: var(--violet-300);
  border-style: solid;
  opacity: 0.82;
  pointer-events: none;
}

.corner-tl {
  top: -7px;
  left: -7px;
  border-width: 1.5px 0 0 1.5px;
  border-top-left-radius: 5px;
}

.corner-tr {
  top: -7px;
  right: -7px;
  border-width: 1.5px 1.5px 0 0;
  border-top-right-radius: 5px;
}

.corner-bl {
  bottom: -7px;
  left: -7px;
  border-width: 0 0 1.5px 1.5px;
  border-bottom-left-radius: 5px;
}

.corner-br {
  right: -7px;
  bottom: -7px;
  border-width: 0 1.5px 1.5px 0;
  border-bottom-right-radius: 5px;
}

.compare-controls {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 9px;
  width: min(86%, 460px);
  margin: -6px auto 8px;
  color: var(--color-subtle);
  font-size: 9px;
}

.compare-controls input {
  flex: 1;
  height: 4px;
  appearance: none;
  border-radius: var(--radius-full);
  background: var(--violet-200);
  cursor: ew-resize;
}

.compare-controls input::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  border: 2px solid var(--white);
  border-radius: 50%;
  appearance: none;
  background: var(--violet-600);
  box-shadow: 0 1px 4px rgba(20, 13, 28, 0.28);
}

.stage-toolbar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin: 0 18px 18px;
  padding: 6px 10px;
  border: 1px solid rgba(228, 221, 237, 0.9);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 10px 30px -22px rgba(57, 31, 101, 0.26);
  backdrop-filter: blur(10px);
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 1px;
}

.tool-button {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--color-muted);
  background: transparent;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.tool-button:hover:not(:disabled) {
  color: var(--violet-700);
  background: var(--violet-50);
}

.tool-button:disabled {
  opacity: 0.35;
}

.zoom-value {
  min-width: 42px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  color: var(--color-ink-soft);
  background: transparent;
  font-size: 10.5px;
  font-weight: 620;
  font-variant-numeric: tabular-nums;
}

.zoom-value:hover {
  background: var(--violet-50);
}

.fit-button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 27px;
  margin-left: 2px;
  padding: 0 7px;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  color: var(--color-muted);
  background: var(--white);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.fit-button:hover {
  color: var(--violet-700);
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.shortcut-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 27px;
  padding: 0 7px;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  color: var(--color-subtle);
  background: transparent;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.shortcut-help:hover {
  color: var(--violet-700);
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--color-line);
}

.source-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-subtle);
  font-size: 10.5px;
}

.status-text {
  color: var(--violet-600);
  font-size: 9.5px;
}

.toolbar-spacer {
  flex: 1;
}

.drag-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-subtle);
  font-size: 10.5px;
}

.drop-overlay {
  position: absolute;
  z-index: 10;
  inset: 10px;
  display: grid;
  place-items: center;
  border: 1.5px dashed var(--violet-400);
  border-radius: 17px;
  background: rgba(250, 248, 255, 0.82);
  backdrop-filter: blur(7px);
  pointer-events: none;
}

.drop-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  color: var(--color-ink);
}

.drop-message strong {
  font-size: 14px;
  font-weight: 650;
}

.drop-message > span:last-child {
  color: var(--color-muted);
  font-size: 11px;
}

.drop-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 3px;
  border: 1px solid var(--violet-200);
  border-radius: 14px;
  color: var(--violet-600);
  background: var(--white);
  box-shadow: var(--shadow-sm);
}

.drop-enter-active,
.drop-leave-active {
  transition: opacity 160ms ease;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .image-stage {
    min-height: 560px;
  }

  .preview-image {
    max-height: 390px;
  }

  .stage-canvas {
    padding: 14px 26px 20px;
  }
}

@media (max-width: 560px) {
  .image-stage {
    min-height: 450px;
  }

  .stage-header {
    padding: 16px 16px 10px;
  }

  .stage-meta .image-dimensions,
  .hover-coords,
  .edited-chip {
    display: none;
  }

  .shortcut-help {
    width: 27px;
    padding: 0;
    justify-content: center;
    font-size: 0;
  }

  .shortcut-help :deep(svg) {
    display: block;
  }

  .fit-button {
    padding: 0 5px;
    font-size: 0;
  }

  .fit-button :deep(svg) {
    display: block;
  }

  .stage-canvas {
    padding: 14px 16px;
  }

  .preview-image {
    max-height: 300px;
  }

  .stage-toolbar {
    margin: 0 12px 12px;
  }

  .asset-empty {
    padding: 24px 17px 18px;
  }

  .sample-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }

  .stage-toolbar:not(.is-empty-asset) .drag-hint,
  .stage-toolbar:not(.is-empty-asset) .source-label,
  .stage-toolbar:not(.is-empty-asset) .status-text,
  .stage-toolbar:not(.is-empty-asset) .toolbar-divider {
    display: none;
  }

  .stage-toolbar.is-empty-asset .drag-hint {
    display: none;
  }

  .compare-controls {
    width: calc(100% - 32px);
  }
}
</style>
