<script setup lang="ts">
import { computed } from 'vue';

/**
 * 通用按钮组件（View 层的基础 UI）。
 * 通过 variant / size 控制样式，业务组件不需要重复写按钮 CSS。
 */
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  fullWidth: false,
  type: 'button',
  disabled: false,
});

const classes = computed(() => [
  'base-button',
  `variant-${props.variant}`,
  `size-${props.size}`,
  { 'is-full-width': props.fullWidth },
]);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">

    <span v-if="$slots.leading" class="button-icon" aria-hidden="true">
      <slot name="leading" />
    </span>

    <span class="button-label"><slot /></span>

    <span v-if="$slots.trailing" class="button-icon" aria-hidden="true">
      <slot name="trailing" />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  transition:
    transform 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    border-color 180ms var(--ease-out),
    color 180ms var(--ease-out);
}

.base-button:disabled {
  opacity: 0.52;
  transform: none !important;
}

.variant-primary {
  color: var(--white);
  background: var(--gradient-violet);
  box-shadow: var(--shadow-violet);
}

.variant-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 30px -12px rgba(109, 40, 217, 0.56);
}

.variant-primary:active:not(:disabled) {
  transform: translateY(0);
}

.variant-secondary {
  color: var(--color-ink);
  background: var(--white);
  border-color: var(--color-line-strong);
  box-shadow: var(--shadow-xs);
}

.variant-secondary:hover:not(:disabled) {
  color: var(--violet-700);
  background: var(--violet-25);
  border-color: var(--violet-300);
}

.variant-ghost {
  color: var(--color-muted);
  background: transparent;
}

.variant-ghost:hover:not(:disabled) {
  color: var(--violet-700);
  background: var(--violet-50);
}

.size-sm {
  height: 38px;
  padding: 0 16px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.size-md {
  height: 44px;
  padding: 0 20px;
  font-size: 14px;
}

.size-lg {
  height: 52px;
  padding: 0 25px;
  font-size: 15px;
}

.button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  line-height: 0;
}

.button-label {
  display: inline-flex;
  align-items: center;
}

.is-full-width {
  width: 100%;
}

@media (max-width: 560px) {
  .size-lg {
    height: 48px;
    padding: 0 18px;
    font-size: 14px;
  }
}
</style>
