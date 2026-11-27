<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  FolderKanban,
  Gamepad2,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Share2,
} from 'lucide-vue-next';
import { useStudioController } from '../../controllers/useStudioController';
import type { NormalizedCropRect } from '../../services/image-edit.service';
import AppToast from '../ui/AppToast.vue';
import ControlPanel from './ControlPanel.vue';
import CropDialog from './CropDialog.vue';
import DestructiveDialog from './DestructiveDialog.vue';
import ImageStage from './ImageStage.vue';
import MultiSizeDialog from './MultiSizeDialog.vue';
import ProjectDialog from './ProjectDialog.vue';

/**
 * 像素工作台（View 层）。
 * 只把 Controller 的状态绑定到子组件，并把用户动作原样转发。
 */
const {
  settings,
  image,
  processedSize,
  isProcessing,
  uploadError,
  isLoading,
  acceptedTypes,
  apiStatus,
  apiStatusLabel,
  toastMessage,
  studioMode,
  assetCategory,
  isAssetMode,
  assetCategoryLabel,
  setStudioMode,
  handleFilesSelected,
  handleReset,
  handleExport,
  refreshApiStatus,
  dismissToast,
  backgroundMode,
  exportScale,
  items,
  selectedId,
  hasSelection,
  hasGrid,
  processingLabel,
  isExporting,
  selectedItemEdited,
  selectedPixelInfo,
  guardDialog,
  confirmGuard,
  cancelGuard,
  grid,
  gridVersion,
  paletteColors,
  lockedColors,
  editorTool,
  brushColor,
  brushSize,
  showPixelGrid,
  canUndo,
  canRedo,
  isTransformingSource,
  selectedSourceEdited,
  handleSelectItem,
  handleRemoveItem,
  handleClearQueue,
  handleRetryItem,
  handleEditorStart,
  handleEditorMove,
  handleEditorEnd,
  handleUndo,
  handleRedo,
  handlePaletteColorChange,
  handlePaletteLock,
  handleImportPalette,
  handleTogglePixelGrid,
  handlePreviewSelectedPixelColor,
  handleChangeSelectedPixelColor,
  handleClearSelectedPixel,
  setEditorTool,
  setBrushColor,
  setBrushSize,
  handleRotate,
  handleFlip,
  handleCrop,
  handleRestoreOriginal,
  handlePasteButton,
  handleExportAllZip,
  handleExportSpriteSheet,
  handleMultiSizeExport,
  handleShareSettings,
  savedProjects,
  isProjectLoading,
  refreshProjects,
  handleSaveProject,
  handleOpenProject,
  handleDeleteProject,
} = useStudioController();

