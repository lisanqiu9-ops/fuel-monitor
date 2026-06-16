# 胎教故事助手 PWA 当前状态

当前胎教故事助手仍保留 MVP 前端闭环：输入主题、生成 mock 故事、预览编辑、保存、选择声音、生成朗读、播放、查看历史。真实朗读接入方案已调整为 Cloudflare Worker 代理百炼 TTS：前端保存 Worker Base URL 和已有百炼 `voice_id`，不保存任何 API Key。

## 当前语音方案

- 不做声音复刻。
- 不上传录音样本。
- 不创建 `/api/voice/clone`。
- 前端声音页只允许保存已有百炼 `voice_id`、音色名称和目标模型。
- 前端设置页只允许配置 Worker Base URL、是否启用真实语音、语速、音量和朗读语气。
- Worker 从 Cloudflare Secrets 读取 `DASHSCOPE_API_KEY`，调用百炼 `SpeechSynthesizer`。
- Worker 返回 `audioUrl` 后，播放器直接播放远程音频。
- Worker 未配置或不可用时，可继续使用 mock 音频演示。

## 关键文件

- `src/apps/babyStory/BabyStoryApp.tsx`：胎教故事助手页面、声音 ID 管理、播放器、设置页。
- `src/apps/babyStory/api.ts`：mock 故事、mock 音频、Worker TTS 调用。
- `src/apps/babyStory/storage.ts`：`babyStory:*` localStorage 存储和语音运行配置。
- `src/apps/babyStory/types.ts`：故事、音频、音色和 Worker 运行配置类型。
- `worker/src/index.ts`：Cloudflare Worker TTS 代理。
- `worker/README.md`：Worker 配置和 curl 验证说明。

## 安全边界

- `DASHSCOPE_API_KEY` 只能配置在 Cloudflare Worker Secrets。
- 前端代码、页面、localStorage、IndexedDB、构建产物中不应出现真实密钥。
- 前端不保存录音样本，不保存 sample URL。
- `voice_id` 只作为内部字段保存，列表和播放器不明文展示。

## 验证重点

1. `/baby-story` 可以继续用 mock 完成故事和朗读演示。
2. 设置页配置 Worker Base URL 并启用真实语音。
3. 声音页保存已有百炼 `voice_id`。
4. 生成故事后选择该音色生成朗读，播放器应播放 Worker 返回的 `audioUrl`。
5. 浏览器 localStorage 中不应存在 `DASHSCOPE_API_KEY` 或录音样本。
