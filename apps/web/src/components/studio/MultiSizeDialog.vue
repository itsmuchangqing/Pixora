<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Download, X } from 'lucide-vue-next';
import type { TargetResolution } from '../../models/pixel';

const props = defineProps<{
  format: string;
  disabled: boolean;
}>();

const emit = defineEmits<{
  close: [];
  apply: [sizes: TargetResolution[]];
}>();

const sizeOptions: TargetResolution[] = [32, 64, 128, 256, 512];
const selected = ref<Set<TargetResolution>>(new Set([64, 128, 256]));

function toggle(size: TargetResolution) {
  const next = new Set(selected.value);
  if (next.has(size)) next.delete(size);
  else next.add(size);
  selected.value = next;
}

function apply() {
  const sizes = sizeOptions
    .filter((size) => selected.value.has(size))
    .sort((first, second) => first - second);
  emit('apply', sizes);
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
    <div class="dialog-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="size-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-size-title"
      >
        <header class="dialog-header">
          <div>
            <h2 id="multi-size-title">多尺寸导出</h2>
            <span class="dialog-subline">按长边等比输出，保持当前像素颜色</span>
          </div>
          <button
            class="close-button"
            type="button"
            aria-label="关闭多尺寸导出"
            @click="emit('close')"
          >
            <X :size="17" :stroke-width="2" />
          </button>
        </header>

        <div class="size-grid" role="group" aria-label="选择导出尺寸">
          <button
            v-for="size in sizeOptions"
            :key="size"
            class="size-option"
            :class="{ 'is-active': selected.has(size) }"
            type="button"
            :aria-pressed="selected.has(size)"
            @click="toggle(size)"
          >
            <strong>{{ size }}</strong>
            <span>px</span>
          </button>
        </div>

        <footer class="dialog-footer">
          <span class="format-label">{{ props.format.toUpperCase() }}</span>
          <div class="dialog-actions">
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
              :disabled="selected.size === 0 || props.disabled"
              @click="apply"
            >
              <Download :size="14" :stroke-width="2" />
              导出 {{ selected.size }} 个尺寸
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  z-index: 210;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(21, 14, 32, 0.5);
  backdrop-filter: blur(4px);
}

.size-dialog {
  width: min(100%, 480px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 17px;
  background: var(--white);
  box-shadow: 0 28px 72px -24px rgba(28, 16, 43, 0.52);
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid var(--color-line);
}

.dialog-header h2 {
  color: var(--color-ink);
  font-size: 16px;
  font-weight: 680;
}

.dialog-subline {
  display: block;
  margin-top: 3px;
  color: var(--color-subtle);
  font-size: 10px;
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

.size-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding: 18px;
}

.size-option {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  height: 58px;
  padding: 0;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  color: var(--color-muted);
  background: var(--white);
}

.size-option:hover {
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.size-option.is-active {
  color: var(--violet-700);
  border-color: var(--violet-400);
  background: var(--violet-50);
  box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.06);
}

.size-option strong {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
}

.size-option span {
  font-size: 8.5px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--color-line);
}

.format-label {
  color: var(--color-subtle);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
}

.dialog-actions {
  display: flex;
  gap: 7px;
}

.cancel-button,
.apply-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 34px;
  padding: 0 13px;
  border-radius: 8px;
  font-size: 11.5px;
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

.apply-button:disabled {
  opacity: 0.45;
}

@media (max-width: 480px) {
  .size-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 14px;
  }

  .size-option:nth-child(4),
  .size-option:nth-child(5) {
    grid-column: span 1;
  }

  .dialog-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-actions {
    width: 100%;
  }

  .apply-button {
    flex: 1;
  }
}
</style>
