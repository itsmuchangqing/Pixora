# Pixora 架构说明（MVC）

这份文档解释项目为什么这样分层、每一层的边界在哪里，以及新增功能时应该把代码放在哪。

---

## 1. 总体结构

项目使用 npm workspaces，把两个应用放在同一个仓库：

```text
apps/web   Vue 3 单页应用（浏览器中的 View / Controller）
apps/api   Express API（HTTP 层的 Controller / Model / View）
```

它们通过 `/api` 通信：

```text
浏览器
  │
  │  GET /api/health
  ▼
Vite Dev Server (5173)
  │  proxy
  ▼
Express API (3001)
  │
  ├─ Route
  ├─ Controller
  ├─ Service / Model
  └─ View（JSON 响应）
```

生产部署时，前后端可以分别部署。前端通过 `VITE_API_BASE_URL` 指向 API 域名，后端通过 `CORS_ORIGIN` 允许该域名。

---

## 2. 前端 MVC

### 2.1 分层对照

| MVC 层 | 目录 | 回答的问题 | 不负责什么 |
| --- | --- | --- | --- |
| Model | `src/models/`、`src/services/` | 数据长什么样？有哪些业务选项？如何请求 API？ | 不渲染 DOM，不依赖组件 |
| View | `src/views/`、`src/components/` | 数据如何呈现？用户点击后发出什么事件？ | 不写接口请求，不做复杂业务决策 |
| Controller | `src/controllers/` | 当前状态是什么？某个动作发生后下一步做什么？ | 不写具体 CSS 布局，不直接拼 HTML |

严格 MVC 中的 Controller 通常是一个类。Vue 生态更习惯用 Composition API：

```ts
// controllers/useStudioController.ts
export function useStudioController() {
  const settings = reactive<PixelSettings>({ ...DEFAULT_SETTINGS });
  const { items, selectedItem } = useImageQueue();
  const pixelEditor = usePixelEditing();

  function handleReset() {
    Object.assign(settings, DEFAULT_SETTINGS);
  }

  return { settings, items, selectedItem, pixelEditor, handleReset };
}
```

组件把它当作 Controller 使用：

```vue
<!-- components/studio/PixelStudio.vue -->
<script setup lang="ts">
const { settings, items, handleReset } = useStudioController();
</script>
```

这样保留了 MVC 的职责分离，也保留了 Vue 的响应式能力。没有必要为了“像 MVC”写一套笨重的 class 包装。

### 2.2 页面中的具体对象

