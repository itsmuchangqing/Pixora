<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { Keyboard, X } from 'lucide-vue-next';

const emit = defineEmits<{
  close: [];
}>();

const groups = [
  {
    title: '编辑',
    items: [
      { keys: ['Ctrl/Cmd', 'Z'], label: '撤销手绘修改' },
      { keys: ['Ctrl/Cmd', 'Shift', 'Z'], label: '重做' },
      { keys: ['S'], label: '选择单个像素块' },
      { keys: ['B'], label: '画笔' },
      { keys: ['E'], label: '橡皮擦（恢复生成色）' },
      { keys: ['K'], label: '油漆桶' },
      { keys: ['I'], label: '吸管取色' },
      { keys: ['V'], label: '移动画布' },
    ],
  },
  {
    title: '画布',
    items: [
      { keys: ['G'], label: '显示 / 隐藏像素网格' },
      { keys: ['['], label: '缩小画布' },
      { keys: [']'], label: '放大画布' },
      { keys: ['空格', '拖动'], label: '平移画布' },
      { keys: ['Ctrl/Cmd', '滚轮'], label: '缩放画布' },
    ],
  },
  {
    title: '全局',
    items: [
      { keys: ['Ctrl/Cmd', 'S'], label: '导出当前图片' },
      { keys: ['Ctrl/Cmd', '1'], label: '整图像素化' },
      { keys: ['Ctrl/Cmd', '2'], label: '素材工坊' },
      { keys: ['Ctrl/Cmd', 'V'], label: '粘贴剪贴板图片' },
    ],
  },
];

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
    <div
      class="shortcut-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-title"
      >
        <header class="shortcut-header">
          <div class="shortcut-heading">
            <span class="shortcut-icon" aria-hidden="true">
              <Keyboard :size="17" :stroke-width="1.9" />
            </span>
            <div>
              <h2 id="shortcut-title">快捷键</h2>
            </div>
          </div>
          <button
            class="close-button"
            type="button"
            aria-label="关闭快捷键"
            @click="emit('close')"
          >
            <X :size="17" :stroke-width="2" />
          </button>
        </header>

        <div class="shortcut-columns">
          <section
            v-for="group in groups"
            :key="group.title"
            class="shortcut-group"
          >
            <h3>{{ group.title }}</h3>
            <div
              v-for="item in group.items"
              :key="item.label"
              class="shortcut-row"
            >
              <span class="shortcut-label">{{ item.label }}</span>
              <span class="shortcut-keys">
                <template
                  v-for="(key, index) in item.keys"
                  :key="`${item.label}-${key}`"
                >
                  <kbd>{{ key }}</kbd>
                  <span
                    v-if="index < item.keys.length - 1"
                    class="key-plus"
                  >+</span>
                </template>
              </span>
            </div>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.shortcut-backdrop {
  position: fixed;
  z-index: 240;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(21, 14, 32, 0.48);
  backdrop-filter: blur(4px);
}

.shortcut-dialog {
  width: min(100%, 700px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 18px;
  background: var(--white);
  box-shadow: 0 30px 80px -24px rgba(28, 16, 43, 0.52);
}

.shortcut-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid var(--color-line);
}

.shortcut-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shortcut-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--violet-100);
  border-radius: 9px;
  color: var(--violet-600);
  background: var(--violet-50);
}

.shortcut-heading h2 {
  color: var(--color-ink);
  font-size: 16px;
  font-weight: 680;
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

.shortcut-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  padding: 18px;
}

.shortcut-group h3 {
  margin-bottom: 9px;
  color: var(--violet-700);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 27px;
  border-bottom: 1px solid rgba(236, 232, 241, 0.7);
}

.shortcut-row:last-child {
  border-bottom: 0;
}

.shortcut-label {
  color: var(--color-muted);
  font-size: 10.5px;
}

.shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 21px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--color-line);
  border-bottom-color: var(--color-line-strong);
  border-radius: 5px;
  color: var(--color-ink-soft);
  background: var(--violet-25);
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 1px 0 var(--color-line);
}

.key-plus {
  color: var(--color-subtle);
  font-size: 8px;
}

@media (max-width: 720px) {
  .shortcut-columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .shortcut-row {
    min-height: 31px;
  }

  .shortcut-label {
    font-size: 11px;
  }
}
</style>
