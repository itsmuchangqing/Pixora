<script setup lang="ts">
import { ArrowDown } from 'lucide-vue-next';
import BaseButton from '../ui/BaseButton.vue';

/**
 * 首页 Hero 区（View 层）。
 * 只负责品牌表达和页面内滚动；没有任何业务状态。
 */
function scrollToSection(id: string) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}

// 两侧的像素装饰完全由数据驱动，改配色不用动布局。
const leftPattern = [
  '#ede9fe', '#ddd6fe', '#c4b5fd', '#f5f3ff',
  '#c4b5fd', '#8b5cf6', '#7c3aed', '#ddd6fe',
  '#8b5cf6', '#7c3aed', '#fcd34d', '#c4b5fd',
  '#6d28d9', '#5b21b6', '#8b5cf6', '#ede9fe',
] as const;

const rightPattern = [
  '#f5f3ff', '#ddd6fe', '#8b5cf6', '#c4b5fd',
  '#ddd6fe', '#a78bfa', '#6d28d9', '#7c3aed',
  '#a78bfa', '#fcd34d', '#7c3aed', '#5b21b6',
  '#ede9fe', '#c4b5fd', '#6d28d9', '#2e1065',
] as const;
</script>

<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-glow" aria-hidden="true"></div>

    <aside class="pixel-sticker sticker-left" aria-hidden="true">
      <div class="sticker-top">
        <span></span><span></span><span></span>
      </div>
      <div class="sticker-grid">
        <span
          v-for="(color, index) in leftPattern"
          :key="`left-${index}`"
          :style="{ backgroundColor: color }"
        ></span>
      </div>
      <div class="sticker-foot"><span>PX / 01</span><span>48 × 48</span></div>
    </aside>

    <aside class="pixel-sticker sticker-right" aria-hidden="true">
      <div class="sticker-top">
        <span></span><span></span><span></span>
      </div>
      <div class="sticker-grid">
        <span
          v-for="(color, index) in rightPattern"
          :key="`right-${index}`"
          :style="{ backgroundColor: color }"
        ></span>
      </div>
      <div class="sticker-foot"><span>PX / 02</span><span>COLOR</span></div>
    </aside>

    <div class="hero-inner">
      <div class="eyebrow">
        <span class="eyebrow-pixels" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        Pixel Art Studio
        <span class="eyebrow-divider" aria-hidden="true"></span>
        像素工坊
      </div>

      <h1 id="hero-title" class="hero-title">
        生成你的<span class="title-accent">像素素材</span>
      </h1>

      <div class="hero-actions">

        <BaseButton size="lg" @click="scrollToSection('studio')">
          开始创作
          <template #trailing>
            <ArrowDown :size="17" :stroke-width="2.1" />
          </template>
        </BaseButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 76px 24px 58px;
}

.hero-glow {
  position: absolute;
  z-index: -1;
  top: -220px;
  left: 50%;
  width: min(980px, 100vw);
  height: 680px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(139, 92, 246, 0.13) 0%,
    rgba(167, 139, 250, 0.07) 38%,
    transparent 70%
  );
  pointer-events: none;
  transform: translateX(-50%);
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 9px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--color-muted);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: var(--shadow-xs);
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
}

.eyebrow-pixels {
  display: flex;
  gap: 2px;
}

.eyebrow-pixels i {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: var(--violet-500);
}

.eyebrow-pixels i:nth-child(2) {
  background: var(--violet-300);
}

.eyebrow-pixels i:nth-child(3) {
  background: var(--violet-200);
}

.eyebrow-divider {
  width: 1px;
  height: 10px;
  margin: 0 2px;
  background: var(--color-line-strong);
}

.hero-title {
  margin-top: 24px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(42px, 6.1vw, 74px);
  font-weight: 730;
  line-height: 1.14;
  letter-spacing: -0.055em;
}

.title-accent {
  background: linear-gradient(105deg, #6d28d9 0%, #8b5cf6 46%, #a855f7 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 11px;
  margin-top: 30px;
}

.pixel-sticker {
  position: absolute;
  top: 48%;
  width: 122px;
  padding: 9px;
  border: 1px solid rgba(236, 232, 241, 0.95);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    0 22px 48px -26px rgba(62, 32, 101, 0.26),
    0 4px 12px -8px rgba(62, 32, 101, 0.12);
  backdrop-filter: blur(10px);
  animation: drift 7s ease-in-out infinite;
  pointer-events: none;
}

.sticker-left {
  left: max(24px, calc(50% - 575px));
  transform: translateY(-50%) rotate(-7deg);
}

.sticker-right {
  right: max(24px, calc(50% - 565px));
  width: 108px;
  transform: translateY(-38%) rotate(6deg);
  animation-delay: -3.4s;
}

.sticker-top {
  display: flex;
  gap: 3px;
  padding: 1px 1px 7px;
}

.sticker-top span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-line-strong);
}

.sticker-top span:first-child {
  background: var(--violet-300);
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  aspect-ratio: 1;
  padding: 4px;
  border-radius: 7px;
  background: var(--violet-25);
}

.sticker-grid span {
  border-radius: 1.5px;
}

.sticker-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 1px 1px;
  color: var(--color-subtle);
  font-size: 6.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
}

@keyframes drift {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -8px;
  }
}

@media (max-width: 1180px) {
  .pixel-sticker {
    display: none;
  }
}

@media (max-width: 720px) {
  .hero {
    padding: 54px 20px 46px;
  }

  .hero-title {
    margin-top: 20px;
    font-size: clamp(37px, 10.5vw, 54px);
    letter-spacing: -0.045em;
  }

  .hero-actions {
    margin-top: 26px;
  }
}

@media (max-width: 430px) {
  .eyebrow {
    font-size: 8.5px;
    letter-spacing: 0.1em;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-actions :deep(.base-button) {
    flex: 1;
    min-width: 140px;
  }
}
</style>