| 角色 | 文件 | 职责 |
| --- | --- | --- |
| 页面 View | `views/HomeView.vue` | 组织页头、Hero、工作台、步骤、页脚 |
| 业务 View | `components/studio/PixelStudio.vue` | 很薄的绑定层：Controller → 子组件 / 子组件事件 → Controller |
| 输入 View | `components/studio/ControlPanel.vue` | 表单控件、拖拽、批量上传、调色板和导出入口 |
| 批量 View | `components/studio/BatchQueue.vue` | 队列缩略图、状态、重试、删除、ZIP 与精灵表入口 |
| 画布 View | `components/studio/ImageStage.vue` | Canvas、悬停取色、对比、25%–1600% 缩放、空格平移、快捷键入口 |
| 工具 View | `components/studio/EditorToolbar.vue` | 图片调整、手绘工具、当前 HEX、撤销/重做按钮、网格 |
| 调色板 View | `components/studio/PaletteEditor.vue` | 实际色板、吸管/选中像素同步高亮、点击色板改像素、改色和色板导入 |
| 弹窗 View | `CropDialog.vue`、`MultiSizeDialog.vue`、`ProjectDialog.vue`、`DestructiveDialog.vue`、`ShortcutsDialog.vue` | 裁剪、多尺寸、本地项目、破坏性确认、快捷键帮助 |
| 素材 View | `components/studio/AssetCategoryPicker.vue` | 一个按钮展开 12 类素材 |
| 页面 Controller | `controllers/useStudioController.ts` | 模式、队列、生成、编辑、导出、项目、分享的总编排 |
| 队列 Controller | `controllers/useImageQueue.ts` | 多文件校验、object URL、选中项、队列恢复 |
| 编辑 Controller | `controllers/usePixelEditing.ts` | 手绘、填充、撤销重做、色板映射和锁定 |
| 子 Controller | `controllers/useApiStatus.ts` | 健康检查请求与在线状态 |
| Model | `models/pixel.ts`、`pixel-options.ts`、`project.ts`、`samples.ts` | 类型、选项、项目快照和示例素材 |
| 数据访问 | `services/api.ts` | HTTP 请求，只返回数据/抛错 |
| 像素 Service | `services/pixel-art.service.ts` | 解码、降采样、Worker 调度、像素网格、导出渲染 |
| 图片编辑 Service | `services/image-edit.service.ts` | 裁剪、旋转、翻转、剪贴板读取 |
| 色板 Service | `services/palette.service.ts` | 改色、导入解析、最近色映射、透明度检测 |
| 导出 Service | `services/export.service.ts` | ZIP、精灵表、下载文件名 |
| 项目 Service | `services/project.service.ts` | IndexedDB 元数据、项目载荷和自动草稿 |
| 分享 Service | `services/share.service.ts` | 设置编码、URL 校验、hash 清理 |
| 计算 Worker | `workers/pixel-art.worker.ts` | Lab 聚类、区域填色、抖动、轮廓等重计算 |
| 偏好持久化 | `services/preferences.service.ts` | 校验并读写工作台设置，不保存图片 |
| 离线 | `public/sw.js`、`public/manifest.webmanifest` | PWA 缓存与安装信息 |
| 基础 UI | `components/ui/` | Button、Logo、Toast、SegmentedControl |

### 2.3 依赖方向

```text
View
  │ 只读取 Controller 暴露的状态
  │ 只发出事件
  ▼
Controller
  │ 组合状态
  │ 调用 Service
  ▼
Service / Model
```

依赖只能向下，不允许反过来：

- ✅ 组件导入 `models` 的**类型**是允许的，因为类型会在编译后消失。
- ✅ 组件使用 `defineModel` / `emit` 把动作交给 Controller。
- ❌ 组件里直接 `fetch('/api/...')`。请求属于 Service，编排属于 Controller。
- ❌ Model 或 Service 导入 Vue 组件。它们应该与 UI 无关。

### 2.4 批量上传与像素化流程

```text
用户选择多个文件 / 拖入 / Ctrl+V 粘贴
  ↓
ControlPanel.vue「发出 files-selected」
  ↓
PixelStudio.vue「转发给 Controller」
  ↓
useStudioController.handleFilesSelected(files)
  ↓
useImageQueue（队列 Controller）
  ├─ 校验 MIME、扩展名、大小和队列上限
  ├─ URL.createObjectURL
  ├─ 读取每张图宽高
  ├─ 创建 StudioItem（状态 queued）
  └─ 选中第一张新素材
  ↓
items 变化 → schedulePendingProcessing()
  ↓
串行处理队列（220ms 防抖 + requestId + AbortController）
  ↓
services/pixel-art.service.ts（主线程）
  ├─ 图片解码
  ├─ 边缘感知降采样（平坦区平均，边缘区主导色）
  ├─ 可选宏像素细节
  ├─ 素材模式：清理背景 / 应用武器轮廓
  └─ 把低分辨率 RGBA 传入 Worker
        ↓
workers/pixel-art.worker.ts
  ├─ 双边滤波
  ├─ Lab 聚类 + 最大色数预算
  ├─ 区域平均填色或 Bayer 抖动
  ├─ 可选标准 / Selout 轮廓
  └─ 回传低分辨率艺术像素
        ↓
返回 PixelGrid（RGBA data + 实际色板）和输出尺寸
  ↓
ImageStage 用 Canvas 直接绘制当前选中素材
  ↓
usePixelEditing 可在同一份网格上手绘、改色、撤销
  ↓
导出时 renderGridBlob / renderGridAtLongSide 生成 Blob
```

