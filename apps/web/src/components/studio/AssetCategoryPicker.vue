<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  type Component,
} from 'vue';
import {
  Castle,
  Check,
  ChevronDown,
  Gem,
  Map,
  Mountain,
  PersonStanding,
  Shapes,
  Shield,
  Skull,
  Soup,
  Sword,
  TreePine,
  WandSparkles,
} from 'lucide-vue-next';
import { ASSET_CATEGORY_OPTIONS } from '../../models/pixel-options';
import type { AssetCategoryId } from '../../models/pixel';

/**
 * 素材类型选择器（View 层子组件）。
 * ------------------------------------------------------------
 * 收起时只显示当前类型，点击大的下拉按钮后展开全部素材分类。
 * 选择选项后自动收起；分类只影响素材标注与导出命名，
 * 像素画本身由浏览器本地引擎生成。
 *
 * 图标属于展示内容，用 markRaw 标记后不需要变成响应式对象。
 */
const categoryIcons: Record<AssetCategoryId, Component> = {
  tree: markRaw(TreePine),
  rock: markRaw(Mountain),
  character: markRaw(PersonStanding),
  weapon: markRaw(Sword),
  armor: markRaw(Shield),
  monster: markRaw(Skull),
  item: markRaw(Gem),
  building: markRaw(Castle),
  terrain: markRaw(Map),
  decoration: markRaw(WandSparkles),
  food: markRaw(Soup),
  custom: markRaw(Shapes),
};

const model = defineModel<AssetCategoryId>({ required: true });

/** 控制下拉面板是否展开，仅属于当前 View 的局部界面状态 */
const isOpen = ref(false);
const pickerRoot = ref<HTMLElement | null>(null);

/** 点击组件外部时收起下拉，避免面板一直停留在页面上 */
function handlePointerDown(event: PointerEvent) {
  if (!isOpen.value) return;

  const target = event.target as Node;
  if (pickerRoot.value && !pickerRoot.value.contains(target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown);
});

/** 当前选中的分类，用于收起状态下的摘要按钮 */
const selectedOption = computed(
  () =>
    ASSET_CATEGORY_OPTIONS.find((option) => option.id === model.value) ??
    ASSET_CATEGORY_OPTIONS[0]!,
);

/** 选择分类后写入 v-model，并收起下拉面板 */
function chooseCategory(category: AssetCategoryId) {
  model.value = category;
  isOpen.value = false;
}
</script>

<template>
  <div
    ref="pickerRoot"
    class="asset-picker"
    @keydown.esc="isOpen = false"
  >

    <button
      class="asset-trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="asset-category-options"
      @click="isOpen = !isOpen"
    >
      <span class="asset-trigger-icon" aria-hidden="true">
        <component
          :is="categoryIcons[selectedOption.id]"
          :size="17"
          :stroke-width="1.9"
        />
      </span>

      <span class="asset-trigger-copy">
        <strong>{{ selectedOption.label }}</strong>
      </span>

      <span class="asset-trigger-count">
        {{ ASSET_CATEGORY_OPTIONS.length }} 类
      </span>

      <ChevronDown
        class="asset-trigger-chevron"
        :class="{ 'is-open': isOpen }"
        :size="15"
        :stroke-width="1.9"
        aria-hidden="true"
      />
    </button>

    <Transition name="asset-panel">
      <div
        v-show="isOpen"
        id="asset-category-options"
        class="asset-panel"
        role="group"
        aria-label="全部素材类型"
      >
        <div class="asset-panel-head">
          <span>全部素材类型</span>
        </div>

        <div class="asset-grid">
          <button
            v-for="option in ASSET_CATEGORY_OPTIONS"
            :key="option.id"
            class="asset-option"
            :class="{ 'is-active': model === option.id }"
            type="button"
            :aria-pressed="model === option.id"
            @click="chooseCategory(option.id)"
          >
            <span class="asset-icon" aria-hidden="true">
              <component
                :is="categoryIcons[option.id]"
                :size="15"
                :stroke-width="1.9"
              />
            </span>

            <span class="asset-copy">
              <strong>{{ option.label }}</strong>
            </span>

            <span
              v-if="model === option.id"
              class="asset-check"
              aria-hidden="true"
            >
              <Check :size="8" :stroke-width="3.2" />
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.asset-picker {
  position: relative;
}

.asset-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--color-line);
  border-radius: 11px;
  color: var(--color-ink);
  background: var(--violet-25);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease;
}

.asset-trigger:hover {
  border-color: var(--violet-200);
  background: var(--violet-50);
}

.asset-trigger[aria-expanded='true'] {
  border-color: var(--violet-300);
  background: var(--violet-50);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.05);
}

.asset-trigger-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--violet-100);
  border-radius: 9px;
  color: var(--violet-600);
  background: var(--white);
}

.asset-trigger-copy {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.asset-trigger-copy strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-trigger-count {
  flex: none;
  padding: 2px 6px;
  border: 1px solid var(--violet-100);
  border-radius: var(--radius-full);
  color: var(--violet-700);
  background: var(--white);
  font-size: 8.5px;
  font-weight: 650;
  white-space: nowrap;
}

.asset-trigger-chevron {
  flex: none;
  color: var(--color-subtle);
  transition: transform 160ms ease;
}

.asset-trigger-chevron.is-open {
  transform: rotate(180deg);
}

.asset-panel {
  margin-top: 7px;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--white);
  box-shadow: var(--shadow-sm);
  max-height: 440px;
  scrollbar-color: var(--violet-200) transparent;
  scrollbar-width: thin;
}

.asset-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 2px 7px;
  color: var(--color-subtle);
  font-size: 8.5px;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.asset-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 42px;
  padding: 7px;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  color: var(--color-ink);
  background: var(--white);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.asset-option:hover {
  border-color: var(--violet-200);
  background: var(--violet-25);
}

.asset-option.is-active {
  border-color: var(--violet-300);
  background: var(--violet-25);
}

.asset-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--violet-100);
  border-radius: 7px;
  color: var(--violet-600);
  background: var(--white);
}

.asset-copy {
  display: flex;
  align-items: center;
  min-width: 0;
}

.asset-copy strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 620;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-check {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  color: var(--white);
  background: var(--violet-600);
}

.asset-panel::-webkit-scrollbar {
  width: 5px;
}

.asset-panel::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: var(--violet-200);
}

.asset-panel-enter-active,
.asset-panel-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.asset-panel-enter-from,
.asset-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
