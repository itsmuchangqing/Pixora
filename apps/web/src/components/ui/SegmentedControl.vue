<script setup lang="ts" generic="T extends string | number">
/**
 * 通用分段选择器（View 层基础组件）。
 * 父组件通过 v-model 绑定选中的字符串值。
 * 使用 role="group" + aria-pressed 让键盘和读屏软件都能理解选中状态。
 */
const props = defineProps<{
  options: readonly { value: T; label: string }[];
  groupLabel: string;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="segmented" role="group" :aria-label="props.groupLabel">

    <button
      v-for="option in props.options"
      :key="option.value"
      class="segment"
      :class="{ 'is-active': model === option.value }"
      type="button"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-line);
  border-radius: 11px;
  background: var(--violet-50);
}

.segment {
  height: 35px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  color: var(--color-muted);
  background: transparent;
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.03em;
  transition:
    color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.segment:hover {
  color: var(--violet-700);
}

.segment.is-active {
  color: var(--violet-700);
  background: var(--white);
  box-shadow:
    0 1px 3px rgba(40, 20, 68, 0.08),
    0 4px 10px -8px rgba(40, 20, 68, 0.24);
}
</style>
