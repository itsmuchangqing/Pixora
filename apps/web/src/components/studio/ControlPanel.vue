<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  AlertCircle,
  ChevronRight,
  Download,
  Info,
  Layers3,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  UploadCloud,
} from 'lucide-vue-next';
import {
  ASSET_CATEGORY_OPTIONS,
  COLOR_COUNT_OPTIONS,
  FORMAT_OPTIONS,
  OUTLINE_STYLE_OPTIONS,
  PIXEL_SIZE_MAX,
  PIXEL_SIZE_MIN,
  PIXEL_SIZE_STEP,
  PRESET_COLOR_CAPS,
  SIZING_MODE_OPTIONS,
  TARGET_RESOLUTION_OPTIONS,
} from '../../models/pixel-options';
import type {
  AssetCategoryId,
  BackgroundMode,
  ColorCount,
  DisplayImage,
  ExportFormat,
  ExportScale,
  OutlineMode,
  PresetId,
  SelectedPixelInfo,
  SizingMode,
  StudioItem,
  StudioMode,
  TargetResolution,
} from '../../models/pixel';
import BaseButton from '../ui/BaseButton.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import AssetCategoryPicker from './AssetCategoryPicker.vue';
import BatchQueue from './BatchQueue.vue';
import PaletteEditor from './PaletteEditor.vue';
import PresetPicker from './PresetPicker.vue';

/**
 * 参数控制面板（View 层）。
 * 上传、批量队列、参数、调色板和导出动作都通过事件交给 Controller。
 */
const props = defineProps<{
  image: DisplayImage;
  acceptedTypes: string;
  uploadError: string;
  isLoading: boolean;
  mode: StudioMode;
  isProcessing: boolean;
  isExporting: boolean;
  isTransformingSource: boolean;
  outputSize: { width: number; height: number } | null;
  items: StudioItem[];
  selectedId: string | null;
  hasGrid: boolean;
  paletteColors: string[];
  lockedColors: Set<string>;
  brushColor: string;
  selectedPixelInfo: SelectedPixelInfo | null;
  pixelColorMode: boolean;
  brushColorEnabled: boolean;
}>();

const emit = defineEmits<{
  'files-selected': [files: FileList | File[]];
  reset: [];
  export: [];
  'open-multi-size': [];
  'select-item': [id: string];
  'remove-item': [id: string];
  'retry-item': [id: string];
  'clear-queue': [];
  'export-all': [];
  'export-spritesheet': [];
  'palette-select-color': [color: string];
  'palette-color-change': [from: string, to: string];
  'palette-toggle-lock': [color: string];
  'import-palette': [file: File];
  'change-pixel-color': [color: string];
  'clear-pixel-selection': [];
}>();

const pixelSize = defineModel<number>('pixelSize', { required: true });
const preset = defineModel<PresetId>('preset', { required: true });
const format = defineModel<ExportFormat>('format', { required: true });
const assetCategory = defineModel<AssetCategoryId>('assetCategory', {
  required: true,
});
const colorCount = defineModel<ColorCount>('colorCount', { required: true });
const dither = defineModel<boolean>('dither', { required: true });
const outlineMode = defineModel<OutlineMode>('outlineMode', { required: true });
const macroDetail = defineModel<boolean>('macroDetail', {
  required: true,
});
const sizingMode = defineModel<SizingMode>('sizingMode', { required: true });
const targetResolution = defineModel<TargetResolution>('targetResolution', {
  required: true,
});
const backgroundMode = defineModel<BackgroundMode>('backgroundMode', {
  required: true,
});
const exportScale = defineModel<ExportScale>('exportScale', {
  required: true,
});
const activeTab = defineModel<'params' | 'palette'>('activeTab', {
  default: 'params',
});

const isAssetMode = computed(() => props.mode === 'asset');
const isResolutionMode = computed(
  () => sizingMode.value === 'resolution',
);

const isSmallSource = computed(
  () =>
    !props.image.isDemo &&
    Math.max(props.image.width, props.image.height) < 512,
);

const isWeaponMode = computed(
  () => isAssetMode.value && assetCategory.value === 'weapon',
);

const effectiveColorCount = computed(() =>
  Math.min(colorCount.value, PRESET_COLOR_CAPS[preset.value]),
);

const isOutlineEnabled = computed(() => outlineMode.value !== 'none');
const characterProtectionActive = computed(
  () => isAssetMode.value && assetCategory.value === 'character',
);