const showCropDialog = ref(false);
const showMultiSizeDialog = ref(false);
const showProjectDialog = ref(false);
const controlPanelTab = ref<'params' | 'palette'>('params');
const pixelColorMode = computed(
  () => editorTool.value === 'select' && Boolean(selectedPixelInfo.value),
);
const brushColorEnabled = computed(
  () => editorTool.value === 'brush' || editorTool.value === 'bucket',
);
const projectDefaultName = computed(() => {
  const now = new Date();
  const date = `${now.getMonth() + 1}-${now.getDate()}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
  return isAssetMode.value
    ? `${assetCategoryLabel.value}素材 ${date} ${time}`
    : `像素作品 ${date} ${time}`;
});

async function openProjectDialog() {
  showProjectDialog.value = true;
  await refreshProjects();
}

async function openSavedProject(id: string) {
  const opened = await handleOpenProject(id);
  if (opened) showProjectDialog.value = false;
}

function openCropDialog() {
  if (hasSelection.value && !isProcessing.value) {
    showCropDialog.value = true;
  }
}

function applyCrop(rect: NormalizedCropRect) {
  showCropDialog.value = false;
  handleCrop(rect);
}

function applyMultiSize(sizes: Parameters<typeof handleMultiSizeExport>[0]) {
  showMultiSizeDialog.value = false;
  void handleMultiSizeExport(sizes);
}
</script>

<template>
  <section id="studio" class="studio-section" aria-labelledby="studio-title">
    <div class="studio-modebar">
      <div class="mode-switch" role="group" aria-label="创作模式">
        <button
          class="mode-tab"
          :class="{ 'is-active': studioMode === 'image' }"
          type="button"
          :aria-pressed="studioMode === 'image'"
          @click="setStudioMode('image')"
        >
          <span class="mode-tab-icon" aria-hidden="true">
            <ImageIcon :size="15" :stroke-width="1.9" />
          </span>
          <span class="mode-tab-copy">
            <strong>整图像素化</strong>
          </span>
        </button>

        <button
          class="mode-tab"
          :class="{ 'is-active': studioMode === 'asset' }"
          type="button"
          :aria-pressed="studioMode === 'asset'"
          @click="setStudioMode('asset')"
        >
          <span class="mode-tab-icon" aria-hidden="true">
            <Gamepad2 :size="15" :stroke-width="1.9" />
          </span>
          <span class="mode-tab-copy">
            <strong>素材工坊</strong>
          </span>
          <span class="mode-new" aria-hidden="true">NEW</span>
        </button>
      </div>
    </div>

    <Transition name="asset-guide">
      <div v-if="isAssetMode" class="asset-guidance">
        <span class="asset-guidance-icon" aria-hidden="true">
          <Info :size="14" :stroke-width="1.9" />
        </span>
        <p>
          <strong>素材建议：</strong>
          上传纯色背景素材，支持多选；背景会自动清理，导出可选白底或透明底。
        </p>
      </div>
    </Transition>

    <div class="studio-shell">
      <header class="studio-topbar">
        <div class="project-block">
          <span class="project-icon" aria-hidden="true">
            <LayoutGrid :size="16" :stroke-width="1.9" />
          </span>
          <div class="project-copy">
            <div class="project-title-row">
              <h2 id="studio-title">
                {{ isAssetMode ? '素材工作台' : '像素工作台' }}
              </h2>
              <span class="engine-badge">
                {{ items.length > 1 ? `队列 ${items.length}` : '本地生成' }}
              </span>
            </div>
            <span class="project-subline">
              <template v-if="isAssetMode">
                {{ assetCategoryLabel }}素材
                <span aria-hidden="true">·</span>
                {{
                  hasSelection
                    ? `${image.width} × ${image.height} px`
                    : '等待上传'
                }}
              </template>
              <template v-else>
                {{ image.width }} × {{ image.height }} px
                <span aria-hidden="true">·</span>
                {{ image.isDemo ? '示例图片' : `${items.length} 张图片` }}
              </template>
            </span>
          </div>
        </div>

        <div class="topbar-actions">
          <button
            class="project-button"
            type="button"
            title="打开本地项目"
            aria-label="打开本地项目"
            @click="openProjectDialog"
          >
            <FolderKanban :size="13" :stroke-width="1.9" />
            项目
          </button>
          <button
            class="share-button"
            type="button"
            title="复制当前参数链接（不包含图片）"
            aria-label="复制当前参数链接"
            @click="handleShareSettings"
          >
            <Share2 :size="13" :stroke-width="1.9" />
            分享参数
          </button>
          <button
            class="api-status"
            :class="`is-${apiStatus}`"
            type="button"
            title="点击重新检测后端服务"
            @click="refreshApiStatus"
          >
            <span class="status-dot" aria-hidden="true"></span>
            {{ apiStatusLabel }}
          </button>
        </div>
      </header>

      <div class="studio-workspace">
        <ImageStage
          :image="image"
          :mode="studioMode"
          :asset-category-label="assetCategoryLabel"
          :grid="grid"
          :grid-version="gridVersion"
          :is-processing="isProcessing"
          :processing-label="processingLabel"
          :output-size="processedSize"
          :has-selection="hasSelection"
          :background-mode="backgroundMode"
          :editor-tool="editorTool"
          :brush-color="brushColor"
          :brush-size="brushSize"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :show-pixel-grid="showPixelGrid"
          :is-transforming-source="isTransformingSource"
          :selected-source-edited="selectedSourceEdited"
          :has-manual-edits="selectedItemEdited"
          :selected-pixel="selectedPixelInfo"
          @files-selected="handleFilesSelected"
          @crop="openCropDialog"
          @rotate="handleRotate"
          @flip="handleFlip"
          @paste="handlePasteButton"
          @restore="handleRestoreOriginal"
          @editor-start="handleEditorStart"
          @editor-move="handleEditorMove"
          @editor-end="handleEditorEnd"
          @undo="handleUndo"
          @redo="handleRedo"
          @set-tool="setEditorTool"
          @set-brush-color="setBrushColor"
          @set-brush-size="setBrushSize"
          @toggle-grid="handleTogglePixelGrid"
          @open-palette="controlPanelTab = 'palette'"
          @preview-pixel-color="handlePreviewSelectedPixelColor"
          @change-pixel-color="handleChangeSelectedPixelColor"
        />

        <ControlPanel
          :image="image"
          :accepted-types="acceptedTypes"
          :upload-error="uploadError"
          :is-loading="isLoading"
          :mode="studioMode"
          :is-processing="isProcessing"
          :is-exporting="isExporting"
          :is-transforming-source="isTransformingSource"
          :output-size="processedSize"
          :items="items"
          :selected-id="selectedId"
          :has-grid="hasGrid"
          :palette-colors="paletteColors"
          :locked-colors="lockedColors"
          :brush-color="brushColor"
          :selected-pixel-info="selectedPixelInfo"
          :pixel-color-mode="pixelColorMode"
          :brush-color-enabled="brushColorEnabled"
          v-model:pixel-size="settings.pixelSize"
          v-model:preset="settings.preset"
          v-model:format="settings.format"
          v-model:asset-category="assetCategory"
          v-model:color-count="settings.colorCount"
          v-model:dither="settings.dither"
          v-model:outline-mode="settings.outlineMode"
          v-model:macro-detail="settings.macroDetail"
          v-model:sizing-mode="settings.sizingMode"
          v-model:target-resolution="settings.targetResolution"
          v-model:background-mode="backgroundMode"
          v-model:export-scale="exportScale"
          v-model:active-tab="controlPanelTab"
          @files-selected="handleFilesSelected"
          @reset="handleReset"
          @export="handleExport"
          @open-multi-size="showMultiSizeDialog = true"
          @select-item="handleSelectItem"
          @remove-item="handleRemoveItem"
          @retry-item="handleRetryItem"
          @clear-queue="handleClearQueue"
          @export-all="handleExportAllZip"
          @export-spritesheet="handleExportSpriteSheet"
          @palette-select-color="setBrushColor"
          @palette-color-change="handlePaletteColorChange"
          @palette-toggle-lock="handlePaletteLock"
          @import-palette="handleImportPalette"
          @change-pixel-color="handleChangeSelectedPixelColor"
          @clear-pixel-selection="handleClearSelectedPixel"
        />
      </div>
    </div>

    <CropDialog
      v-if="showCropDialog"
      :src="image.src"
      :name="image.name"
      @close="showCropDialog = false"
      @apply="applyCrop"
    />

    <MultiSizeDialog
      v-if="showMultiSizeDialog"
      :format="settings.format"
      :disabled="isExporting"
      @close="showMultiSizeDialog = false"
      @apply="applyMultiSize"
    />

    <ProjectDialog
      v-if="showProjectDialog"
      :projects="savedProjects"
      :is-loading="isProjectLoading"
      :can-save="items.length > 0"
      :default-name="projectDefaultName"
      @close="showProjectDialog = false"
      @save="handleSaveProject"
      @open="openSavedProject"
      @delete="handleDeleteProject"
    />

    <DestructiveDialog
      v-if="guardDialog"
      :title="guardDialog.title"
      :message="guardDialog.message"
      :confirm-label="guardDialog.confirmLabel"
      :cancel-label="guardDialog.cancelLabel"
      @confirm="confirmGuard"
      @cancel="cancelGuard"
    />

    <AppToast :message="toastMessage" @dismiss="dismissToast" />
  </section>
</template>

<style scoped>
.studio-section {
  position: relative;
  padding: 10px 24px 96px;
}

.studio-modebar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  width: min(100%, 1180px);
  margin: 0 auto 12px;
  padding: 0 2px;
}

.mode-switch {
  display: flex;
  align-items: stretch;
  gap: 4px;
  flex: none;
  padding: 4px;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--shadow-xs);
  backdrop-filter: blur(10px);
}

.mode-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 138px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--color-muted);
  background: transparent;
  text-align: left;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.mode-tab:hover {
  color: var(--violet-700);
  background: var(--violet-25);
}

.mode-tab.is-active {
  color: var(--violet-800);
  border-color: var(--violet-200);
  background: var(--violet-50);
  box-shadow: 0 4px 12px -10px rgba(76, 29, 149, 0.4);
}

.mode-tab-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--violet-100);
  border-radius: 9px;
  color: var(--violet-600);
  background: var(--white);
}

.mode-tab-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mode-tab-copy strong {
  overflow: hidden;
  color: var(--color-ink-soft);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-tab.is-active .mode-tab-copy strong {
  color: var(--violet-800);
}

.mode-new {
  margin-left: auto;
  padding: 2px 5px;
  border-radius: 4px;
  color: var(--violet-700);
  background: var(--violet-100);
  font-size: 7px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.asset-guidance {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(100%, 1180px);
  margin: 0 auto 10px;
  padding: 9px 12px;
  border: 1px solid var(--violet-100);
  border-radius: 10px;
  color: var(--color-muted);
  background: var(--violet-25);
  font-size: 10.5px;
  line-height: 1.6;
}

.asset-guidance-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--violet-600);
  background: var(--white);
}

.asset-guidance p {
  margin: 0;
}

.asset-guidance strong {
  color: var(--violet-800);
  font-weight: 650;
}

.asset-guide-enter-active,
.asset-guide-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.asset-guide-enter-from,
.asset-guide-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.studio-shell {
  width: min(100%, 1180px);
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--white);
  box-shadow:
    0 36px 90px -50px rgba(68, 34, 120, 0.33),
    0 10px 30px -26px rgba(68, 34, 120, 0.16);
}

.studio-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 70px;
  padding: 0 22px;
  border-bottom: 1px solid var(--color-line);
  background: rgba(255, 255, 255, 0.92);
}

.project-block {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.project-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--violet-100);
  border-radius: 10px;
  color: var(--violet-600);
  background: var(--violet-50);
}

.project-copy {
  min-width: 0;
}

.project-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.project-title-row h2 {
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 660;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.engine-badge {
  padding: 2px 6px;
  border: 1px solid var(--color-line);
  border-radius: 4px;
  color: var(--color-subtle);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 0.06em;
}

.project-subline {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  color: var(--color-subtle);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.share-button,
.project-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--color-muted);
  background: var(--white);
  font-size: 9.5px;
  font-weight: 560;
  transition:
    color 150ms ease,
    border-color 150ms ease,
    background 150ms ease;
}

.share-button:hover,
.project-button:hover {
  color: var(--violet-700);
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--color-muted);
  background: var(--white);
  font-size: 9.5px;
  font-weight: 560;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.api-status:hover {
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-subtle);
}

.api-status.is-online .status-dot {
  background: var(--green-500);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.12);
}

.api-status.is-offline .status-dot {
  background: var(--amber-500);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.12);
}

.api-status.is-checking .status-dot {
  background: var(--violet-400);
  animation: status-pulse 1.4s ease-in-out infinite;
}

@keyframes status-pulse {
  50% {
    opacity: 0.35;
  }
}

.studio-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  align-items: stretch;
}

@media (max-width: 720px) {
  .studio-modebar {
    align-items: stretch;
  }

  .mode-switch {
    width: 100%;
  }

  .mode-tab {
    flex: 1;
    min-width: 0;
  }

  .mode-new {
    display: none;
  }
}

@media (max-width: 1040px) {
  .studio-workspace {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}

@media (max-width: 980px) {
  .studio-section {
    padding: 4px 20px 80px;
  }

  .studio-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .studio-section {
    padding: 0 12px 62px;
  }

  .studio-shell {
    border-radius: var(--radius-lg);
  }

  .studio-topbar {
    height: 62px;
    padding: 0 14px;
  }

  .project-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .engine-badge {
    display: none;
  }

  .share-button,
  .project-button {
    padding: 4px 7px;
    font-size: 0;
  }

  .share-button :deep(svg),
  .project-button :deep(svg) {
    display: block;
  }

  .api-status {
    padding: 4px 7px;
    font-size: 8px;
  }
}
</style>
