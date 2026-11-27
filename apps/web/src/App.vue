<script setup lang="ts">
import HomeView from './views/HomeView.vue';

/**
 * 根组件：只负责决定当前渲染哪个“页面”。
 * 现在只有一个工作室首页；以后接入 vue-router 时，
 * 这里通常只需要放一个 <RouterView />。
 */
</script>

<template>
  <HomeView />
</template>
