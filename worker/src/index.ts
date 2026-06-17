interface Env {
  DASHSCOPE_API_KEY: string;
  BAILIAN_TARGET_MODEL?: string;
  CORS_ALLOWED_ORIGIN?: string;
  BAILIAN_VOICE_PAPA?: string;
  BAILIAN_VOICE_MAMA?: string;
  BAILIAN_VOICE_MAP?: string;
}

type JsonBody = Record<string, unknown>;

const DASH_SCOPE_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';
const DEFAULT_MODEL = 'cosyvoice-v3.5-flash';
const DEFAULT_INSTRUCTION = '请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，语速稍慢，停顿自然。';

const corsHeaders = (request: Request, env: Env) => {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = env.CORS_ALLOWED_ORIGIN || requestOrigin || '*';
  const origin = allowedOrigin === '*' || allowedOrigin === requestOrigin ? allowedOrigin : 'null';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const json = (request: Request, env: Env, data: JsonBody, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

const readDashScopeError = async (response: Response) => {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return String(data.message || data.error || data.code || response.statusText);
  } catch {
    return text || response.statusText;
  }
};

const readVoiceMap = (env: Env) => {
  const map: Record<string, string> = {};
  if (env.BAILIAN_VOICE_PAPA) map.papa = env.BAILIAN_VOICE_PAPA;
  if (env.BAILIAN_VOICE_MAMA) map.mama = env.BAILIAN_VOICE_MAMA;

  if (env.BAILIAN_VOICE_MAP) {
    try {
      const parsed = JSON.parse(env.BAILIAN_VOICE_MAP) as Record<string, unknown>;
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) map[key] = value.trim();
      });
    } catch {
      // Ignore malformed optional map and rely on explicit variables.
    }
  }

  return map;
};

async function synthesize(request: Request, env: Env) {
  if (!env.DASHSCOPE_API_KEY) {
    return json(request, env, { error: 'Worker 未配置百炼 API Key' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, env, { error: '请求体必须是 JSON' }, 400);
  }

  const text = String(body.text || '').trim();
  const voiceKey = String(body.voiceKey || '').trim();
  const voiceId = readVoiceMap(env)[voiceKey];
  const targetModel = String(body.targetModel || env.BAILIAN_TARGET_MODEL || DEFAULT_MODEL).trim();
  const format = String(body.format || 'mp3');
  const instruction = String(body.instruction || DEFAULT_INSTRUCTION);
  const rate = typeof body.rate === 'number' ? body.rate : 0.85;
  const pitch = typeof body.pitch === 'number' ? body.pitch : 1.0;
  const volume = typeof body.volume === 'number' ? body.volume : 50;

  if (!text) return json(request, env, { error: '缺少朗读文本' }, 400);
  if (!voiceKey) return json(request, env, { error: '缺少 voiceKey' }, 400);
  if (!voiceId) return json(request, env, { error: `Worker 未配置音色白名单：${voiceKey}` }, 400);

  const dashResponse = await fetch(DASH_SCOPE_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      input: {
        text,
        voice: voiceId,
        format,
        sample_rate: 24000,
        rate,
        pitch,
        volume,
        instruction,
      },
    }),
  });

  if (!dashResponse.ok) {
    return json(request, env, { error: `百炼语音合成失败：${await readDashScopeError(dashResponse)}` }, dashResponse.status);
  }

  const data = await dashResponse.json() as Record<string, any>;
  const audioUrl = data.output?.audio?.url || data.output?.url || data.audio_url;
  if (!audioUrl) {
    return json(request, env, { error: '百炼返回中没有 output.audio.url' }, 502);
  }

  return json(request, env, {
    audioUrl,
    audioId: data.output?.audio?.id || data.output?.audio_id || '',
    expiresAt: data.output?.audio?.expires_at || data.output?.expires_at || null,
    requestId: data.request_id || data.requestId || '',
    provider: 'bailian',
    model: targetModel,
    voiceKey,
  });
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, env, { ok: true, service: 'baby-story-tts-worker' });
    }

    if (request.method === 'POST' && url.pathname === '/api/tts/synthesize') {
      return synthesize(request, env);
    }

    return json(request, env, { error: 'Not found' }, 404);
  },
};
