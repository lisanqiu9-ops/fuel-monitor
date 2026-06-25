# Baby Story Cloudflare Worker

This Worker is the server-side proxy for the prenatal story assistant. For the Cloudflare dashboard online editor, paste `worker/src/dashboard-worker.js`; for Wrangler/source control, use `worker/src/index.ts`. The frontend only stores the Worker Base URL, enable switches, and safe voice keys such as `papa` or `mama`. Story provider, model, temperature, and API keys live in Cloudflare Worker configuration. DashScope/Bailian and DeepSeek API keys stay in Cloudflare Worker Secrets and never enter frontend code, localStorage, IndexedDB, or the GitHub Pages build.

The Worker currently supports:

- Story generation through OpenAI-compatible chat APIs:
  - DashScope/Bailian Qwen: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
  - DeepSeek: `https://api.deepseek.com/chat/completions`
- Qwen-TTS voice synthesis through DashScope.

## Cloudflare Variables

Configure these in Cloudflare Dashboard -> Worker -> Settings -> Variables and Secrets.

Plaintext variables:

- `DASHSCOPE_STORY_MODEL`: default `qwen-plus-2025-07-28`
- `DEEPSEEK_STORY_MODEL`: default `deepseek-chat`
- `STORY_PROVIDER`: default `dashscope`; optional fallback when the frontend does not send `provider`
- `STORY_TEMPERATURE`: default `0.75`
- `DASHSCOPE_TTS_MODEL`: `qwen3-tts-vc-2026-01-22`
- `CORS_ALLOWED_ORIGIN`: your GitHub Pages origin, for example `https://lisanqiu9-ops.github.io`

Secrets:

- `DASHSCOPE_API_KEY`: DashScope/Bailian API key. Required for Qwen story generation and Qwen-TTS.
- `DEEPSEEK_API_KEY`: DeepSeek API key. Optional; only required when using DeepSeek.
- `DASHSCOPE_TTS_VOICE_PAPA`: Authorized Qwen voice value for the `papa` voice.
- `DASHSCOPE_TTS_VOICE_MAMA`: Authorized Qwen voice value for the `mama` voice.

Legacy aliases are also supported for compatibility:

- `BAILIAN_VOICE_PAPA`
- `BAILIAN_VOICE_MAMA`

The voice value should look like `qwen-tts-vc-bailian-voice-...`; it is the value sent as `input.voice` to DashScope.

## Endpoints

### GET /health

Returns a small health payload:

```json
{
  "ok": true,
  "service": "baby-story-worker",
  "story": "chat-completions",
  "tts": "qwen-tts-vc"
}
```

### POST /api/story/generate

Frontend request:

```json
{
  "theme": "多多历险记",
  "length": "medium",
  "style": "daily",
  "tone": "soft",
  "babyName": "小星星",
  "provider": "dashscope",
  "model": "qwen-plus-2025-07-28",
  "temperature": 0.75
}
```

Response:

```json
{
  "title": "多多历险记的小小晚安故事",
  "body": "第一段...\n\n第二段...",
  "provider": "dashscope",
  "model": "qwen-plus-2025-07-28",
  "requestId": "..."
}
```

Manual test:

```bash
curl -X POST "https://your-worker.example.workers.dev/api/story/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "theme": "多多历险记",
    "length": "medium",
    "style": "daily",
    "tone": "soft",
    "babyName": "小星星",
    "provider": "dashscope",
    "model": "qwen-plus-2025-07-28",
    "temperature": 0.75
  }'
```

### POST /api/tts/synthesize

Frontend request:

```json
{
  "text": "宝宝，晚上好，今天爸爸给你讲一个小星星的故事。",
  "voiceKey": "papa"
}
```

Worker -> DashScope payload:

```json
{
  "model": "qwen3-tts-vc-2026-01-22",
  "input": {
    "text": "宝宝，晚上好，今天爸爸给你讲一个小星星的故事。",
    "voice": "qwen-tts-vc-bailian-voice-...",
    "language_type": "Chinese"
  }
}
```

Response:

```json
{
  "audioUrl": "https://...",
  "audioId": "audio_...",
  "expiresAt": 1781747897,
  "requestId": "...",
  "provider": "bailian",
  "model": "qwen3-tts-vc-2026-01-22",
  "voiceKey": "papa"
}
```

Common errors:

- `Worker 未配置 DASHSCOPE_API_KEY`: configure `DASHSCOPE_API_KEY` as a Worker Secret.
- `Worker 未配置 DEEPSEEK_API_KEY`: configure `DEEPSEEK_API_KEY` or switch story provider back to DashScope.
- `模型返回格式错误`: the model did not return JSON; retry or lower temperature.
- `Worker 未配置 Qwen 音色白名单：papa`: configure `DASHSCOPE_TTS_VOICE_PAPA` or legacy `BAILIAN_VOICE_PAPA`.
- `百炼 Qwen-TTS 合成失败`: check the API key, model permission, account balance, and whether the voice value matches Qwen-TTS VC.