要点：

1. 图片没有上传到服务器，`blob:` 地址只在当前标签页有效。
2. 旧 object URL 会被释放，组件销毁时也会清理，避免内存泄漏。
3. 批量任务串行执行，避免多个 Worker 同时抢占 CPU。
4. 新参数会取消上一轮 Worker；旧异步结果通过 `requestId` 丢弃。
5. Worker 只负责像素化算法；预览、编辑、ZIP 和 IndexedDB 都在主线程的 Service 中。
6. 生成结果以低分辨率网格为准，导出时才按尺寸和倍率渲染，因此调色板/手绘不需要重新聚类。

### 2.5 编辑、导出与本地项目

```text
源图调整（裁剪 / 旋转 / 翻转 / 粘贴）
  ↓
image-edit.service.ts 生成新的源图 Blob
  ↓
useImageQueue.replaceSource()
  ↓
该素材重新入队像素化

手绘 / 调色板
  ↓
usePixelEditing 直接修改 PixelGrid.data
  ↓
gridVersion 增加 → ImageStage 重绘 Canvas
  ↓
undo / redo 从每个素材的历史快照恢复

导出
  ↓
useStudioController
  ├─ 单张：renderGridBlob
  ├─ 多尺寸：renderGridAtLongSide × N → export.service.createZip
  ├─ 批量：所有素材 → ZIP + manifest
  └─ 精灵表：createSpriteSheet → PNG + JSON → ZIP

本地项目
  ↓
project.service.ts
  ├─ meta store：名称、时间、缩略图、素材数量
  └─ payloads store：源图 Blob + 当前 PixelGrid + 生成底图 + 设置
  ↓
1 秒防抖自动保存草稿
  ↓
刷新时 loadDraft() → useImageQueue.restoreItems() → 恢复 Canvas
```

项目保存的是**当前源图 Blob 与当前像素网格**，因此恢复时不会重新跑一遍像素化，也能保留手绘结果。

### 2.6 手绘保护与色板反馈

`usePixelEditing` 只修改像素网格，因此重新生成底图会覆盖这些修改。控制器为每个素材增加 `edited` 标记：

```text
画笔 / 橡皮擦 / 填充 / 改色板 / 导入色板
  ↓
item.edited = true
  ↓
会重新生成的设置 / 裁剪旋转 / 删除 / 清空 / 打开项目
  ↓
requestGuard() 确认弹窗
  ├─ 取消：恢复 confirmedProcessingConfig，当前网格不变
  └─ 确认：重新生成，edited 清零
```

参数变化采用“先确认、后失效”的顺序：设置对象先更新，但 watcher 在确认前不会取消旧网格或启动 Worker。取消时恢复最后一次确认过的设置、模式和分类。

色板反馈链路：

```text
鼠标悬停 Canvas
  ↓
读取 PixelGrid.data 当前坐标
  ↓
ImageStage 显示坐标 + HEX + 色块

吸管点击像素
  ↓
usePixelEditing 更新 brushColor
  ↓
自动切到右侧“色板”页
  ↓
PaletteEditor watch(brushColor) → 高亮对应 swatch

选择工具点击像素
  ↓
useStudioController.selectedPixel + selectedPixelInfo
  ├─ ImageStage 在缩放层外用屏幕坐标画 1px 选框
  ├─ 自动切到“色板”页
  ├─ PaletteEditor 高亮对应 swatch
  └─ 选中状态下：工具栏“选择颜色”或点击色板 → 直接修改这一个像素
        ↓
颜色选择器 input → previewPixelColor()，实时重绘，不新增历史
颜色选择器 change → finishPixelColorPreview()，一次拖动只保留一个撤销快照
```

`selectedPixelInfo` 每次从当前 `PixelGrid.data` 读取颜色，因此全局改色、撤销或单像素修改后，坐标、HEX 和色板高亮都会同步更新。切换素材、重新生成、裁剪旋转或打开项目会清除选中状态。

