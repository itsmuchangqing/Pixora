<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const cancelButton = ref<HTMLButtonElement | null>(null);

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel');
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  requestAnimationFrame(() => cancelButton.value?.focus());
});

onBeforeUnmount(() =>
  window.removeEventListener('keydown', handleKeydown),
);
</script>

<template>
  <Teleport to="body">
    <div
      class="guard-backdrop"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <section
        class="guard-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guard-title"
        aria-describedby="guard-message"
      >
        <header class="guard-header">
          <span class="guard-icon" aria-hidden="true">
            <AlertTriangle :size="18" :stroke-width="1.9" />
          </span>
          <div class="guard-copy">
            <h2 id="guard-title">{{ props.title }}</h2>
            <p id="guard-message">{{ props.message }}</p>
          </div>
          <button
            class="guard-close"
            type="button"
            aria-label="取消并关闭"
            @click="emit('cancel')"
          >
            <X :size="16" :stroke-width="2" />
          </button>
        </header>

        <footer class="guard-actions">
          <button
            ref="cancelButton"
            class="cancel-button"
            type="button"
            @click="emit('cancel')"
          >
            {{ props.cancelLabel || '取消' }}
          </button>
          <button
            class="confirm-button"
            type="button"
            @click="emit('confirm')"
          >
            {{ props.confirmLabel }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.guard-backdrop {
  position: fixed;
  z-index: 320;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(21, 14, 32, 0.56);
  backdrop-filter: blur(5px);
}

.guard-dialog {
  width: min(100%, 470px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 17px;
  background: var(--white);
  box-shadow: 0 30px 80px -24px rgba(28, 16, 43, 0.58);
}

.guard-header {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 18px 18px 15px;
  border-bottom: 1px solid var(--color-line);
}

.guard-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid #f4d3b0;
  border-radius: 10px;
  color: #b45309;
  background: #fffbeb;
}

.guard-copy {
  flex: 1;
  min-width: 0;
}

.guard-copy h2 {
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 680;
  line-height: 1.4;
}

.guard-copy p {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 11.5px;
  line-height: 1.7;
}

.guard-close {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--color-subtle);
  background: transparent;
}

.guard-close:hover {
  color: var(--color-ink);
  background: var(--violet-25);
}

.guard-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
}

.cancel-button,
.confirm-button {
  height: 34px;
  padding: 0 14px;
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
  color: var(--color-ink);
  background: var(--violet-25);
}

.confirm-button {
  border: 1px solid #b42318;
  color: var(--white);
  background: #c43227;
  box-shadow: 0 8px 18px -12px rgba(180, 35, 24, 0.7);
}

.confirm-button:hover {
  background: #b42318;
}

.confirm-button:focus-visible,
.cancel-button:focus-visible {
  outline: 2px solid rgba(196, 50, 39, 0.28);
  outline-offset: 2px;
}
</style>
