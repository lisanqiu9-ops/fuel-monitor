# 胎教故事助手 Cloudflare Worker

这个 Worker 只做百炼 TTS 代理和音色白名单映射。前端只发送 `voiceKey`，例如 `papa` 或 `mama`；真实百炼 `voice_id` 只配置在 Cloudflare Worker Secrets/Variables 中，不进入前端代码、页面、localStorage 或构建产物。

当前方案不做声音复刻，不上传录音样本，不创建音色。

## Cloudflare 配置

在 Cloudflare Dashboard 的 Worker 设置中配置：

- `DASHSCOPE_API_KEY`：Secret，必填。
- `BAILIAN_TARGET_MODEL`：Variable，可选，默认 `cosyvoice-v3.5-flash`。
- `CORS_ALLOWED_ORIGIN`：Variable，线上填 `https://lisanqiu9-ops.github.io`。
- `BAILIAN_VOICE_PAPA`：Secret 或 Variable，爸爸声音对应的百炼 `voice_id`。
- `BAILIAN_VOICE_MAMA`：Secret 或 Variable，妈妈声音对应的百炼 `voice_id`。

也可以用一个 JSON 变量统一配置：

```json
{
  "papa": "百炼爸爸voice_id",
  "mama": "百炼妈妈voice_id"
}
```

变量名为 `BAILIAN_VOICE_MAP`。

## 接口

### GET /health

用于检查 Worker 是否可访问。

### POST /api/tts/synthesize

请求体：

```json
{
  "text": "胎教故事正文",
  "voiceKey": "papa",
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
  "voiceKey": "papa"
}
```

## 前端使用

1. 进入胎教故事助手设置页。
2. 填写 Worker Base URL。
3. 打开“启用真实语音”。
4. 在声音页选择“爸爸声音”或“妈妈声音”。
5. 生成故事后点朗读。

## curl 验证

```bash
curl -X POST "https://your-worker.example.workers.dev/api/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "小星星在月光里听见爸爸妈妈温柔的声音。",
    "voiceKey": "papa",
    "targetModel": "cosyvoice-v3.5-flash",
    "rate": 0.85,
    "volume": 50,
    "format": "mp3",
    "instruction": "请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，语速稍慢，停顿自然。"
  }'
```

常见错误：

- `Worker 未配置百炼 API Key`：补充 `DASHSCOPE_API_KEY`。
- `Worker 未配置音色白名单：papa`：补充 `BAILIAN_VOICE_PAPA` 或 `BAILIAN_VOICE_MAP`。
- `百炼语音合成失败`：检查 voice_id、targetModel、DashScope Key 权限和余额。
- 浏览器 CORS 报错：检查 `CORS_ALLOWED_ORIGIN` 是否包含当前 PWA 来源。
