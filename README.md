# 油耗监控

一个轻量的油耗记录小工具，支持手动录入、趋势统计、历史记录、JSON 备份导入/导出，以及可选的百度 OCR 小票识别。

## 本地运行

前置要求：安装 Node.js。

```bash
npm install
npm run dev
```

打开终端提示的本地地址，默认通常是 `http://localhost:3000`。

## 数据说明

- 应用默认不内置任何个人加油记录。
- 记录保存在当前浏览器的 `localStorage` 中。
- 换电脑或手机后不会自动同步，需要在设置页导出 JSON，再到另一台设备导入。
- `private-backups/` 是私有备份目录，已经加入 `.gitignore`，不要把这个目录分享或上传到 GitHub。

## OCR 说明

OCR 是可选功能。推荐把百度 OCR 的 API Key 和 Secret Key 放在 Cloudflare Worker 的环境变量里，前端只保存 Worker URL。

Cloudflare Worker 需要配置这些变量：

```text
BAIDU_API_KEY=你的百度 API Key
BAIDU_SECRET_KEY=你的百度 Secret Key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://liwu.dpdns.org,https://lisanqiu9-ops.github.io
OCR_ACCESS_TOKEN=可选访问令牌
```

如果设置了 `OCR_ACCESS_TOKEN`，需要在应用设置页里填写同一个访问令牌。这个令牌用于减少别人直接调用你的 Worker 消耗 OCR 额度的风险。

## 部署路线

当前线上主站是 Cloudflare Pages：

```text
Cloudflare Pages project: sanqiu-toolbox
Custom domain: https://liwu.dpdns.org
```

GitHub Pages 只作为备份预览：

```text
https://lisanqiu9-ops.github.io/fuel-monitor/
```

### 自动部署

仓库包含两个 workflow：

- `.github/workflows/deploy-cloudflare-pages.yml`：发布到 Cloudflare Pages 主站。
- `.github/workflows/deploy.yml`：发布到 GitHub Pages 备份预览。

Cloudflare Pages workflow 需要在 GitHub 仓库配置这些 Secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

如果 Secrets 未配置，Cloudflare workflow 会失败，避免误以为主站已发布。临时应急可以在本机手动发布：

```bash
npm run lint
npm run build
npm run deploy:cloudflare
```

常规发布前检查：

```bash
npm run lint
npm run build
```

更多工程结构、找代码路径和开发原则见：`docs/engineering-guide.md`。

## 部署后 OCR 设置

部署完成后，把线上主站和备份预览的来源域名加入 Cloudflare Worker 的 `ALLOWED_ORIGINS`。

注意：`ALLOWED_ORIGINS` 填的是浏览器来源，只到域名为止，不包含后面的项目路径。主站填写 `https://liwu.dpdns.org`；备份预览 `https://lisanqiu9-ops.github.io/fuel-monitor/` 对应填写 `https://lisanqiu9-ops.github.io`。

例如：

```text
http://localhost:3000,http://localhost:3001,https://liwu.dpdns.org,https://lisanqiu9-ops.github.io
```

然后在油耗监控设置页填写：

- Cloudflare Worker URL
- 访问令牌，如果 Worker 设置了 `OCR_ACCESS_TOKEN`

## 分享前检查

```bash
npm run lint
npm run build
```

确认构建通过后，再分享项目源码或部署产物。分享时不要附带 `private-backups/`。
