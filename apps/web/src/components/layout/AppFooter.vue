<script setup lang="ts">
import { ArrowUp } from 'lucide-vue-next';
import BrandLogo from '../ui/BrandLogo.vue';

/**
 * 页脚（View 层）。
 * 包含品牌信息、页内导航和项目技术栈说明。
 */
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer id="about" class="site-footer">

    <div class="footer-inner">

      <div class="footer-brand">
        <BrandLogo />
        <p>把日常照片，做成值得收藏的像素作品。</p>
      </div>

      <div class="footer-columns">

        <div class="footer-column">
          <span class="column-title">网站</span>

          <a href="#studio">工作台</a>

          <a href="#how-it-works">使用步骤</a>
        </div>

        <div class="footer-column">
          <span class="column-title">技术栈</span>
          <span>Vue 3 + Vite</span>
          <span>Express + TypeScript</span>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© {{ currentYear }} Pixora Studio · 浏览器像素画引擎 v1.0</span>

      <a href="#top">
        回到顶部
        <ArrowUp :size="13" :stroke-width="2.2" />
      </a>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  padding: 54px 24px 26px;
  border-top: 1px solid var(--color-line);
  background: var(--white);
}

.footer-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 48px;
  width: min(100%, var(--container-width));
  margin: 0 auto;
}

.footer-brand p {
  max-width: 310px;
  margin-top: 14px;
  color: var(--color-muted);
  font-size: 12.5px;
}

.footer-columns {
  display: flex;
  gap: 72px;
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: var(--color-muted);
  font-size: 12px;
}

.column-title {
  margin-bottom: 3px;
  color: var(--color-ink);
  font-size: 11px;
  font-weight: 650;
}

.footer-column a {
  transition: color 160ms ease;
}

.footer-column a:hover {
  color: var(--violet-700);
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: min(100%, var(--container-width));
  margin: 42px auto 0;
  padding-top: 20px;
  border-top: 1px solid var(--color-line);
  color: var(--color-subtle);
  font-size: 10.5px;
}

.footer-bottom a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: color 160ms ease;
}

.footer-bottom a:hover {
  color: var(--violet-700);
}

@media (max-width: 720px) {

  .site-footer {
    padding: 42px 20px 22px;
  }

  .footer-inner {
    flex-direction: column;
    gap: 34px;
  }

  .footer-columns {
    gap: 54px;
  }

  .footer-bottom {
    margin-top: 32px;
  }
}
</style>
