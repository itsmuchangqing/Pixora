<script setup lang="ts">
import { markRaw, type Component } from 'vue';
import {
  ArrowUpRight,
  Download,
  SlidersHorizontal,
  Upload,
} from 'lucide-vue-next';

interface Step {
  icon: Component;
  title: string;
}

/**
 * 使用步骤展示（View 层）。
 * 步骤数据只影响展示，属于组件本身的静态内容，不必放进全局 Controller。
 */
const steps: Step[] = [
  {
    icon: markRaw(Upload),
    title: '上传图片或素材',
  },
  {
    icon: markRaw(SlidersHorizontal),
    title: '切换模式与风格',
  },
  {
    icon: markRaw(Download),
    title: '导出作品或素材',
  },
];
</script>

<template>
  <section id="how-it-works" class="how-it-works" aria-labelledby="how-title">
    <div class="section-inner">
      <header class="section-heading">
        <div class="section-kicker">
          <span></span>
          How it works
          <span></span>
        </div>
        <h2 id="how-title">三步，把照片和素材变成作品。</h2>
      </header>

      <div class="steps">
        <article
          v-for="(step, index) in steps"
          :key="step.title"
          class="step-card"
        >
          <div class="step-top">
            <span class="step-number">0{{ index + 1 }}</span>
            <span class="step-icon" aria-hidden="true">
              <component :is="step.icon" :size="18" :stroke-width="1.9" />
            </span>
          </div>
          <h3>{{ step.title }}</h3>
        </article>
      </div>

      <div class="steps-foot">

        <a href="#studio">
          回到工作台
          <ArrowUpRight :size="14" :stroke-width="2.2" />
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.how-it-works {
  position: relative;
  padding: 100px 24px 110px;
  background:
    radial-gradient(ellipse 60% 55% at 50% 100%, rgba(139, 92, 246, 0.06), transparent 70%),
    var(--violet-25);
  border-top: 1px solid rgba(236, 232, 241, 0.8);
}

.section-inner {
  width: min(100%, 1120px);
  margin: 0 auto;
}

.section-heading {
  text-align: center;
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--violet-600);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.section-kicker span {
  width: 18px;
  height: 1px;
  background: var(--violet-300);
}

.section-heading h2 {
  margin-top: 14px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(29px, 3.7vw, 40px);
  font-weight: 710;
  line-height: 1.3;
  letter-spacing: -0.045em;
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 42px;
}

.step-card {
  padding: 23px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: var(--shadow-xs);
  transition:
    transform 220ms var(--ease-out),
    border-color 220ms ease,
    box-shadow 220ms var(--ease-out);
}

.step-card:hover {
  border-color: var(--violet-200);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-number {
  color: var(--color-subtle);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.step-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--violet-100);
  border-radius: 11px;
  color: var(--violet-600);
  background: var(--violet-50);
}

.step-card h3 {
  margin-top: 22px;
  color: var(--color-ink);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.steps-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 34px;
  font-size: 12px;
}

.steps-foot a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--violet-700);
  font-weight: 650;
  transition: gap 160ms ease;
}

.steps-foot a:hover {
  gap: 7px;
}

@media (max-width: 760px) {
  .how-it-works {
    padding: 76px 20px 84px;
  }

  .steps {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 30px;
  }

  .step-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
  }

  .step-top {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
  }

  .step-number {
    order: 2;
  }

  .step-card h3 {
    margin-top: 0;
  }
}
</style>