function toggleOutline() {
  outlineMode.value = isOutlineEnabled.value ? 'none' : 'standard';
}

const uploadTitle = computed(() =>
  isAssetMode.value
    ? `上传${assetCategoryLabel.value}素材`
    : '上传你的图片',
);

const assetCategoryLabel = computed(
  () =>
    ASSET_CATEGORY_OPTIONS.find(
      (option) => option.id === assetCategory.value,
    )?.label ?? '自定义',
);

const backgroundOptions = [
  { value: 'white' as const, label: '白底' },
  { value: 'transparent' as const, label: '透明' },
];

const exportScaleOptions = [
  { value: 1 as const, label: '1x' },
  { value: 2 as const, label: '2x' },
  { value: 4 as const, label: '4x' },
];

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
let dragDepth = 0;

const rangeProgress = computed(() => {
  const percent =
    ((pixelSize.value - PIXEL_SIZE_MIN) /
      (PIXEL_SIZE_MAX - PIXEL_SIZE_MIN)) *
    100;
  return `${percent}%`;
});

const exportBusy = computed(
  () => props.isProcessing || props.isExporting,
);

function openFilePicker() {
  if (!props.isLoading) fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit('files-selected', input.files);
  }
  input.value = '';
}

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
</script>

<template>
  <aside class="control-panel" aria-label="像素参数设置">
    <header class="panel-header">
      <div class="panel-heading">
        <span class="panel-icon" aria-hidden="true">
          <SlidersHorizontal :size="15" :stroke-width="1.9" />
        </span>
        <h2>调节参数</h2>
      </div>
      <button
        class="reset-button"
        type="button"
        title="恢复默认参数"
        aria-label="恢复默认参数"
        @click="emit('reset')"
      >
        <RotateCcw :size="14" :stroke-width="1.9" />
      </button>
    </header>

    <div class="panel-tabs" role="tablist" aria-label="参数分类">
      <button
        id="tab-params"
        class="panel-tab"
        :class="{ 'is-active': activeTab === 'params' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'params'"
        aria-controls="panel-params"
        @click="activeTab = 'params'"
      >
        参数
      </button>
      <button
        id="tab-palette"
        class="panel-tab"
        :class="{ 'is-active': activeTab === 'palette' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'palette'"
        aria-controls="panel-palette"
        @click="activeTab = 'palette'"
      >
        色板
      </button>
    </div>

    <div
      v-show="activeTab === 'params'"
      id="panel-params"
      class="tab-panel"
      role="tabpanel"
      aria-labelledby="tab-params"
    >
    <section
      v-if="isAssetMode"
      id="asset-types"
      class="panel-section asset-section"
    >
      <div class="field-heading">
        <span>素材类型</span>
      </div>
      <AssetCategoryPicker v-model="assetCategory" />
    </section>

    <section class="panel-section">
      <div class="field-heading">
        <span>{{ isAssetMode ? '素材图片' : '原始图片' }}</span>
      </div>

      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        multiple
        :accept="props.acceptedTypes"
        @change="handleFileChange"
      />

      <button
        class="upload-box"
        :class="{ 'is-dragging': isDragging }"
        type="button"
        :aria-busy="props.isLoading"
        @click="openFilePicker"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <span class="upload-icon" aria-hidden="true">
          <UploadCloud :size="18" :stroke-width="1.8" />
        </span>
        <span class="upload-copy">
          <span class="upload-title">{{ uploadTitle }}</span>
          <span class="upload-meta">
            点击或拖入 · 支持多选 · PNG / JPG / WEBP
          </span>
        </span>
        <ChevronRight class="upload-chevron" :size="15" aria-hidden="true" />

        <span v-if="props.isLoading" class="upload-loading">
          <LoaderCircle class="spin" :size="14" />
          读取中
        </span>
      </button>

      <p v-if="props.uploadError" class="upload-error" role="alert">
        <AlertCircle :size="13" :stroke-width="2" />
        {{ props.uploadError }}
      </p>

      <p v-if="isSmallSource" class="option-note">
        图片较小：像素化前会自动放大分析图，建议选择更大的输出尺寸。
      </p>

      <BatchQueue
        v-if="props.items.length > 0"
        :items="props.items"
        :selected-id="props.selectedId"
        :is-processing="props.isProcessing"
        :is-exporting="props.isExporting"
        @select="emit('select-item', $event)"
        @remove="emit('remove-item', $event)"
        @retry="emit('retry-item', $event)"
        @clear="emit('clear-queue')"
        @export-all="emit('export-all')"
        @export-spritesheet="emit('export-spritesheet')"
      />
    </section>

    <section class="panel-section">
      <div class="field-heading">
        <span>输出尺寸</span>
        <output class="value-pill">
          {{ isResolutionMode ? targetResolution : pixelSize }} px
        </output>
      </div>

      <SegmentedControl
        v-model="sizingMode"
        :options="SIZING_MODE_OPTIONS"
        group-label="尺寸调节方式"
      />

      <div v-if="!isResolutionMode" class="size-control">
        <input
          id="pixel-size"
          v-model.number="pixelSize"
          class="range-slider"
          type="range"
          aria-label="像素颗粒大小"
          :min="PIXEL_SIZE_MIN"
          :max="PIXEL_SIZE_MAX"
          :step="PIXEL_SIZE_STEP"
          :style="{ '--range-progress': rangeProgress }"
        />

        <div class="range-labels" aria-hidden="true">
          <span>更细腻</span>
          <span>更粗犷</span>
        </div>
      </div>

      <div v-else class="size-control">
        <SegmentedControl
          v-model="targetResolution"
          :options="TARGET_RESOLUTION_OPTIONS"
          group-label="目标分辨率"
        />
        <p class="option-note">保持宽高比，按长边输出</p>
      </div>

      <p v-if="isWeaponMode" class="option-note">
        武器会固定外轮廓并保护大面积高光，颗粒过大时会自动限制以保证刃部可见。
      </p>
    </section>

    <section class="panel-section">
      <div class="field-heading">
        <span>轮廓与细节</span>
      </div>

      <div class="feature-columns">
        <div class="feature-column">
          <button
            class="detail-toggle"
            :class="{ 'is-on': isOutlineEnabled }"
            type="button"
            :aria-pressed="isOutlineEnabled"
            @click="toggleOutline"
          >
            <span class="detail-toggle-copy">
              <strong>加轮廓</strong>
            </span>
            <span class="switch" aria-hidden="true"><span></span></span>
          </button>

          <SegmentedControl
            v-if="isOutlineEnabled"
            v-model="outlineMode"
            :options="OUTLINE_STYLE_OPTIONS"
            group-label="轮廓风格"
          />
        </div>

        <div class="feature-column">
          <button
            class="detail-toggle"
            :class="{ 'is-on': macroDetail || characterProtectionActive }"
            type="button"
            :aria-pressed="macroDetail || characterProtectionActive"
            :disabled="characterProtectionActive"
            :title="
              characterProtectionActive
                ? '角色分类会自动保护五官细节'
                : undefined
            "
            @click="macroDetail = !macroDetail"
          >
            <span class="detail-toggle-copy">
              <strong>宏像素细节</strong>
            </span>
            <span class="switch" aria-hidden="true"><span></span></span>
          </button>
        </div>
      </div>

      <p v-if="macroDetail" class="option-note">
        平坦区域保持大块，边缘区块拆成 2×2 微像素。
      </p>
    </section>

    <section class="panel-section">
      <div class="field-heading">
        <span>风格预设</span>
      </div>
      <PresetPicker v-model="preset" />
    </section>
    </div>

    <div
      v-show="activeTab === 'palette'"
      id="panel-palette"
      class="tab-panel"
      role="tabpanel"
      aria-labelledby="tab-palette"
    >
    <section class="panel-section palette-section">
      <div class="field-heading">
        <span>最大色数与抖动</span>
      </div>

      <SegmentedControl
        v-model="colorCount"
        :options="COLOR_COUNT_OPTIONS"
        group-label="最大颜色数"
      />

      <p v-if="effectiveColorCount !== colorCount" class="option-note">
        当前预设最多使用 {{ effectiveColorCount }} 色
      </p>

      <PaletteEditor
        :palette-colors="props.paletteColors"
        :locked-colors="props.lockedColors"
        :brush-color="props.brushColor"
        :selected-pixel-info="props.selectedPixelInfo"
        :pixel-color-mode="props.pixelColorMode"
        :brush-color-enabled="props.brushColorEnabled"
        :disabled="!props.hasGrid || props.isProcessing"
        @select-color="emit('palette-select-color', $event)"
        @change-color="
          (from, to) => emit('palette-color-change', from, to)
        "
        @toggle-lock="emit('palette-toggle-lock', $event)"
        @import-palette="emit('import-palette', $event)"
        @change-pixel-color="emit('change-pixel-color', $event)"
        @clear-pixel-selection="emit('clear-pixel-selection')"
      />

      <button
        class="detail-toggle dither-toggle"
        :class="{ 'is-on': dither }"
        type="button"
        :aria-pressed="dither"
        @click="dither = !dither"
      >
        <span class="detail-toggle-copy">
          <strong>抖动</strong>
        </span>
        <span class="switch" aria-hidden="true"><span></span></span>
      </button>
    </section>
    </div>

    <section class="panel-section export-section">
      <div class="field-heading">
        <span>{{ isAssetMode ? '导出素材' : '导出格式' }}</span>
      </div>

      <SegmentedControl
        v-model="format"
        :options="FORMAT_OPTIONS"
        group-label="导出格式"
      />

      <div v-if="isAssetMode" class="control-row">
        <span class="control-label">背景</span>
        <SegmentedControl
          v-model="backgroundMode"
          :options="backgroundOptions"
          group-label="导出背景"
        />
      </div>

      <div class="control-row">
        <span class="control-label">倍率</span>
        <SegmentedControl
          v-model="exportScale"
          :options="exportScaleOptions"
          group-label="导出倍率"
        />
      </div>

      <button
        class="multi-size-button"
        type="button"
        :disabled="!props.hasGrid || exportBusy"
        @click="emit('open-multi-size')"
      >
        <Layers3 :size="13" :stroke-width="1.9" />
        多尺寸导出
      </button>

      <div class="export-summary">
        <template v-if="props.outputSize">
          <span>
            {{ props.outputSize.width }} ×
            {{ props.outputSize.height }} px
          </span>
          <span class="summary-dot" aria-hidden="true"></span>
          <span>{{ format.toUpperCase() }}</span>
        </template>
        <template v-else>
          <span>
            {{
              isAssetMode && props.image.isDemo
                ? '等待上传素材'
                : props.image.isDemo
                  ? '上传后生成'
                  : '等待生成'
            }}
          </span>
        </template>
      </div>

      <BaseButton
        full-width
        size="md"
        :disabled="!props.hasGrid || exportBusy"
        @click="emit('export')"
      >
        <template #leading>
          <LoaderCircle
            v-if="exportBusy"
            class="spin"
            :size="16"
            :stroke-width="2"
          />
          <Download v-else :size="16" :stroke-width="2" />
        </template>
        {{
          props.isExporting
            ? '正在导出…'
            : props.isProcessing
              ? '正在生成像素画…'
              : isAssetMode
                ? '导出像素素材'
                : '导出像素画'
        }}
      </BaseButton>

      <p class="prototype-note">
        <Info :size="12" :stroke-width="1.9" />
        {{
          props.image.isDemo && !props.hasGrid
            ? '上传后自动生成像素画，可随时对比原图'
            : props.isProcessing
              ? '正在浏览器本地生成像素画…'
              : '像素化在浏览器本地完成，不上传原图'
        }}
      </p>
    </section>
  </aside>
