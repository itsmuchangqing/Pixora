/**
 * 前端 API 访问层
 * ------------------------------------------------------------
 * 页面组件不直接写 fetch，而是调用这里导出的函数。
 * 这样做的好处：请求地址、错误处理、超时策略都只维护一份。
 *
 * 开发环境中 /api 会由 Vite 代理到 http://localhost:3001，
 * 生产环境可以通过 VITE_API_BASE_URL 指向真实后端域名。
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface HealthResponse {
  success: boolean;
  data?: {
    status: 'ok';
    service: string;
    version: string;
    uptime: number;
  };
}

/** 调用后端健康检查，用来在界面上显示 API 连接状态。 */
export async function checkApiHealth(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`健康检查失败（HTTP ${response.status}）`);
  }

  const payload = (await response.json()) as HealthResponse;

  if (!payload.success || payload.data?.status !== 'ok') {
    throw new Error('健康检查返回了非预期数据');
  }
}

/**
 * TODO：接入真实像素化能力时，在这里补充上传函数，例如：
 *
 * export async function pixelateImage(file: File, settings: PixelSettings) {
 *   const formData = new FormData();
 *   formData.append('image', file);
 *   formData.append('settings', JSON.stringify(settings));
 *   const response = await fetch(`${API_BASE_URL}/pixelate`, {
 *     method: 'POST',
 *     body: formData,
 *   });
 *   ...
 * }
 *
 * 组件层仍只负责展示状态，不关心 FormData 或接口细节。
 */
