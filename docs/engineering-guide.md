# 工程结构与开发原则

本文档是当前个人工具箱的工程约定。新增功能、排查线上问题、接手代码时先看这里。

## 技术路线

- 前端框架：React 19 + Vite + TypeScript。
- 样式：Tailwind CSS v4 + `src/index.css` 中的全局主题变量和组件样式。
- 路由：轻量级浏览器路径路由，集中在 `src/App.tsx`，不引入 React Router。
- 数据：浏览器本地存储优先，按工具独立 localStorage key 管理。
- 后端/代理：需要密钥的能力放到 Cloudflare Worker，不把 API Key 放进前端。
- 主站发布：Cloudflare Pages 项目 `sanqiu-toolbox`，线上域名 `https://liwu.dpdns.org`。
- 备份预览：GitHub Pages `https://lisanqiu9-ops.github.io/fuel-monitor/`。

## 目录边界

```text
src/App.tsx                 工具箱入口、顶层路由、工具入口配置
src/apps/<tool>/            具体工具应用壳、独立页面、工具专属逻辑
src/components/             当前主要是油耗工具的页面组件，后续应逐步迁入 src/apps/fuel/components
src/lib/                    可复用工具函数或历史遗留的油耗工具函数
src/utils/                  复杂计算/报告引擎，当前有油耗分析报告
src/types.ts                当前油耗工具类型，后续应拆到工具内部类型文件
public/                     PWA、静态资源、SPA fallback 相关文件
worker/                     Cloudflare Worker 源码或可复制版本
docs/                       工程说明、阶段计划、沉淀文档
.github/workflows/          自动化部署工作流
```

当前结构能继续开发，但有一个历史问题：油耗工具早期是主应用，后来变成工具箱中的一个工具，所以部分油耗代码还在 `src/components`、`src/lib`、`src/types.ts`。后续新增大功能时不要继续扩大这个历史结构。

## 找代码路径

### 工具箱入口/新增工具入口

- 工具卡片、分类、顶层路径：`src/App.tsx`
- 新工具应用壳：`src/apps/<tool>/<ToolApp>.tsx`
- 顶层路径类型：`RoutePath` in `src/App.tsx`

### 油耗监控

- 应用壳、底部 Tab、弹窗挂载：`src/apps/fuel/FuelApp.tsx`
- 录入页：`src/components/AddRecordTab.tsx`
- OCR 拍照入口：`src/components/OcrCaptureModal.tsx`
- OCR 确认页：`src/components/OcrConfirmModal.tsx`
- 概览页：`src/components/OverviewTab.tsx`
- 趋势页：`src/components/TrendTab.tsx`
- 分析报告页：`src/components/AnalysisReportTab.tsx`
- 历史列表：`src/components/HistoryModal.tsx`
- 详情页：`src/components/RecordDetailModal.tsx`
- 数据归一化/油耗闭合区间重算：`src/data.ts`
- 单条指标计算：`src/lib/metrics.ts`
- 文字报告：`src/lib/report.ts`
- 导出/分享：`src/lib/fuelExport.ts`
- 深度分析报告引擎：`src/utils/fuelReportEngine.ts`
- OCR 解析：`src/lib/ocr.ts`

### 本地记账

- 入口：`src/apps/ledger/LedgerApp.tsx`
- CSV 解析：`src/apps/ledger/ledgerParser.ts`
- 统计：`src/apps/ledger/ledgerStats.ts`
- 页面：`src/apps/ledger/Ledger*Page.tsx`

### 胎教故事

- 入口：`src/apps/babyStory/BabyStoryApp.tsx`
- 存储：`src/apps/babyStory/storage.ts`
- API：`src/apps/babyStory/api.ts`
- 类型：`src/apps/babyStory/types.ts`

### 图片去背景

- 入口与主要逻辑：`src/apps/imageRemover/ImageRemoverApp.tsx`
- 云端接口地址目前在该文件内，后续如继续增加图片工具，应抽到 `src/apps/imageRemover/config.ts`。

### 指南工具

- 入口：`src/apps/guides/GuidesApp.tsx`
- 数据：`src/apps/guides/guidesData.ts`
- 静态图片：`public/guides-assets/`

## 扩展新工具的规则