</template>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  background: var(--white);
  border-left: 1px solid var(--color-line);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.panel-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--violet-100);
  border-radius: 9px;
  color: var(--violet-600);
  background: var(--violet-50);
}

.panel-heading h2 {
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 680;
  line-height: 1.35;
  letter-spacing: -0.015em;
}

.reset-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--color-subtle);
  background: transparent;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.reset-button:hover {
  color: var(--violet-700);
  background: var(--violet-50);
  border-color: var(--violet-100);
}

.panel-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  margin-bottom: 16px;
  padding: 3px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--violet-50);
}

.panel-tab {
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--color-muted);
  background: transparent;
  font-size: 11px;
  font-weight: 620;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.panel-tab:hover {
  color: var(--violet-700);
}

.panel-tab.is-active {
  color: var(--violet-800);
  border-color: var(--violet-200);
  background: var(--white);
  box-shadow: var(--shadow-xs);
}

.tab-panel {
  min-height: 0;
}

.panel-section + .panel-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-line);
}

.export-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-line);
}

.field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 9px;
  color: var(--color-ink-soft);
  font-size: 12px;
  font-weight: 650;
}

.upload-box {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 68px;
  padding: 10px 11px;
  overflow: hidden;
  border: 1px dashed var(--color-line-strong);
  border-radius: 11px;
  color: var(--color-ink);
  background: var(--violet-25);
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.upload-box:hover {
  border-color: var(--violet-300);
  background: var(--violet-50);
}

.upload-box.is-dragging {
  border-color: var(--violet-500);
  background: var(--violet-100);
}

.upload-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--violet-100);
  border-radius: 10px;
  color: var(--violet-600);
  background: var(--white);
  box-shadow: var(--shadow-xs);
}

