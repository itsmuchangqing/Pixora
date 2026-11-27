<script setup lang="ts">
import { computed } from 'vue';
import {
  ClipboardPaste,
  Crop,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  MousePointer2,
  Move,
  Paintbrush,
  PaintBucket,
  Pipette,
  Redo2,
  RotateCcw,
  RotateCw,
  Undo2,
} from 'lucide-vue-next';
import type { EditorTool } from '../../models/pixel';

const props = defineProps<{
  hasSelection: boolean;
  hasGrid: boolean;
  isProcessing: boolean;
  isTransformingSource: boolean;
  selectedSourceEdited: boolean;
  editorTool: EditorTool;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  showPixelGrid: boolean;
  hasSelectedPixel: boolean;
  selectedPixelColor: string | null;
}>();

const emit = defineEmits<{
  crop: [];
  rotate: [direction: 'left' | 'right'];
  flip: [direction: 'horizontal' | 'vertical'];
  paste: [];
  restore: [];
  'set-tool': [tool: EditorTool];
  'set-brush-color': [color: string];
  'set-brush-size': [size: number];
  undo: [];
  redo: [];
  'toggle-grid': [];
  'open-palette': [];
  'preview-pixel-color': [color: string];
  'change-pixel-color': [color: string];
}>();

const isPixelColorMode = computed(
  () => props.editorTool === 'select' && props.hasSelectedPixel,
);
const isBrushColorMode = computed(
  () => props.editorTool === 'brush' || props.editorTool === 'bucket',
);
const colorControlEnabled = computed(
  () =>
    props.hasGrid &&
    !props.isProcessing &&
    (isPixelColorMode.value || isBrushColorMode.value),
);
const displayedColor = computed(() =>
  isPixelColorMode.value
    ? (props.selectedPixelColor ?? props.brushColor)
    : props.brushColor,
);
const colorControlTitle = computed(() => {
  if (!props.hasGrid) return '选择颜色';
  if (props.isProcessing) return '正在生成像素画';
  if (props.editorTool === 'select') {
    return props.hasSelectedPixel
      ? '选择颜色：修改选中像素'
      : '选择颜色：先选择一个像素';
  }
  if (isBrushColorMode.value) return '选择颜色：画笔颜色';
  if (props.editorTool === 'eraser') {
    return '橡皮擦恢复生成色，不使用颜色';
  }
  if (props.editorTool === 'eyedropper') {
    return '选择颜色：吸管会直接取色';
  }
  return '选择颜色：当前工具不使用颜色';
});

function handleColorInput(event: Event) {
  if (!colorControlEnabled.value) return;
  const value = (event.target as HTMLInputElement).value;
  if (isPixelColorMode.value) {
    emit('preview-pixel-color', value);
  } else if (isBrushColorMode.value) {
    emit('set-brush-color', value);
  }
}

function handleColorCommit(event: Event) {
  if (!colorControlEnabled.value) return;
  const value = (event.target as HTMLInputElement).value;
  if (isPixelColorMode.value) {
    emit('change-pixel-color', value);
  } else if (isBrushColorMode.value) {
    emit('set-brush-color', value);
  }
}

const sourceDisabled = () =>
  !props.hasSelection ||
  props.isProcessing ||
  props.isTransformingSource;

const pixelTools: Array<{
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: typeof Move;
}> = [
  { id: 'move', label: '移动画布', shortcut: 'V', icon: Move },
  { id: 'select', label: '选择像素', shortcut: 'S', icon: MousePointer2 },
  { id: 'brush', label: '画笔', shortcut: 'B', icon: Paintbrush },
  { id: 'eraser', label: '橡皮擦', shortcut: 'E', icon: Eraser },
  { id: 'bucket', label: '油漆桶', shortcut: 'K', icon: PaintBucket },
  { id: 'eyedropper', label: '吸管取色', shortcut: 'I', icon: Pipette },
];

