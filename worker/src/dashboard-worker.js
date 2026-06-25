const QWEN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_TTS_MODEL = 'qwen3-tts-vc-2026-01-22';
const DEFAULT_DASHSCOPE_STORY_MODEL = 'qwen-plus-2025-07-28';
const DEFAULT_DEEPSEEK_STORY_MODEL = 'deepseek-chat';

function corsHeaders(request, env) {
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
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function readProviderError(response) {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    return String(data.error?.message || data.message || data.error || data.code || response.statusText);
  } catch {
    return text || response.statusText;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function cleanText(value, fallback = '') {
  return String(value || fallback).trim();
}

function normalizeProvider(value, fallback) {
  return String(value || fallback).toLowerCase() === 'deepseek' ? 'deepseek' : 'dashscope';
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function extractJsonObject(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('模型没有返回 JSON 对象');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function storyLengthLabel(length) {
  if (length === 'long') return '900-1200 字，7-9 个自然段';
  if (length === 'medium') return '550-800 字，5-7 个自然段';
  return '350-500 字，4-5 个自然段';
}

function storyStyleLabel(style) {
  return ({ forest: '森林微光', ocean: '海湾晚风', star: '星星月亮', daily: '日常小事', poem: '诗意梦境' }[style] || '温柔睡前');
}

function storyToneLabel(tone) {
  return ({ soft: '温柔、安定', happy: '轻快、明亮', sleepy: '睡前、舒缓' }[tone] || '温柔');
}

async function generateStory(request, env) {
  const body = await readJsonBody(request);
  if (!body) return json(request, env, { error: '请求体必须是 JSON' }, 400);

  const provider = normalizeProvider(body.provider, normalizeProvider(env.STORY_PROVIDER, 'dashscope'));
  const apiKey = provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return json(request, env, { error: provider === 'deepseek' ? 'Worker 未配置 DEEPSEEK_API_KEY' : 'Worker 未配置 DASHSCOPE_API_KEY' }, 500);
  }

  const theme = cleanText(body.theme, '今晚的小冒险').slice(0, 80);
  const babyName = cleanText(body.babyName, '宝宝').slice(0, 20);
  const length = cleanText(body.length, 'short');
  const style = cleanText(body.style, 'star');
  const tone = cleanText(body.tone, 'soft');
  const requestedModel = cleanText(body.model);
  const model = requestedModel || (provider === 'deepseek' ? env.DEEPSEEK_STORY_MODEL || DEFAULT_DEEPSEEK_STORY_MODEL : env.DASHSCOPE_STORY_MODEL || DEFAULT_DASHSCOPE_STORY_MODEL);
  const temperature = clamp(Number(body.temperature ?? env.STORY_TEMPERATURE ?? 0.75), 0.2, 1.2);

  const systemPrompt = [
    '你是一位中文睡前故事作者，专门为孕期家庭创作胎教故事。',
    '请写成一个完整连续的故事，不要写成若干个互不相关的小片段。',
    '必须有清晰的开端、发展、小困难、解决、回到安稳晚安的结尾。',
    '语言柔软、具体、有画面感，适合爸爸妈妈轻声朗读。',
    '不要恐怖、危险、强冲突、说教、医疗建议或成人化表达。',
    '只返回 JSON：{"title":"...","body":"..."}。body 使用自然段，段落之间用两个换行。',
  ].join('\n');
  const userPrompt = [
    `宝宝昵称：${babyName}`,
    `故事主题：${theme}`,
    `长度：${storyLengthLabel(length)}`,
    `风格：${storyStyleLabel(style)}`,
    `朗读语气：${storyToneLabel(tone)}`,
    '请让角色目标前后一致，情节自然推进，结尾落到安心睡觉。',
  ].join('\n');

  const response = await fetch(provider === 'deepseek' ? DEEPSEEK_CHAT_URL : DASHSCOPE_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    return json(request, env, { error: `${provider === 'deepseek' ? 'DeepSeek' : '百炼千问'}生成失败：${message}` }, response.status);
  }

  const data = await response.json();
  const content = String(data.choices?.[0]?.message?.content || '').trim();
  if (!content) return json(request, env, { error: '模型返回为空', requestId: data.request_id || data.id || '' }, 502);

  let story;
  try {
    story = extractJsonObject(content);
  } catch (error) {
    return json(request, env, { error: error instanceof Error ? error.message : '模型返回格式错误', raw: content.slice(0, 500) }, 502);
  }

  const title = cleanText(story.title, `${theme}的小小晚安故事`).slice(0, 60);
  const storyBody = cleanText(story.body).replace(/\r\n/g, '\n');
  if (!storyBody) return json(request, env, { error: '模型没有返回故事正文' }, 502);

  return json(request, env, { title, body: storyBody, provider, model, requestId: data.request_id || data.id || '' });
}

function readVoiceMap(env) {
  const map = {};

  if (env.DASHSCOPE_TTS_VOICE_PAPA) map.papa = env.DASHSCOPE_TTS_VOICE_PAPA.trim();
  else if (env.BAILIAN_VOICE_PAPA) map.papa = env.BAILIAN_VOICE_PAPA.trim();

  if (env.DASHSCOPE_TTS_VOICE_MAMA) map.mama = env.DASHSCOPE_TTS_VOICE_MAMA.trim();
  else if (env.BAILIAN_VOICE_MAMA) map.mama = env.BAILIAN_VOICE_MAMA.trim();

  if (env.BAILIAN_VOICE_MAP) {
    try {
      const parsed = JSON.parse(env.BAILIAN_VOICE_MAP);
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) map[key] = value.trim();
      });
    } catch {
      // Optional map only. Ignore invalid JSON and rely on explicit variables.
    }
  }

  return map;
}

async function synthesize(request, env) {
  if (!env.DASHSCOPE_API_KEY) return json(request, env, { error: 'Worker 未配置百炼 API Key' }, 500);

  const body = await readJsonBody(request);
  if (!body) return json(request, env, { error: '请求体必须是 JSON' }, 400);

  const text = String(body.text || '').trim();
  const voiceKey = String(body.voiceKey || 'papa').trim();
  const voice = readVoiceMap(env)[voiceKey];
  const model = String(env.DASHSCOPE_TTS_MODEL || env.BAILIAN_TARGET_MODEL || DEFAULT_TTS_MODEL).trim();

  if (!text) return json(request, env, { error: '缺少朗读文本' }, 400);
  if (!voice) return json(request, env, { error: `Worker 未配置 Qwen 音色白名单：${voiceKey}` }, 400);

  const dashResponse = await fetch(QWEN_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: { text, voice, language_type: 'Chinese' } }),
  });

  if (!dashResponse.ok) {
    const message = await readProviderError(dashResponse);
    return json(request, env, { error: `百炼 Qwen-TTS 合成失败：${message}` }, dashResponse.status);
  }

  const data = await dashResponse.json();
  const audioUrl = data.output?.audio?.url || data.output?.url || data.audio_url;

  if (!audioUrl) {
    return json(request, env, {
      error: '百炼返回中没有 output.audio.url',
      requestId: data.request_id || data.requestId || '',
      code: data.code || '',
      message: data.message || '',
    }, 502);
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
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, env, { ok: true, service: 'baby-story-worker', story: 'chat-completions', tts: 'qwen-tts-vc' });
    }

    if (request.method === 'POST' && url.pathname === '/api/story/generate') return generateStory(request, env);
    if (request.method === 'POST' && url.pathname === '/api/tts/synthesize') return synthesize(request, env);

    return json(request, env, { error: 'Not found' }, 404);
  },
};