<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { PRESET_OPTIONS } from '../../models/pixel-options';
import type { PresetId } from '../../models/pixel';

/**
 * 风格预设选择器（View 层子组件）。
 * 用 v-model 与父组件同步；色板缩略图由数据中的颜色动态渲染。
 */
const model = defineModel<PresetId>({ required: true });
</script>

<template>
  <div class="preset-grid" role="group" aria-label="风格预设">

    <button
      v-for="preset in PRESET_OPTIONS"
      :key="preset.id"
      class="preset-card"
      :class="{ 'is-active': model === preset.id }"
      type="button"
      :aria-pressed="model === preset.id"
      @click="model = preset.id"
    >

      <span class="preset-thumb" aria-hidden="true">
        <span
          v-for="(color, index) in preset.colors"
          :key="`${preset.id}-${index}`"
          :style="{ backgroundColor: color }"
        ></span>
      </span>

      <span class="preset-copy">
        <strong>{{ preset.label }}</strong>
      </span>

      <span
        v-if="model === preset.id"
        class="preset-check"
        aria-hidden="true"
      >
        <Check :size="9" :stroke-width="3.2" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.preset-card:last-child:nth-child(odd) {
  grid-column: span 2;
}

.preset-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 60px;
  padding: 8px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 11px;
  color: var(--color-ink);
  background: var(--white);
  text-align: left;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.preset-card:hover {
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.preset-card.is-active {
  border-color: var(--violet-400);
  background: var(--violet-25);
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.06);
}

.preset-thumb {
  display: grid;
  flex: none;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1px;
  width: 40px;
  height: 40px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid rgba(226, 218, 237, 0.75);
  border-radius: 7px;
  background: var(--white);
}

.preset-thumb span {
  border-radius: 0.8px;
}

.preset-copy {
  display: flex;
  align-items: center;
  min-width: 0;
}

.preset-copy strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 620;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-check {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  color: var(--white);
  background: var(--violet-600);
}
</style>