.upload-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.upload-title {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-meta {
  margin-top: 2px;
  overflow: hidden;
  color: var(--color-subtle);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-chevron {
  flex: none;
  color: var(--color-subtle);
}

.upload-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--violet-700);
  background: rgba(255, 255, 255, 0.82);
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(3px);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.upload-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 7px;
  color: #dc2626;
  font-size: 10px;
  line-height: 1.5;
}

.upload-error :deep(svg) {
  flex: none;
  margin-top: 1px;
}

.value-pill {
  padding: 2px 7px;
  border: 1px solid var(--violet-100);
  border-radius: 5px;
  color: var(--violet-700);
  background: var(--violet-50);
  font-size: 9.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.range-slider {
  --range-progress: 0%;
  width: 100%;
  height: 18px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.range-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    to right,
    var(--violet-500) 0,
    var(--violet-600) var(--range-progress),
    var(--color-line) var(--range-progress),
    var(--color-line) 100%
  );
}

.range-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border: 3px solid var(--white);
  border-radius: 50%;
  appearance: none;
  background: var(--violet-600);
  box-shadow:
    0 0 0 1px var(--violet-300),
    0 2px 6px rgba(62, 32, 101, 0.22);
}

.range-slider::-moz-range-track {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-line);
}

.range-slider::-moz-range-progress {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--violet-600);
}

