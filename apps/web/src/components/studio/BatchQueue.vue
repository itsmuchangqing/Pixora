<script setup lang="ts">
import {
  Archive,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-vue-next';
import type { StudioItem } from '../../models/pixel';

const props = defineProps<{
  items: StudioItem[];
  selectedId: string | null;
  isProcessing: boolean;
  isExporting: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  remove: [id: string];
  retry: [id: string];
  clear: [];
  'export-all': [];
  'export-spritesheet': [];
}>();

const statusLabels: Record<StudioItem['status'], string> = {
  queued: '等待',
  processing: '生成中',
  ready: '完成',
  error: '失败',
};

function statusLabel(item: StudioItem): string {
  return statusLabels[item.status];
}
</script>

<template>
  <div class="batch-queue">
    <div class="queue-heading">
      <span>队列</span>
      <span class="queue-count">{{ props.items.length }} 张</span>
      <button
        class="clear-button"
        type="button"
        title="清空队列"
        aria-label="清空队列"
        @click="emit('clear')"
      >
        <Trash2 :size="13" :stroke-width="1.9" />
      </button>
    </div>

    <ul class="queue-list">
      <li
        v-for="item in props.items"
        :key="item.id"
        class="queue-item"
        :class="{
          'is-selected': item.id === props.selectedId,
          'is-error': item.status === 'error',
        }"
      >
        <button
          class="queue-select"
          type="button"
          :aria-current="item.id === props.selectedId"
          :title="item.error || item.name"
          @click="emit('select', item.id)"
        >
          <span class="queue-thumb">
            <img :src="item.sourceUrl" alt="" />
          </span>
          <span class="queue-copy">
            <strong>{{ item.name }}</strong>
            <span class="queue-status">
              <LoaderCircle
                v-if="item.status === 'processing'"
                class="spin"
                :size="10"
                :stroke-width="2"
              />
              {{ statusLabel(item) }}
              <span v-if="item.edited" class="edited-tag">已编辑</span>
            </span>
          </span>
        </button>

        <button
          v-if="item.status === 'error'"
          class="queue-action"
          type="button"
          title="重试这张素材"
          aria-label="重试这张素材"
          @click="emit('retry', item.id)"
        >
          <RefreshCw :size="12" :stroke-width="2" />
        </button>

        <button
          class="queue-action"
          type="button"
          title="从队列移除"
          aria-label="从队列移除"
          @click="emit('remove', item.id)"
        >
          <X :size="13" :stroke-width="2" />
        </button>
      </li>
    </ul>

    <div v-if="props.items.length > 1" class="queue-actions">
      <button
        class="queue-export"
        type="button"
        :disabled="props.isProcessing || props.isExporting"
        @click="emit('export-all')"
      >
        <Archive :size="13" :stroke-width="1.9" />
        打包 ZIP
      </button>
      <button
        class="queue-export"
        type="button"
        :disabled="props.isProcessing || props.isExporting"
        @click="emit('export-spritesheet')"
      >
        <ImageIcon :size="13" :stroke-width="1.9" />
        精灵表
      </button>
    </div>
  </div>
</template>

<style scoped>
.batch-queue {
  margin-top: 7px;
  padding: 7px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--violet-25);
}

.queue-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 1px 2px 6px;
  color: var(--color-ink-soft);
  font-size: 10px;
  font-weight: 650;
}

.queue-count {
  color: var(--color-subtle);
  font-size: 9px;
  font-weight: 500;
}

.clear-button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--color-subtle);
  background: transparent;
}

.clear-button:hover {
  color: #b42318;
  background: #fff1f0;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 184px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  scrollbar-width: thin;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--white);
}

.queue-item.is-selected {
  border-color: var(--violet-300);
  background: var(--violet-50);
}

.queue-item.is-error {
  border-color: #f4c7c3;
}

.queue-select {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  padding: 4px 5px;
  border: 0;
  border-radius: 7px;
  color: var(--color-ink);
  background: transparent;
  text-align: left;
}

.queue-thumb {
  flex: none;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  background: var(--violet-50);
}

.queue-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.queue-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.queue-copy strong {
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--color-subtle);
  font-size: 8.5px;
}

.queue-item.is-error .queue-status {
  color: #b42318;
}

.edited-tag {
  padding: 0 3px;
  border-radius: 3px;
  color: var(--violet-700);
  background: var(--violet-50);
  font-size: 7.5px;
  font-weight: 600;
}

.queue-action {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--color-subtle);
  background: transparent;
}

.queue-action:hover {
  color: var(--violet-700);
  background: var(--violet-50);
}

.queue-actions {
  display: flex;
  gap: 5px;
  margin-top: 6px;
}

.queue-export {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  height: 29px;
  padding: 0 7px;
  border: 1px solid var(--violet-100);
  border-radius: 7px;
  color: var(--violet-700);
  background: var(--white);
  font-size: 9.5px;
  font-weight: 600;
}

.queue-export:hover:not(:disabled) {
  border-color: var(--violet-300);
  background: var(--violet-50);
}

.queue-export:disabled {
  opacity: 0.45;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
