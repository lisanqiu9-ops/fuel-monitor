# Baby Story TTS Cloudflare Worker

This Worker is the server-side proxy for the prenatal story assistant. The frontend only sends a safe `voiceKey`, such as `papa` or `mama`. Real DashScope API keys and Qwen voice values stay in Cloudflare Worker variables/secrets and never enter frontend code, localStorage, IndexedDB, or the GitHub Pages build.

The current production path uses Qwen-TTS voice-clone synthesis. It does not upload samples, create voices, or clone voices from the frontend.

## Cloudflare Variables

Configure these in Cloudflare Dashboard -> Worker -> Settings -> Variables and Secrets.

Plaintext variables:

- `DASHSCOPE_TTS_MODEL`: `qwen3-tts-vc-2026-01-22`
- `CORS_ALLOWED_ORIGIN`: `https://lisanqiu9-ops.github.io`

Secrets:

- `DASHSCOPE_API_KEY`: DashScope/Bailian API key.
- `DASHSCOPE_TTS_VOICE_PAPA`: Authorized Qwen voice value for the "papa" voice.
- `DASHSCOPE_TTS_VOICE_MAMA`: Authorized Qwen voice value for the "mama" voice.

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
  "service": "baby-story-tts-worker",
  "tts": "qwen-tts-vc"
}
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

## Manual Test

```bash
curl -X POST "https://your-worker.example.workers.dev/api/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "宝宝，晚上好，今天爸爸给你讲一个小星星的故事。",
    "voiceKey": "papa"
  }'
```

Common errors:

- `Worker 未配置百炼 API Key`: configure `DASHSCOPE_API_KEY`.
- `Worker 未配置 Qwen 音色白名单：papa`: configure `DASHSCOPE_TTS_VOICE_PAPA` or legacy `BAILIAN_VOICE_PAPA`.
- `百炼 Qwen-TTS 合成失败`: check the API key, model permission, account balance, and whether the voice value matches Qwen-TTS VC.
