<script setup lang="ts">
import { Info, X } from 'lucide-vue-next';

/**
 * 轻提示组件。由页面 Controller 控制 message，
 * 组件本身不自动计时，只负责呈现和发出关闭事件。
 */
defineProps<{
  message: string;
}>();

defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <Transition name="toast">
    <div
      v-if="message"
      class="toast"
      role="status"
      aria-live="polite"
    >

      <span class="toast-icon" aria-hidden="true">
        <Info :size="16" :stroke-width="2" />
      </span>

      <p class="toast-message">{{ message }}</p>

      <button
        class="toast-close"
        type="button"
        aria-label="关闭提示"
        @click="$emit('dismiss')"
      >
        <X :size="15" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  z-index: 100;
  left: 50%;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: min(480px, calc(100vw - 32px));
  padding: 11px 11px 11px 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 13px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(29, 20, 40, 0.94);
  box-shadow: 0 18px 40px -16px rgba(25, 13, 44, 0.55);
  backdrop-filter: blur(12px);
  transform: translateX(-50%);
}

.toast-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--violet-200);
  background: rgba(167, 139, 250, 0.14);
}

.toast-message {
  font-size: 12.5px;
  line-height: 1.55;
}

.toast-close {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.toast-close:hover {
  color: var(--white);
  background: rgba(255, 255, 255, 0.08);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (max-width: 560px) {
  .toast {
    bottom: 18px;
  }
}
</style>
