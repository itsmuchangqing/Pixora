<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Lock,
  MousePointer2,
  Unlock,
  Upload,
  X,
} from 'lucide-vue-next';
import type { SelectedPixelInfo } from '../../models/pixel';

const props = defineProps<{
  paletteColors: string[];
  lockedColors: Set<string>;
  brushColor: string;
  disabled: boolean;
  selectedPixelInfo: SelectedPixelInfo | null;
  pixelColorMode: boolean;
  brushColorEnabled: boolean;
}>();

const emit = defineEmits<{
  'select-color': [color: string];
  'change-color': [from: string, to: string];
  'toggle-lock': [color: string];
  'import-palette': [file: File];
  'change-pixel-color': [color: string];
  'clear-pixel-selection': [];
}>();

const selectedColor = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.paletteColors,
  (colors) => {
    if (
      !selectedColor.value ||
      !colors.includes(selectedColor.value)
    ) {
      selectedColor.value = colors[0] ?? null;
    }
  },
  { immediate: true },
);

// 吸管或工具栏选色后，右侧色板同步高亮同一个颜色。
// 这样用户点到画布上的某个像素，就能立刻在色板里看到对应色。
watch(
  () => props.brushColor,
  (color) => {
    const matched = props.paletteColors.find(
      (item) => item.toLowerCase() === color.toLowerCase(),
    );
    if (matched) selectedColor.value = matched;
  },
);

// 选择画布像素后，色板高亮该像素当前颜色。
watch(
  () => props.selectedPixelInfo?.hex,
  (hex) => {
    if (!hex) return;
    const matched = props.paletteColors.find(
      (item) => item.toLowerCase() === hex.toLowerCase(),
    );
    if (matched) selectedColor.value = matched;
  },
);

function chooseColor(color: string) {
  selectedColor.value = color;
  if (props.pixelColorMode) {
    // 选择像素工具下，点击色板直接替换这个像素。
    emit('change-pixel-color', color);
  } else if (props.brushColorEnabled) {
    // 画笔/油漆桶下，点击色板设置画笔颜色。
    emit('select-color', color);
  }
  // 移动、橡皮擦、吸管等工具下只做色板查看和高亮，不改变画笔或像素。
}

function applyColor(event: Event) {
  const nextColor = (event.target as HTMLInputElement).value;
  if (!selectedColor.value || nextColor === selectedColor.value) return;
  emit('change-color', selectedColor.value, nextColor);
  selectedColor.value = nextColor;
  emit('select-color', nextColor);
}

function openPaletteFile() {
  fileInput.value?.click();
}

function handlePaletteFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('import-palette', file);
  input.value = '';
}
</script>

<template>
  <div class="palette-editor" :class="{ 'is-disabled': props.disabled }">
    <div v-if="props.selectedPixelInfo" class="selected-pixel-card">
      <div class="selected-pixel-head">
        <span class="selected-pixel-title">
          <MousePointer2 :size="12" :stroke-width="1.9" />
          选中像素
        </span>
        <span class="selected-pixel-coords">
          x {{ props.selectedPixelInfo.x }} · y
          {{ props.selectedPixelInfo.y }}
        </span>
        <button
          class="selected-pixel-close"
          type="button"
          aria-label="取消选中像素"
          title="取消选中"
          @click="emit('clear-pixel-selection')"
        >
          <X :size="12" :stroke-width="2" />
        </button>
      </div>

      <div class="selected-pixel-body">
        <span
          class="selected-pixel-swatch"
          :class="{
            'is-transparent': props.selectedPixelInfo.transparent,
          }"
          :style="{
            backgroundColor:
              props.selectedPixelInfo.hex ?? 'transparent',
          }"
        ></span>
        <span class="selected-pixel-hex">
          {{
            props.selectedPixelInfo.transparent
              ? '透明'
              : props.selectedPixelInfo.hex?.toUpperCase()
          }}
        </span>
      </div>

      <p class="selected-pixel-note">
        {{
          props.pixelColorMode
            ? '使用“选择颜色”控件或点击下方色板，会直接替换此像素。'
            : '切回“选择像素”工具后，可继续修改此像素。'
        }}
      </p>
    </div>

    <div v-if="props.paletteColors.length > 0" class="palette-row">
      <button
        v-for="color in props.paletteColors"
        :key="color"
        class="swatch"
        :class="{
          'is-active': color === selectedColor,
          'is-brush': color.toLowerCase() === props.brushColor.toLowerCase(),
        }"
        type="button"
        :style="{ backgroundColor: color }"
        :title="color"
        :aria-label="
          props.pixelColorMode
            ? `将选中像素改为 ${color}`
            : `选择颜色 ${color}`
        "
        :aria-pressed="color === selectedColor"
        :disabled="props.disabled"
        @click="chooseColor(color)"
      >
        <Lock
          v-if="props.lockedColors.has(color)"
          class="lock-mark"
          :size="9"
          :stroke-width="2.4"
          aria-hidden="true"
        />
      </button>
    </div>

    <div v-if="selectedColor" class="palette-detail">
      <label class="color-input" title="修改当前颜色">
        <input
          type="color"
          :value="selectedColor"
          aria-label="修改当前颜色"
          :disabled="props.disabled || props.lockedColors.has(selectedColor)"
          @change="applyColor"
        />
      </label>
      <span class="color-hex">{{ selectedColor.toUpperCase() }}</span>
      <button
        class="detail-button"
        type="button"
        :title="
          props.lockedColors.has(selectedColor)
            ? '解锁当前颜色'
            : '锁定当前颜色'
        "
        :aria-label="
          props.lockedColors.has(selectedColor)
            ? '解锁当前颜色'
            : '锁定当前颜色'
        "
        :disabled="props.disabled"
        @click="emit('toggle-lock', selectedColor)"
      >
        <Unlock
          v-if="props.lockedColors.has(selectedColor)"
          :size="12"
          :stroke-width="1.9"
        />
        <Lock v-else :size="12" :stroke-width="1.9" />
      </button>
      <button
        class="import-button"
        type="button"
        :disabled="props.disabled"
        @click="openPaletteFile"
      >
        <Upload :size="12" :stroke-width="1.9" />
        导入色板
      </button>
    </div>

    <p v-else class="palette-empty">
      生成图片后可在这里编辑实际使用的颜色。
    </p>

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      accept=".hex,.pal,.txt,text/plain"
      @change="handlePaletteFile"
    />
  </div>
