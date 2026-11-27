import { createApp } from 'vue';
import App from './App.vue';
import './styles/tokens.css';
import './styles/base.css';

/**
 * 整个前端的入口文件。
 * 先加载全局设计令牌和基础样式，再挂载根组件 App。
 */
createApp(App).mount('#app');

// 仅生产构建注册 Service Worker；开发时避免缓存干扰 Vite HMR。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('[Pixora] PWA 注册失败', error));
  });
}
