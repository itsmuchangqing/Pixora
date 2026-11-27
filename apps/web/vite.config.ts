import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Vite 是前端开发与打包工具。
 * - @vitejs/plugin-vue：让 Vite 能编译 .vue 单文件组件。
 * - server.proxy：把浏览器发往 /api 的请求转发给 Express（3001 端口），
 *   开发时前端无需硬编码跨域地址，也不会遇到 CORS 问题。
 */
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
