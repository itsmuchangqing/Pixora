<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { Crop, X } from 'lucide-vue-next';
import type { NormalizedCropRect } from '../../services/image-edit.service';

const props = defineProps<{
  src: string;
  name: string;
}>();

const emit = defineEmits<{
  close: [];
  apply: [rect: NormalizedCropRect];
}>();

type DragMode =
  | 'new'
  | 'move'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

interface Point {
  x: number;
  y: number;
}

const layer = ref<HTMLElement | null>(null);
const naturalSize = ref({ width: 0, height: 0 });
const selection = reactive<NormalizedCropRect>({
  x: 0.1,
  y: 0.1,
  width: 0.8,
  height: 0.8,
});

let dragMode: DragMode | null = null;
let dragAnchor: Point = { x: 0, y: 0 };
let dragStartRect: NormalizedCropRect = { ...selection };

const cropPixels = computed(() => ({
  width: Math.max(
    1,
    Math.round(naturalSize.value.width * selection.width),
  ),
  height: Math.max(
    1,
    Math.round(naturalSize.value.height * selection.height),
  ),
}));

function relativePoint(event: PointerEvent): Point {
  const rect = layer.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01((event.clientY - rect.top) / rect.height),
  };
}

function onImageLoad(event: Event) {
  const image = event.target as HTMLImageElement;
  naturalSize.value = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.target as HTMLElement;
  const handle = target.closest<HTMLElement>('[data-handle]');
  const point = relativePoint(event);

  dragStartRect = { ...selection };

  if (handle?.dataset.handle) {
    dragMode = handle.dataset.handle as DragMode;
  } else if (target.closest('.crop-selection')) {
    dragMode = 'move';
    dragAnchor = point;
  } else {
    dragMode = 'new';
    dragAnchor = point;
    selection.x = point.x;
    selection.y = point.y;
    selection.width = 0.01;
    selection.height = 0.01;
  }

  layer.value?.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (!dragMode) return;
  event.preventDefault();
  const point = relativePoint(event);

  if (dragMode === 'new') {
    selection.x = Math.min(dragAnchor.x, point.x);
    selection.y = Math.min(dragAnchor.y, point.y);
    selection.width = Math.max(
      0.01,
      Math.abs(point.x - dragAnchor.x),
    );
    selection.height = Math.max(
      0.01,
      Math.abs(point.y - dragAnchor.y),
    );
    clampSelection();
    return;
  }

  if (dragMode === 'move') {
    const dx = point.x - dragAnchor.x;
    const dy = point.y - dragAnchor.y;
    selection.x = clampRange(
      dragStartRect.x + dx,
      0,
      1 - dragStartRect.width,
    );
    selection.y = clampRange(
      dragStartRect.y + dy,
      0,
      1 - dragStartRect.height,
    );
    selection.width = dragStartRect.width;
    selection.height = dragStartRect.height;
    return;
  }

  const right = dragStartRect.x + dragStartRect.width;
  const bottom = dragStartRect.y + dragStartRect.height;
  const minSize = 0.02;

  if (dragMode === 'nw' || dragMode === 'sw') {
    selection.x = Math.min(
      point.x,
      right - minSize,
    );
    selection.width = right - selection.x;
  } else {
    selection.x = dragStartRect.x;
    selection.width = Math.max(
      minSize,
      Math.min(1 - selection.x, point.x - dragStartRect.x),
    );
  }

  if (dragMode === 'nw' || dragMode === 'ne') {
    selection.y = Math.min(
      point.y,
      bottom - minSize,
    );
    selection.height = bottom - selection.y;
  } else {
    selection.y = dragStartRect.y;
    selection.height = Math.max(
      minSize,
      Math.min(1 - selection.y, point.y - dragStartRect.y),
    );
  }

  clampSelection();
}

function handlePointerUp() {
  dragMode = null;
}

function clampSelection() {
  selection.x = clampRange(selection.x, 0, 1);
  selection.y = clampRange(selection.y, 0, 1);
  selection.width = clampRange(selection.width, 0.01, 1 - selection.x);
  selection.height = clampRange(selection.height, 0.01, 1 - selection.y);
}

function clampRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clampRange(value, 0, 1);
}

function handleApply() {
  emit('apply', { ...selection });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() =>
  window.removeEventListener('keydown', handleKeydown),
);
</script>