const brushSizes = [1, 2, 3, 4] as const;
</script>

<template>
  <div class="editor-toolbar" aria-label="图片调整与像素编辑工具">
    <div class="tool-group source-tools">
      <button
        class="icon-tool"
        type="button"
        title="裁剪"
        aria-label="裁剪"
        :disabled="sourceDisabled()"
        @click="emit('crop')"
      >
        <Crop :size="15" :stroke-width="1.9" />
      </button>
      <button
        class="icon-tool"
        type="button"
        title="向左旋转 90°"
        aria-label="向左旋转 90 度"
        :disabled="sourceDisabled()"
        @click="emit('rotate', 'left')"
      >
        <RotateCcw :size="15" :stroke-width="1.9" />
      </button>
      <button
        class="icon-tool"
        type="button"
        title="向右旋转 90°"
        aria-label="向右旋转 90 度"
        :disabled="sourceDisabled()"
        @click="emit('rotate', 'right')"
      >
        <RotateCw :size="15" :stroke-width="1.9" />
      </button>
      <button
        class="icon-tool"
        type="button"
        title="水平翻转"
        aria-label="水平翻转"
        :disabled="sourceDisabled()"
        @click="emit('flip', 'horizontal')"
      >
        <FlipHorizontal2 :size="15" :stroke-width="1.9" />
      </button>
      <button
        class="icon-tool"
        type="button"
        title="垂直翻转"
        aria-label="垂直翻转"
        :disabled="sourceDisabled()"
        @click="emit('flip', 'vertical')"
      >
        <FlipVertical2 :size="15" :stroke-width="1.9" />
      </button>
      <button
        class="icon-tool"
        type="button"
        title="粘贴剪贴板图片"
        aria-label="粘贴剪贴板图片"
        :disabled="props.isTransformingSource"
        @click="emit('paste')"
      >
        <ClipboardPaste :size="15" :stroke-width="1.9" />
      </button>
      <button
        v-if="props.selectedSourceEdited"
        class="icon-tool restore-tool"
        type="button"
        title="恢复最初上传的原图"
        aria-label="恢复原始图片"
        :disabled="props.isTransformingSource"
        @click="emit('restore')"
      >
        <Undo2 :size="15" :stroke-width="1.9" />
      </button>
    </div>

    <span class="tool-separator" aria-hidden="true"></span>

    <div class="tool-group pixel-tools">
      <button
        v-for="tool in pixelTools"
        :key="tool.id"
        class="icon-tool"
        :class="{ 'is-active': props.editorTool === tool.id }"
        type="button"
        :title="
          tool.id === 'eraser'
            ? `橡皮擦：恢复生成色（${tool.shortcut}）`
            : `${tool.label}（${tool.shortcut}）`
        "
        :aria-label="tool.label"
        :aria-pressed="props.editorTool === tool.id"
        :disabled="!props.hasGrid || props.isProcessing"
        @click="emit('set-tool', tool.id)"
      >
        <component :is="tool.icon" :size="15" :stroke-width="1.9" />
      </button>

      <label
        class="brush-color"
        :class="{ 'is-disabled': !colorControlEnabled }"
        :title="colorControlTitle"
      >
        <input
          type="color"
          :value="displayedColor"
          :aria-label="colorControlTitle"
          :title="colorControlTitle"
          :disabled="!colorControlEnabled"
          @input="handleColorInput"
          @change="handleColorCommit"
        />
      </label>
      <button
        class="color-link"
        type="button"
        :title="`${colorControlTitle}；打开色板`"
        @click="emit('open-palette')"
      >
        {{ displayedColor.toUpperCase() }}
      </button>

      <div class="brush-sizes" role="group" aria-label="画笔大小">
        <button
          v-for="size in brushSizes"
          :key="size"
          class="size-tool"
          :class="{ 'is-active': props.brushSize === size }"
          type="button"
          :aria-pressed="props.brushSize === size"
          :disabled="!props.hasGrid || props.isProcessing"
          :title="`${size} 像素画笔`"
          @click="emit('set-brush-size', size)"
        >
          {{ size }}
        </button>
      </div>

      <button
        class="icon-tool history-tool"
        type="button"
        title="撤销（Ctrl/Cmd + Z）"
        aria-label="撤销"
        :disabled="!props.canUndo"
        @click="emit('undo')"
      >
        <Undo2 :size="15" :stroke-width="1.9" />
        <span class="history-label">撤销</span>
      </button>
      <button
        class="icon-tool history-tool"
        type="button"
        title="重做（Ctrl/Cmd + Shift + Z）"
        aria-label="重做"
        :disabled="!props.canRedo"
        @click="emit('redo')"
      >
        <Redo2 :size="15" :stroke-width="1.9" />
        <span class="history-label">重做</span>
      </button>
      <button
        class="icon-tool"
        :class="{ 'is-active': props.showPixelGrid }"
        type="button"
        title="显示像素网格（G）"
        aria-label="显示像素网格"
        :aria-pressed="props.showPixelGrid"
        :disabled="!props.hasGrid"
        @click="emit('toggle-grid')"
      >
        <Grid3X3 :size="15" :stroke-width="1.9" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: min(100%, 1180px);
  margin: 0 auto 8px;
  padding: 5px 7px;
  overflow-x: auto;
  border: 1px solid rgba(228, 221, 237, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: var(--shadow-xs);
  scrollbar-width: none;
  backdrop-filter: blur(10px);
}

