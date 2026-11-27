<script setup lang="ts">
import BrandLogo from '../ui/BrandLogo.vue';

/**
 * 顶部导航。
 * 只负责锚点跳转；主行动按钮统一放在 Hero 区，避免重复入口。
 */
</script>

<template>
  <header id="top" class="site-header">

    <div class="header-inner">

      <BrandLogo />

      <nav class="main-nav" aria-label="主导航">
        <a class="nav-link is-current" href="#studio">工作台</a>
        <a class="nav-link" href="#how-it-works">使用步骤</a>
        <a class="nav-link" href="#about">关于</a>
      </nav>

      <div class="header-actions">

        <span class="beta-badge">BETA</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(236, 232, 241, 0.8);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
}

.header-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(100%, var(--container-width));
  height: var(--header-height);
  margin: 0 auto;
  padding: 0 32px;
}

.main-nav {
  position: absolute;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 30px;
  transform: translateX(-50%);
}

.nav-link {
  position: relative;
  padding: 8px 0;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 550;
  transition: color 160ms ease;
}

.nav-link:hover {
  color: var(--color-ink);
}

.nav-link.is-current {
  color: var(--color-ink);
  font-weight: 650;
}

.nav-link.is-current::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: var(--violet-500);
  content: '';
  transform: translateX(-50%);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.beta-badge {
  padding: 4px 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  color: var(--violet-700);
  background: var(--violet-25);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

@media (max-width: 960px) {
  .main-nav {
    gap: 20px;
  }
}

@media (max-width: 780px) {
  .header-inner {
    height: 68px;
    padding: 0 20px;
  }

  .main-nav,
  .beta-badge {
    display: none;
  }
}

@media (max-width: 420px) {
  .site-header {
    backdrop-filter: blur(14px);
  }
}
</style>
