# 胎教故事助手 Cloudflare Worker

这个 Worker 只做百炼 TTS 代理：前端保存已有的百炼 `voice_id`，朗读时把 `text`、`voiceId`、`targetModel` 发给 Worker。Worker 使用 Secrets 中的 `DASHSCOPE_API_KEY` 调用百炼 `SpeechSynthesizer`，再把 `audioUrl` 返回前端播放。

当前方案不做声音复刻，不上传录音样本，不需要 R2。

## Cloudflare 配置

在 Cloudflare Dashboard 的 Worker 设置中配置：

- `DASHSCOPE_API_KEY`：Secret，必填。
- `BAILIAN_TARGET_MODEL`：Variable，可选，默认 `cosyvoice-v3.5-flash`。
- `CORS_ALLOWED_ORIGIN`：Variable，建议开发时填 `http://127.0.0.1:3001`，线上填 PWA 域名。

不要在前端代码、localStorage、IndexedDB、页面输入框、构建产物或仓库配置中保存 `DASHSCOPE_API_KEY`。

## 接口

### GET /health

用于检查 Worker 是否可访问。

### POST /api/tts/synthesize

请求体：

```json
{
  "text": "胎教故事正文",
  "voiceId": "百炼已有 voice_id",
  "targetModel": "cosyvoice-v3.5-flash",
  "rate": 0.85,
  "pitch": 1,
  "volume": 50,
  "format": "mp3",
  "instruction": "请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，语速稍慢，停顿自然。"
}
```

返回：

```json
{
  "audioUrl": "https://...",
  "audioId": "...",
  "expiresAt": 1234567890,
  "requestId": "...",
  "provider": "bailian",
  "model": "cosyvoice-v3.5-flash",
  "voiceId": "..."
}
```

## 前端使用

1. 进入胎教故事助手的设置页。
2. 填写 Worker Base URL，例如 `https://baby-story-tts-worker.example.workers.dev`。
3. 打开“启用真实语音”。
4. 在声音页保存百炼已有 `voice_id`。
5. 生成故事后选择该声音并生成朗读。

Worker 未配置或不可用时，前端可以继续使用 mock 朗读兜底。

## curl 验证

```bash
curl -X POST "https://your-worker.example.workers.dev/api/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "小星星在月光里听见爸爸妈妈温柔的声音。",
    "voiceId": "替换为百炼已有voice_id",
    "targetModel": "cosyvoice-v3.5-flash",
    "rate": 0.85,
    "volume": 50,
    "format": "mp3",
    "instruction": "请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，语速稍慢，停顿自然。"
  }'
```

常见错误：

- `Worker 未配置 DASHSCOPE_API_KEY`：在 Cloudflare Worker Secrets 中补充密钥。
- `缺少百炼 voiceId`：前端没有传入可用的百炼音色 ID。
- `百炼语音合成失败`：检查 `voiceId`、`targetModel` 是否匹配，以及 DashScope Key 权限和余额。
- 浏览器 CORS 报错：检查 `CORS_ALLOWED_ORIGIN` 是否等于当前 PWA 的访问源。