选框使用屏幕坐标而不是画布内坐标，所以缩放 1600% 时边框仍然只有 1px，且没有半透明填充，不会遮住选中像素自己的颜色。

橡皮擦使用生成底图恢复：

```text
像素化完成
  ↓
item.grid = 当前结果
item.baseGrid = clonePixelGrid(item.grid)
  ↓
画笔 / 油漆桶 / 单像素改色 → 只改 item.grid
  ↓
橡皮擦 → 从 item.baseGrid 写回该像素的 RGBA
  ↓
undo/redo 仍只操作当前编辑历史
```

`baseGrid` 会随 IndexedDB 项目/草稿保存，因此刷新后橡皮擦仍能恢复。它保存的是最近一次自动生成的像素结果，整体色板映射和单像素改色属于编辑层，不会反向修改底图。

右侧面板分为“参数”和“色板”两页。参数页承载上传、队列、尺寸、轮廓和预设；色板页承载色数、抖动和调色板；导出区始终保留在面板底部。

分享链接只编码设置：

```text
settings + mode + category + backgroundMode + exportScale + lockedColors
  ↓
JSON → UTF-8 → base64url → #pixora=...
  ↓
打开时 normalizeStudioPreferences() 校验 → 清理 hash
```

### 2.7 为什么暂时不用 Pinia / Vue Router

当前只有一个页面，状态也只在工作台内部使用：

- 页面跳转用锚点完成，不需要路由。
- 状态只覆盖一个工作台，不需要全局 store。

过早引入 Pinia 会增加一个间接层，但不产生实际收益。等出现多个页面、共享账户状态或草稿持久化时再添加：

- `views/` 结构已经为 Router 留好了位置。
- Controller 的函数边界已经为迁移到 Pinia 留好了出入口。
- 引入时保持 View 不直接请求 API 的规则即可。

---

## 3. 后端 MVC

### 3.1 分层对照

| 层 | 目录 | 职责 |
| --- | --- | --- |
| Route | `routes/` | URL/HTTP 方法到 Controller 的映射，不属于 MVC 核心 |
| Controller | `controllers/` | 读取请求、校验输入、调用 Service、调用 View 输出 |
| Model / Service | `models/`、`services/` | 领域数据和业务规则 |
| View | `views/api-response.view.ts` | 选择最终对外表现（统一 JSON 格式） |
| Middleware | `middleware/` | 横切关注点：404、错误处理 |
| Config | `config/env.ts` | 环境变量集中入口 |

纯 API 项目没有服务端 HTML 模板，所以这里的 View 是 **API 响应视图**：Controller 不自己拼响应结构，而是调用 `sendSuccess` / `sendFailure`。以后需要加入 `requestId`、分页包装或 API 版本信息时，只改 View 层即可。

### 3.2 一次请求的路径

以当前的 `GET /api/health` 为例：

```text
GET /api/health
  ↓
routes/health.routes.ts
  ↓
controllers/health.controller.ts
  ↓  组装健康数据
views/api-response.view.ts  →  sendSuccess(...)
  ↓
HTTP 200 JSON
```

以占位的 `POST /api/pixelate` 为例：

```text
POST /api/pixelate
  ↓
routes/pixelate.routes.ts
  ↓
controllers/pixelate.controller.ts
  ↓  读取设置参数
services/pixelate.service.ts
  ↓  任务尚未实现，抛出 HttpError(501, ...)
middleware/error-handler.ts
  ↓
views/api-response.view.ts  →  sendFailure(...)
  ↓
HTTP 501 JSON
```

这里刻意保留一条“会失败但格式正确”的业务路径，让前端的错误处理和后续接口接入有稳定的契约。

### 3.3 为什么错误处理在中间件

Controller 只处理正常流程和“把错误交给 `next`”：

```ts
try {
  const result = await requestPixelation(input);
  sendSuccess(res, result);
} catch (error) {
  next(error);
}
```

统一的错误中间件负责：

- 识别 `HttpError` 的状态码和错误 code；
- 在开发环境打印堆栈；
- 在生产环境隐藏 500 错误的内部细节；
- 通过 View 层返回统一结构。