.range-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 3px solid var(--white);
  border-radius: 50%;
  background: var(--violet-600);
  box-shadow:
    0 0 0 1px var(--violet-300),
    0 2px 6px rgba(62, 32, 101, 0.22);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  color: var(--color-subtle);
  font-size: 9.5px;
}

.size-control {
  margin-top: 9px;
}

.option-note {
  margin-top: 7px;
  color: var(--color-subtle);
  font-size: 9.5px;
  line-height: 1.5;
}

.feature-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 7px;
}

.feature-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.feature-column :deep(.segment) {
  height: 30px;
  padding: 0 5px;
  font-size: 11px;
}

.dither-toggle {
  width: 100%;
  margin-top: 8px;
}

.detail-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  background: var(--white);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.detail-toggle:hover {
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.detail-toggle.is-on {
  border-color: var(--violet-300);
  background: var(--violet-25);
}

.detail-toggle:disabled {
  cursor: default;
}

.detail-toggle-copy {
  display: flex;
  align-items: center;
  min-width: 0;
}

.detail-toggle-copy strong {
  color: var(--color-ink-soft);
  font-size: 11px;
  font-weight: 620;
}

.switch {
  position: relative;
  flex: none;
  width: 26px;
  height: 15px;
  border-radius: var(--radius-full);
  background: var(--color-line-strong);
  transition: background 150ms ease;
}

.switch > span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: 0 1px 3px rgba(57, 31, 101, 0.22);
  transition: transform 150ms ease;
}

.detail-toggle.is-on .switch {
  background: var(--violet-500);
}

.detail-toggle.is-on .switch > span {
  transform: translateX(11px);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
}

.control-label {
  flex: none;
  width: 26px;
  color: var(--color-ink-soft);
  font-size: 9.5px;
  font-weight: 600;
}

.control-row :deep(.segmented) {
  flex: 1;
}

.multi-size-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 31px;
  margin-top: 8px;
  border: 1px solid var(--violet-100);
  border-radius: 8px;
  color: var(--violet-700);
  background: var(--violet-25);
  font-size: 10px;
  font-weight: 600;
}

.multi-size-button:hover:not(:disabled) {
  border-color: var(--violet-300);
  background: var(--violet-50);
}

.multi-size-button:disabled {
  opacity: 0.45;
}

.export-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 9px 0 10px;
  color: var(--color-subtle);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.summary-dot {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--color-line-strong);
}

.prototype-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 9px;
  color: var(--color-subtle);
  font-size: 9.5px;
  line-height: 1.5;
}

.prototype-note :deep(svg) {
  flex: none;
}

@media (max-width: 980px) {
  .control-panel {
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    border-top: 1px solid var(--color-line);
    border-left: 0;
    padding: 24px;
  }
}

@media (max-width: 560px) {
  .control-panel {
    padding: 18px;
  }

  .field-heading {
    font-size: 12.5px;
  }
}
</style>