.editor-toolbar::-webkit-scrollbar {
  display: none;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.tool-separator {
  flex: none;
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--color-line);
}

.icon-tool {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--color-muted);
  background: transparent;
  transition:
    color 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.icon-tool:hover:not(:disabled) {
  color: var(--violet-700);
  border-color: var(--violet-100);
  background: var(--violet-25);
}

.icon-tool.is-active {
  color: var(--violet-800);
  border-color: var(--violet-300);
  background: var(--violet-100);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.icon-tool:disabled {
  opacity: 0.35;
}

.restore-tool {
  color: var(--violet-600);
}

.brush-color {
  position: relative;
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  background:
    linear-gradient(45deg, #f0ecf5 25%, transparent 25%) 0 0 / 8px 8px,
    linear-gradient(45deg, transparent 75%, #f0ecf5 75%) 0 0 / 8px 8px,
    #fff;
}

.brush-color.is-disabled {
  opacity: 0.35;
}

.brush-color input {
  position: absolute;
  inset: -8px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.brush-color input:disabled {
  cursor: default;
}

.color-link {
  height: 29px;
  padding: 0 4px;
  border: 0;
  border-radius: 5px;
  color: var(--color-muted);
  background: transparent;
  font-family: var(--font-mono, monospace);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.color-link:hover {
  color: var(--violet-700);
  background: var(--violet-25);
}

.history-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: auto;
  padding: 0 7px;
}

.history-label {
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.brush-sizes {
  display: flex;
  gap: 1px;
  padding: 2px;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  background: var(--violet-25);
}

.size-tool {
  width: 20px;
  height: 23px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--color-subtle);
  background: transparent;
  font-size: 9px;
  font-weight: 650;
}

.size-tool:hover:not(:disabled) {
  color: var(--violet-700);
}

.size-tool.is-active {
  color: var(--violet-700);
  background: var(--white);
  box-shadow: var(--shadow-xs);
}

.size-tool:disabled {
  opacity: 0.35;
}

@media (max-width: 560px) {
  .editor-toolbar {
    margin-bottom: 6px;
    padding: 4px 5px;
  }

  .icon-tool {
    width: 27px;
    height: 27px;
  }

  .history-tool {
    width: auto;
    padding: 0 5px;
  }

  .history-label {
    display: none;
  }

  .color-link {
    display: none;
  }

  .brush-sizes {
    display: none;
  }
}
</style>