这避免了每个 Controller 重复写错误响应，也避免把内部异常直接泄露给客户端。

---

## 4. 前后端如何扩展

### 场景 A：新增一个风格预设

1. 在 `apps/web/src/models/pixel.ts` 扩展 `PresetId` 联合类型。
2. 在 `apps/web/src/models/pixel-options.ts` 增加选项数据。
3. 如果新预设需要独立缩略图，在 `PresetPicker.vue` 的现有数据驱动渲染中补充颜色即可。
4. Controller 不需要改动，`v-model` 会自动带着新值流转。
5. 后端 `apps/api/src/models/pixel-options.model.ts` 同步增加并实现真正的处理逻辑。

### 场景 B：接入真正的像素化 API

1. **View**：`ControlPanel` 的“导出”只是发出 `export` 事件，不需要写上传代码。
2. **Controller**：`useStudioController.handleExport` 改为异步流程：设置 `isProcessing`、调用 API Service、处理成功/失败，并暴露给 View 显示 loading。
3. **Service**：在 `services/api.ts` 增加 `pixelateImage(file, settings)`，负责构造 `FormData` 和解析返回。
4. **后端**：Route 增加上传中间件 → Controller 校验 → Service 实现 `sharp` 处理 → View/下载响应。
5. 更新 README 中接口表和状态说明。

### 场景 C：增加作品历史、登录或数据库

需要新的共享状态，按以下顺序演进：

1. 后端增加数据库模型、Repository/Service、Controller 和响应类型。
2. 前端增加对应 Model 类型与 API Service。
3. 当状态需要跨多个页面共享时引入 Pinia；如果已有多个页面，则引入 Vue Router。
4. View 层只消费新的 Controller 状态，不要让组件感知数据库结构。

---