</template>

<style scoped>
.palette-editor {
  margin-top: 8px;
}

.palette-editor.is-disabled {
  opacity: 0.55;
}

.selected-pixel-card {
  margin-bottom: 9px;
  padding: 8px;
  border: 1px solid var(--violet-200);
  border-radius: 9px;
  background: var(--violet-25);
}

.selected-pixel-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.selected-pixel-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--violet-800);
  font-size: 10px;
  font-weight: 650;
}

.selected-pixel-coords {
  color: var(--color-subtle);
  font-family: var(--font-mono, monospace);
  font-size: 8.5px;
  font-variant-numeric: tabular-nums;
}

.selected-pixel-close {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--color-subtle);
  background: transparent;
}

.selected-pixel-close:hover {
  color: var(--violet-700);
  background: var(--white);
}

.selected-pixel-body {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.selected-pixel-swatch {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(41, 25, 61, 0.16);
  border-radius: 5px;
  background-color: var(--white);
}

.selected-pixel-swatch.is-transparent {
  background-image:
    linear-gradient(45deg, #ddd6e6 25%, transparent 25%),
    linear-gradient(-45deg, #ddd6e6 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd6e6 75%),
    linear-gradient(-45deg, transparent 75%, #ddd6e6 75%);
  background-position:
    0 0,
    0 5px,
    5px -5px,
    -5px 0;
  background-size: 10px 10px;
}

.selected-pixel-hex {
  color: var(--color-ink-soft);
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  font-weight: 600;
}

.selected-pixel-note {
  margin-top: 5px;
  color: var(--color-subtle);
  font-size: 8.5px;
  line-height: 1.5;
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.swatch {
  position: relative;
  width: 21px;
  height: 21px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(41, 25, 61, 0.16);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.swatch:hover:not(:disabled) {
  transform: translateY(-1px);
}

.swatch.is-active {
  outline: 2px solid var(--violet-500);
  outline-offset: 1px;
}

.swatch.is-brush::after {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: 0 0 0 1px rgba(20, 13, 28, 0.45);
  content: '';
}

.lock-mark {
  position: absolute;
  top: 1px;
  left: 1px;
  color: var(--white);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
}

.palette-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
}

.color-input {
  display: block;
  width: 25px;
  height: 25px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  background: var(--white);
}

.color-input input {
  width: 38px;
  height: 38px;
  margin: -7px;
  padding: 0;
  border: 0;
  cursor: pointer;
}

.color-input input:disabled {
  cursor: default;
  opacity: 0.4;
}

.color-hex {
  color: var(--color-ink-soft);
  font-family: var(--font-mono, monospace);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.detail-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  color: var(--color-muted);
  background: var(--white);
}

.detail-button:hover:not(:disabled) {
  color: var(--violet-700);
  background: var(--violet-25);
}

.import-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  margin-left: auto;
  padding: 0 7px;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  color: var(--color-muted);
  background: var(--white);
  font-size: 9px;
  font-weight: 600;
}

.import-button:hover:not(:disabled) {
  color: var(--violet-700);
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.palette-empty {
  color: var(--color-subtle);
  font-size: 9.5px;
  line-height: 1.5;
}

@media (max-width: 420px) {
  .swatch {
    width: 24px;
    height: 24px;
  }
}
</style>