1. 新工具必须放在 `src/apps/<tool>/` 下，不再新增到根 `src/components`。
2. 工具内部优先自带 `types.ts`、`storage.ts`、`api.ts`、`components/`，只有确定跨工具复用时才放 `src/lib`。
3. 顶层 `src/App.tsx` 只做入口注册和路由分发，不放业务计算。
4. 本地存储 key 必须带工具名前缀，例如 `babyStory:*`、`sanqiu-ledger-*`、`fuellog_*`。
5. 涉及密钥、跨域、第三方 API 的能力必须走 Worker 或后端代理。
6. 涉及业务口径的计算必须集中到纯函数模块，页面只负责展示和交互。
7. 新增导入/导出格式时，必须同时更新归一化函数，保证旧数据可读。

## 部署路线

当前线上主站是 Cloudflare Pages：

```text
Cloudflare Pages project: sanqiu-toolbox
Custom domain: https://liwu.dpdns.org
Build command: npm run build
Output directory: dist
Base path: /
```

GitHub Pages 仍保留为备份预览：

```text
https://lisanqiu9-ops.github.io/fuel-monitor/
```

### 自动部署

- `.github/workflows/deploy-cloudflare-pages.yml`：主部署，面向 `liwu.dpdns.org`。
- `.github/workflows/deploy.yml`：GitHub Pages 备份预览。

Cloudflare Pages 自动部署需要仓库 secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

如果 secrets 未配置，Cloudflare workflow 会跳过发布并在日志里提示。此时只能本地运行：

```bash
npm run lint
npm run build
npm run deploy:cloudflare
```

### 发布前检查

```bash
npm run lint
npm run build
```

发布后验证主站是否更新：

```bash
# 页面引用的 assets/index-*.js 应该与最新 dist 对应
Invoke-WebRequest https://liwu.dpdns.org/fuel -UseBasicParsing
```

## PWA 缓存原则

`public/sw.js` 当前只缓存入口、manifest、图标和部分第三方资源，正常网络优先请求新版本。遇到手机端旧界面时，先确认服务端页面引用的新 `assets/index-*.js` 是否已变化；如果服务端已变化，再处理手机浏览器/PWA 缓存。

## 当前技术债

1. 油耗工具目录边界不清：`src/components` 和 `src/lib` 里有大量油耗专属代码。
2. `src/index.css` 过大，承载了所有工具样式，后续查找 UI 样式成本会升高。
3. `src/App.tsx` 同时管理工具注册、路由和工具箱 UI，工具继续增加后会变长。
4. Cloudflare Worker 代码在设置页里内嵌了一份字符串，和 `worker/` 目录存在重复维护风险。
5. GitHub Pages 和 Cloudflare Pages 双部署容易混淆，必须以 Cloudflare Pages 为线上主线。

## 后续重构顺序

优先级从高到低：

1. 把油耗组件迁入 `src/apps/fuel/components/`。
2. 把油耗专属类型迁到 `src/apps/fuel/types.ts`，再从公共 `src/types.ts` re-export 或逐步替换引用。
3. 把油耗专属 `data.ts`、`metrics.ts`、`report.ts`、`fuelExport.ts` 迁入 `src/apps/fuel/lib/`。
4. 拆分 `src/index.css`：先按工具分段，再考虑组件级 CSS 或 CSS modules。
5. 把工具注册表从 `src/App.tsx` 抽到 `src/apps/registry.ts`。
6. Worker 代码只保留一份源码，设置页只展示从源码生成或维护后的版本。

## 开发原则

- 线上主线优先：做完功能必须确认 `liwu.dpdns.org` 更新，不只看 GitHub Pages。
- 业务口径优先：油耗、记账、报告这类计算口径必须集中、可复用、可导出验证。
- 本地优先但可备份：用户数据默认本地保存，必须提供 JSON/CSV 导出能力。
- 密钥不上前端：任何 API Key、Secret、长期 token 都不能进入浏览器存储。
- 小步提交：功能改动、部署配置、纯文档尽量分开提交，方便回滚。
- 新增入口要可搜索：工具入口需要 title、subtitle、description、keywords 都补齐。
- 不扩大历史债：新代码按 `src/apps/<tool>` 组织，不继续往根 `components` 塞工具专属页面。
