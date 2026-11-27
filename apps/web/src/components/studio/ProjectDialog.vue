<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import {
  FolderOpen,
  Image as ImageIcon,
  LoaderCircle,
  Save,
  Trash2,
  X,
} from 'lucide-vue-next';
import type { ProjectMeta } from '../../models/project';

const props = defineProps<{
  projects: ProjectMeta[];
  isLoading: boolean;
  canSave: boolean;
  defaultName: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [name: string];
  open: [id: string];
  delete: [id: string];
}>();

const projectName = ref(props.defaultName);
const thumbnailUrls = ref<Record<string, string>>({});

const canSubmit = computed(
  () => props.canSave && projectName.value.trim().length > 0,
);

watch(
  () => props.defaultName,
  (name) => {
    if (!projectName.value.trim()) projectName.value = name;
  },
);

watch(
  () => props.projects,
  (projects) => {
    for (const url of Object.values(thumbnailUrls.value)) {
      URL.revokeObjectURL(url);
    }
    const next: Record<string, string> = {};
    for (const project of projects) {
      if (project.thumbnail) {
        next[project.id] = URL.createObjectURL(project.thumbnail);
      }
    }
    thumbnailUrls.value = next;
  },
  { immediate: true },
);

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function submitSave() {
  if (!canSubmit.value) return;
  emit('save', projectName.value.trim());
}

function requestDelete(project: ProjectMeta) {
  if (
    window.confirm(
      `删除项目「${project.name}」？这个操作无法撤销。`,
    )
  ) {
    emit('delete', project.id);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  for (const url of Object.values(thumbnailUrls.value)) {
    URL.revokeObjectURL(url);
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="project-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-title"
      >
        <header class="project-header">
          <div>
            <h2 id="project-title">本地项目</h2>
            <span class="project-subline">保存在浏览器 IndexedDB，不会上传服务器</span>
          </div>
          <button
            class="close-button"
            type="button"
            aria-label="关闭项目面板"
            @click="emit('close')"
          >
            <X :size="17" :stroke-width="2" />
          </button>
        </header>

        <div class="save-row">
          <input
            v-model="projectName"
            type="text"
            maxlength="40"
            aria-label="项目名称"
            placeholder="项目名称"
            @keydown.enter.prevent="submitSave"
          />
          <button
            class="save-button"
            type="button"
            :disabled="!canSubmit || props.isLoading"
            @click="submitSave"
          >
            <LoaderCircle
              v-if="props.isLoading"
              class="spin"
              :size="14"
              :stroke-width="2"
            />
            <Save v-else :size="14" :stroke-width="2" />
            保存当前项目
          </button>
        </div>

        <div class="project-list" aria-live="polite">
          <p v-if="props.projects.length === 0" class="empty-projects">
            还没有保存的项目。先保存当前队列，下次打开页面会自动恢复最近会话。
          </p>

          <article
            v-for="project in props.projects"
            :key="project.id"
            class="project-card"
          >
            <span class="project-thumb">
              <img
                v-if="thumbnailUrls[project.id]"
                :src="thumbnailUrls[project.id]"
                alt=""
              />
              <ImageIcon v-else :size="18" :stroke-width="1.7" />
            </span>

            <div class="project-info">
              <strong>{{ project.name }}</strong>
              <span>
                {{ project.itemCount }} 张 · {{ formatDate(project.updatedAt) }}
              </span>
            </div>

            <button
              class="open-button"
              type="button"
              :disabled="props.isLoading"
              @click="emit('open', project.id)"
            >
              <FolderOpen :size="13" :stroke-width="2" />
              打开
            </button>
            <button
              class="delete-button"
              type="button"
              aria-label="删除项目"
              title="删除项目"
              @click="requestDelete(project)"
            >
              <Trash2 :size="13" :stroke-width="1.9" />
            </button>
          </article>
        </div>

        <footer class="project-footer">
          打开项目会替换当前队列；未保存的作品请先保存为项目。
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.project-backdrop {
  position: fixed;
  z-index: 220;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(21, 14, 32, 0.5);
  backdrop-filter: blur(4px);
}

.project-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 660px);
  max-height: calc(100vh - 40px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: var(--white);
  box-shadow: 0 30px 80px -24px rgba(28, 16, 43, 0.55);
}

.project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid var(--color-line);
}

.project-header h2 {
  color: var(--color-ink);
  font-size: 16px;
  font-weight: 680;
}

.project-subline {
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

.save-row {
  display: flex;
  gap: 7px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-line);
  background: var(--violet-25);
}

.save-row input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  color: var(--color-ink);
  background: var(--white);
  font: inherit;
  font-size: 12px;
}

.save-row input:focus {
  border-color: var(--violet-400);
  outline: 2px solid rgba(139, 92, 246, 0.14);
  outline-offset: 0;
}

.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: none;
  height: 34px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--white);
  background: var(--gradient-violet);
  font-size: 11px;
  font-weight: 620;
  box-shadow: var(--shadow-violet);
}

.save-button:disabled {
  opacity: 0.45;
}

.project-list {
  flex: 1;
  min-height: 120px;
  padding: 10px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.empty-projects {
  padding: 28px 12px;
  color: var(--color-subtle);
  font-size: 11px;
  line-height: 1.7;
  text-align: center;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border-bottom: 1px solid var(--color-line);
}

.project-card:last-child {
  border-bottom: 0;
}

.project-thumb {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  color: var(--violet-400);
  background:
    linear-gradient(45deg, #f1edf7 25%, transparent 25%) 0 0 / 8px 8px,
    linear-gradient(45deg, transparent 75%, #f1edf7 75%) 0 0 / 8px 8px,
    var(--white);
}

.project-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.project-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.project-info strong {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 11.5px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-info span {
  margin-top: 2px;
  color: var(--color-subtle);
  font-size: 9px;
}

.open-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--violet-100);
  border-radius: 7px;
  color: var(--violet-700);
  background: var(--violet-25);
  font-size: 10px;
  font-weight: 600;
}

.open-button:hover:not(:disabled) {
  border-color: var(--violet-300);
  background: var(--violet-50);
}

.delete-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--color-subtle);
  background: transparent;
}

.delete-button:hover {
  color: #b42318;
  background: #fff1f0;
}

.project-footer {
  padding: 10px 18px 13px;
  border-top: 1px solid var(--color-line);
  color: var(--color-subtle);
  font-size: 9.5px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 560px) {
  .save-row {
    flex-direction: column;
  }

  .project-thumb {
    width: 36px;
    height: 36px;
  }

  .project-footer {
    font-size: 9px;
  }
}
</style>