<template>
  <Teleport to="body">
    <div class="crop-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
      >
        <header class="crop-header">
          <div class="crop-title">
            <span class="crop-icon" aria-hidden="true">
              <Crop :size="16" :stroke-width="1.9" />
            </span>
            <div>
              <h2 id="crop-title">裁剪图片</h2>
              <span class="crop-file">{{ props.name }}</span>
            </div>
          </div>
          <button
            class="close-button"
            type="button"
            aria-label="关闭裁剪"
            @click="emit('close')"
          >
            <X :size="17" :stroke-width="2" />
          </button>
        </header>

        <div class="crop-viewport">
          <div class="crop-layer" ref="layer">
            <img
              :src="props.src"
              alt="待裁剪的图片"
              draggable="false"
              @load="onImageLoad"
            />
            <div
              class="selection-layer"
              @pointerdown="handlePointerDown"
              @pointermove="handlePointerMove"
              @pointerup="handlePointerUp"
              @pointercancel="handlePointerUp"
            >
              <div
                class="crop-selection"
                :style="{
                  left: `${selection.x * 100}%`,
                  top: `${selection.y * 100}%`,
                  width: `${selection.width * 100}%`,
                  height: `${selection.height * 100}%`,
                }"
              >
                <span class="grid-line vertical one" aria-hidden="true"></span>
                <span class="grid-line vertical two" aria-hidden="true"></span>
                <span class="grid-line horizontal one" aria-hidden="true"></span>
                <span class="grid-line horizontal two" aria-hidden="true"></span>
                <span class="handle nw" data-handle="nw" aria-hidden="true"></span>
                <span class="handle ne" data-handle="ne" aria-hidden="true"></span>
                <span class="handle sw" data-handle="sw" aria-hidden="true"></span>
                <span class="handle se" data-handle="se" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        </div>

        <footer class="crop-footer">
          <span class="crop-size">
            {{ cropPixels.width }} × {{ cropPixels.height }} px
          </span>
          <div class="crop-actions">
            <button
              class="cancel-button"
              type="button"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              class="apply-button"
              type="button"
              @click="handleApply"
            >
              应用裁剪
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.crop-backdrop {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(21, 14, 32, 0.56);
  backdrop-filter: blur(4px);
}

.crop-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 780px);
  max-height: calc(100vh - 44px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 18px;
  background: var(--white);
  box-shadow: 0 30px 80px -22px rgba(28, 16, 43, 0.55);
}

.crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 17px;
  border-bottom: 1px solid var(--color-line);
}

.crop-title {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.crop-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--violet-100);
  border-radius: 9px;
  color: var(--violet-600);
  background: var(--violet-50);
}

.crop-title h2 {
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 680;
}

.crop-file {
  display: block;
  max-width: 430px;
  overflow: hidden;
  color: var(--color-subtle);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--color-muted);
  background: transparent;
}

.close-button:hover {
  color: var(--color-ink);
  background: var(--violet-50);
}

.crop-viewport {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 20px;
  overflow: auto;
  background:
    radial-gradient(circle at 50% 45%, rgba(139, 92, 246, 0.1), transparent 70%),
    #f8f6fb;
}

.crop-layer {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: min(62vh, 560px);
}

.crop-layer > img {
  display: block;
  max-width: 100%;
  max-height: min(62vh, 560px);
  user-select: none;
}

.selection-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
}

.crop-selection {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 9999px rgba(20, 13, 28, 0.56);
  cursor: move;
}

.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.43);
  pointer-events: none;
}

.grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.grid-line.horizontal {
  right: 0;
  left: 0;
  height: 1px;
}

.grid-line.one {
  left: 33.333%;
  top: 33.333%;
}

.grid-line.vertical.two {
  left: 66.666%;
}

.grid-line.horizontal.two {
  top: 66.666%;
}

.handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid var(--white);
  border-radius: 50%;
  background: var(--violet-500);
  box-shadow: 0 1px 4px rgba(20, 13, 28, 0.35);
}

.handle.nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.handle.ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.handle.sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.handle.se {
  right: -6px;
  bottom: -6px;
  cursor: nwse-resize;
}

.crop-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 17px;
  border-top: 1px solid var(--color-line);
}

.crop-size {
  color: var(--color-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.crop-actions {
  display: flex;
  gap: 7px;
}

.cancel-button,
.apply-button {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 620;
}

.cancel-button {
  border: 1px solid var(--color-line);
  color: var(--color-muted);
  background: var(--white);
}

.cancel-button:hover {
  color: var(--violet-700);
  background: var(--violet-25);
}

.apply-button {
  border: 1px solid transparent;
  color: var(--white);
  background: var(--gradient-violet);
  box-shadow: var(--shadow-violet);
}

@media (max-width: 560px) {
  .crop-backdrop {
    padding: 12px;
  }

  .crop-dialog {
    max-height: calc(100vh - 24px);
  }

  .crop-viewport {
    padding: 12px;
  }

  .crop-file {
    max-width: 180px;
  }
}
</style>
