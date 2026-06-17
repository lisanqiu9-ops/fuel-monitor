interface Env {
  DASHSCOPE_API_KEY: string;
  DASHSCOPE_TTS_MODEL?: string;
  DASHSCOPE_TTS_VOICE_PAPA?: string;
  DASHSCOPE_TTS_VOICE_MAMA?: string;
  BAILIAN_TARGET_MODEL?: string;
  BAILIAN_VOICE_PAPA?: string;
  BAILIAN_VOICE_MAMA?: string;
  BAILIAN_VOICE_MAP?: string;
  CORS_ALLOWED_ORIGIN?: string;
}

type JsonBody = Record<string, unknown>;

const QWEN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DEFAULT_MODEL = 'qwen3-tts-vc-2026-01-22';

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

  if (env.DASHSCOPE_TTS_VOICE_PAPA) {
    map.papa = env.DASHSCOPE_TTS_VOICE_PAPA.trim();
  } else if (env.BAILIAN_VOICE_PAPA) {
    map.papa = env.BAILIAN_VOICE_PAPA.trim();
  }

  if (env.DASHSCOPE_TTS_VOICE_MAMA) {
    map.mama = env.DASHSCOPE_TTS_VOICE_MAMA.trim();
  } else if (env.BAILIAN_VOICE_MAMA) {
    map.mama = env.BAILIAN_VOICE_MAMA.trim();
  }

  if (env.BAILIAN_VOICE_MAP) {
    try {
      const parsed = JSON.parse(env.BAILIAN_VOICE_MAP) as Record<string, unknown>;
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          map[key] = value.trim();
        }
      });
    } catch {
      // Optional map only. Ignore invalid JSON and rely on explicit variables.
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
  const voiceKey = String(body.voiceKey || 'papa').trim();
  const voice = readVoiceMap(env)[voiceKey];
  const model = String(env.DASHSCOPE_TTS_MODEL || env.BAILIAN_TARGET_MODEL || DEFAULT_MODEL).trim();

  if (!text) {
    return json(request, env, { error: '缺少朗读文本' }, 400);
  }

  if (!voice) {
    return json(request, env, { error: `Worker 未配置 Qwen 音色白名单：${voiceKey}` }, 400);
  }

  const dashResponse = await fetch(QWEN_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        text,
        voice,
        language_type: 'Chinese',
      },
    }),
  });

  if (!dashResponse.ok) {
    const message = await readDashScopeError(dashResponse);
    return json(request, env, { error: `百炼 Qwen-TTS 合成失败：${message}` }, dashResponse.status);
  }

  const data = await dashResponse.json() as Record<string, any>;
  const audioUrl = data.output?.audio?.url || data.output?.url || data.audio_url;

  if (!audioUrl) {
    return json(
      request,
      env,
      {
        error: '百炼返回中没有 output.audio.url',
        requestId: data.request_id || data.requestId || '',
        code: data.code || '',
        message: data.message || '',
      },
      502,
    );
  }

  return json(request, env, {
    audioUrl,
    audioId: data.output?.audio?.id || '',
    expiresAt: data.output?.audio?.expires_at || null,
    requestId: data.request_id || data.requestId || '',
    provider: 'bailian',
    model,
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
      return json(request, env, { ok: true, service: 'baby-story-tts-worker', tts: 'qwen-tts-vc' });
    }

    if (request.method === 'POST' && url.pathname === '/api/tts/synthesize') {
      return synthesize(request, env);
    }

    return json(request, env, { error: 'Not found' }, 404);
  },
};
