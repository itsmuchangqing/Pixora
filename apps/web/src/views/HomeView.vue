<script setup lang="ts">
import AppFooter from '../components/layout/AppFooter.vue';
import AppHeader from '../components/layout/AppHeader.vue';
import HeroSection from '../components/home/HeroSection.vue';
import HowItWorks from '../components/home/HowItWorks.vue';
import PixelStudio from '../components/studio/PixelStudio.vue';

/**
 * MVC 中的 View 层（页面视图）
 * ------------------------------------------------------------
 * 这个文件只组织页面的区块顺序：
 * 页头 → Hero → 工作台 → 使用步骤 → 页尾。
 * 业务状态和交互逻辑在 controllers/useStudioController.ts。
 */
</script>

<template>
  <div class="home-view">
    <AppHeader />

    <main>
      <HeroSection />
      <PixelStudio />
      <HowItWorks />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.home-view {
  position: relative;
  isolation: isolate;
}
</style>