## 5. 当前边界与未完成部分

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 页面与响应式布局 | 已完成 | 桌面 / 平板 / 移动端 |
| 整图 / 素材模式切换 | 已完成 | 两个模式共用本地像素画引擎，分类影响标注与文件名 |
| 素材分类入口 | 已完成 | 下拉展开 12 类素材，尚未做素材内容识别 |
| 图片本地选择、拖拽、粘贴 | 已完成 | 支持多选和剪贴板，只创建本地 blob URL |
| 批量队列 | 已完成 | 最多 24 张，独立状态、重试、删除、ZIP、精灵表 |
| 基础图片编辑 | 已完成 | 裁剪、旋转、翻转、恢复原图、缩放平移、对比滑块 |
| 参数状态与自动生成 | 已完成 | 尺寸、预设、色数、抖动、轮廓、宏细节、模式、分类变化会重新生成 |
| 像素画算法 | 已完成（浏览器端） | 边缘感知降采样、区域平均、Lab 聚类、轮廓描边、最近邻输出 |
| 边缘保护 | 已完成 | 边缘区块取主导色，平坦区块取平均色 |
| 色数控制 | 已完成 | 8 / 16 / 32 / 64 色，包含描边颜色预算 |
| 有序抖动 | 已完成 | 可选的 4×4 Bayer 抖动，只在颜色接近且落在混色线上时启用 |
| 目标分辨率 | 已完成 | 32 / 64 / 128 / 256 / 512 px 长边，输出保持宽高比；小图先放大分析图 |
| Selout 选择性描边 | 已完成 | 轮廓默认关闭；开启后可从现有色板选择暗部颜色 |
| 宏像素细节 | 已完成 | 平坦宏块保持整块，边缘宏块自适应拆成 2×2 微像素 |
| 素材背景 | 已完成 | 连通纯色背景和封闭同色背景清理；白底 / 透明底可选；复杂背景仍建议先抠图 |
| 角色细节保护 | 已完成 | 自动启用宏细节、限制最小宏观网格并降低五官细节阈值 |
| 武器固定轮廓 | 已完成 | 固定 640px 蒙版 + 多档容差，优先保留与背景相近的大块刀身和高光 |
| 手绘修正 | 已完成 | 移动、选择像素、画笔、橡皮擦、油漆桶、吸管、1–4px、网格、撤销重做、悬停取色 |
| 单像素编辑 | 已完成 | 箭头选择、1px 屏幕选框、坐标/HEX、色板高亮、点击色板直接改选中像素，支持撤销 |
| 颜色控件 | 已完成 | 统一“选择颜色”：选择像素时实时改像素（一次拖动一个撤销步），画笔/油漆桶改画笔色，橡皮擦等工具置灰 |
| 橡皮擦 | 已完成 | 从生成底图恢复原色，不再擦成透明；底图随项目/草稿保存，支持撤销 |
| 调色板 | 已完成 | 参数/色板分页、吸管/选中像素同步高亮、点击色板改像素、全局改色、锁定、色板导入 |
| 编辑保护 | 已完成 | 手绘后修改生成参数、裁剪旋转、删除、清空、打开项目先确认；取消恢复原设置 |
| 预览插值 | 已完成 | Canvas + `image-rendering: pixelated`；25%–1600% 缩放、适应窗口、空格拖动平移 |
| 快捷键帮助 | 已完成 | 画布底部“快捷键”按钮，撤销/重做按钮附带快捷键提示 |
| 计算线程 | 已完成 | 重计算放入 Web Worker；切换参数会中止旧任务，失败时回退主线程 |
| 导出下载 | 已完成（浏览器端） | PNG / JPG / WEBP、白底 / 透明、1x/2x/4x、多尺寸 ZIP、批量 ZIP、精灵表 |
| 项目与历史 | 已完成（本地） | IndexedDB 命名项目 + 1 秒自动草稿，刷新恢复源图、网格和手绘修改 |
| 分享参数 | 已完成 | URL hash 编码设置，带校验；不包含图片 |
| 示例素材 | 已完成 | 树木、角色、武器、怪物在空状态只作展示，不可点击生成 |
| 偏好持久化 | 已完成 | 模式、分类、尺寸、色板等设置存入 localStorage |
| PWA / 离线 | 已完成（生产构建） | manifest、Service Worker、应用外壳和静态资源缓存 |
| 快捷键 | 已完成 | 撤销、重做、导出、模式切换、工具、网格、缩放 |
| 服务器文件上传 | 未实现 | 推荐 `multipart/form-data` + multer |
| 账号 / 云端历史 | 未实现 | 需要数据库、鉴权、配额和部署方案；当前保持本地优先 |
| 批量单张参数覆盖 | 未实现 | 当前统一使用面板参数；单张可独立裁剪、旋转和手绘 |
| 手绘版本历史 | 未实现 | 当前只做破坏性操作确认；确认后会重新生成，未自动保留旧编辑层 |
| 手动背景蒙版 | 未实现 | 下一步可增加魔术棒、擦除 / 恢复画笔 |
| 自动测试 | 未配置 | 后续可用 Vitest 覆盖算法，用 Playwright 覆盖批量、导出与项目恢复 |

### 安全提醒

接入真实上传功能时，必须补充：

- 校验文件真实内容，不能只信任扩展名或 MIME；
- 设置文件大小、像素尺寸和处理时长上限；
- 不要把用户上传文件直接按原始文件名写入磁盘；
- 处理临时文件，避免磁盘堆积；
- 在生产环境限制 CORS 白名单并配置反向代理与请求体大小限制。

---

## 6. MVC 检查清单

新增代码之前，用这几条快速判断位置：

- 它描述“有哪些数据/字段/选项”吗？→ `models/`
- 它与外部系统（HTTP、文件系统）通信吗？→ `services/`
- 它编排状态、处理用户动作的后续流程吗？→ `controllers/`
- 它只画界面，并通过 props / emits 连接吗？→ `views/` 或 `components/`
- 它是后端的 HTTP 请求到业务调用的翻译吗？→ `controllers/`
- 它定义业务规则吗？→ `services/`
- 它决定响应体的最终格式吗？→ `views/`
- 它只是 URL 映射吗？→ `routes/`
