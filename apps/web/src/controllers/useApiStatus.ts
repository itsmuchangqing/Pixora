import { onBeforeUnmount, onMounted, ref } from 'vue';
import { checkApiHealth } from '../services/api';
import type { ApiStatus } from '../models/pixel';

/**
 * Composable：一个可复用的响应式逻辑单元。
 * 这里封装“检查后端是否在线”，组件只拿 status 展示即可。
 */
export function useApiStatus() {
  const status = ref<ApiStatus>('checking');
  let controller: AbortController | null = null;

  async function refresh() {
    controller?.abort();
    controller = new AbortController();
    status.value = 'checking';

    try {
      await checkApiHealth(controller.signal);
      status.value = 'online';
    } catch (error) {
      // 主动取消请求不算服务离线，不更新状态。
      if (error instanceof DOMException && error.name === 'AbortError') return;
      status.value = 'offline';
    }
  }

  // 组件挂载时自动检查一次。
  onMounted(refresh);

  // 组件卸载时取消未完成的请求，避免内存泄漏。
  onBeforeUnmount(() => controller?.abort());

  return { status, refresh };
}
