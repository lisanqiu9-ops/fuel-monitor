interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  httpEtag: string;
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: string, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
}

interface Env {
  DASHSCOPE_API_KEY: string;
  DEEPSEEK_API_KEY?: string;
  DASHSCOPE_STORY_MODEL?: string;
  DEEPSEEK_STORY_MODEL?: string;
  STORY_PROVIDER?: string;
  STORY_TEMPERATURE?: string;
  DASHSCOPE_TTS_MODEL?: string;
  DASHSCOPE_TTS_VOICE_PAPA?: string;
  DASHSCOPE_TTS_VOICE_MAMA?: string;
  BAILIAN_TARGET_MODEL?: string;
  BAILIAN_VOICE_PAPA?: string;
  BAILIAN_VOICE_MAMA?: string;
  BAILIAN_VOICE_MAP?: string;
  CORS_ALLOWED_ORIGIN?: string;
  REMOVE_BG_API_KEY?: string;
  BAIDU_API_KEY?: string;
  BAIDU_SECRET_KEY?: string;
  FUEL_ACCESS_KEY?: string;
  FUEL_BUCKET?: R2Bucket;
}

type JsonBody = Record<string, unknown>;
type StoryProvider = 'dashscope' | 'deepseek';

const QWEN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';
const DEFAULT_TTS_MODEL = 'qwen3-tts-vc-2026-01-22';
const DEFAULT_DASHSCOPE_STORY_MODEL = 'qwen-plus-2025-07-28';
const DEFAULT_DEEPSEEK_STORY_MODEL = 'deepseek-chat';
const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';
const FUEL_RECORDS_FILE = 'fuel-records.json';
const MAX_FUEL_JSON_BYTES = 2 * 1024 * 1024;
const MAX_OCR_IMAGE_BYTES = 8 * 1024 * 1024;

let cachedBaiduToken = '';
let cachedBaiduTokenExpiresAt = 0;

const corsHeaders = (request: Request, env: Env) => {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.CORS_ALLOWED_ORIGIN || requestOrigin || '*')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const origin = allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin) ? requestOrigin || '*' : 'null';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
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

const readProviderError = async (response: Response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as Record<string, any>;
    return String(data.error?.message || data.message || data.error || data.code || response.statusText);
  } catch {
    return text || response.statusText;
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const cleanText = (value: unknown, fallback = '') => String(value || fallback).trim();
const normalizeProvider = (value: unknown, fallback: StoryProvider): StoryProvider => String(value || fallback).toLowerCase() === 'deepseek' ? 'deepseek' : 'dashscope';

const readJsonBody = async (request: Request) => {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractJsonObject = (content: string) => {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('模型没有返回 JSON 对象');
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
};

const storyLengthLabel = (length: string) => length === 'long' ? '900-1200 字，7-9 个自然段' : length === 'medium' ? '550-800 字，5-7 个自然段' : '350-500 字，4-5 个自然段';
const storyStyleLabel = (style: string) => ({ forest: '森林微光', ocean: '海湾晚风', star: '星星月亮', daily: '日常小事', poem: '诗意梦境' }[style] || '温柔睡前');
const storyToneLabel = (tone: string) => ({ soft: '温柔、安定', happy: '轻快、明亮', sleepy: '睡前、舒缓' }[tone] || '温柔');

async function generateStory(request: Request, env: Env) {
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

  const data = await response.json() as Record<string, any>;
  const content = String(data.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    return json(request, env, { error: '模型返回为空', requestId: data.request_id || data.id || '' }, 502);
  }

  let story: Record<string, unknown>;
  try {
    story = extractJsonObject(content);
  } catch (error) {
    return json(request, env, { error: error instanceof Error ? error.message : '模型返回格式错误', raw: content.slice(0, 500) }, 502);
  }

  const title = cleanText(story.title, `${theme}的小小晚安故事`).slice(0, 60);
  const storyBody = cleanText(story.body).replace(/\r\n/g, '\n');
  if (!storyBody) return json(request, env, { error: '模型没有返回故事正文' }, 502);

  return json(request, env, {
    title,
    body: storyBody,
    provider,
    model,
    requestId: data.request_id || data.id || '',
  });
}

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

async function removeImageBackground(request: Request, env: Env) {
  if (!env.REMOVE_BG_API_KEY) {
    return json(request, env, { error: 'Worker 未配置 REMOVE_BG_API_KEY' }, 500);
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return json(request, env, { error: '请求体必须是 multipart/form-data' }, 400);
  }

  const image = body.get('image_file');
  if (!(image instanceof Blob)) {
    return json(request, env, { error: '缺少 image_file 图片文件' }, 400);
  }

  const formData = new FormData();
  formData.append('image_file', image, image instanceof File ? image.name : 'image.png');
  formData.append('size', String(body.get('size') || 'auto'));

  const response = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
    body: formData,
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    return json(request, env, { error: `remove.bg 处理失败：${message}` }, response.status);
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': response.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}

const hasFuelAccess = (request: Request, env: Env) => (
  Boolean(env.FUEL_ACCESS_KEY)
  && request.headers.get('Authorization') === `Bearer ${env.FUEL_ACCESS_KEY}`
);

const isOptionalNonNegativeNumber = (value: unknown) => (
  value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
);

const isFuelRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && Boolean(record.id.trim())
    && typeof record.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    && (record.fillType === 'full' || record.fillType === 'partial')
    && typeof record.fuelLiters === 'number'
    && Number.isFinite(record.fuelLiters)
    && record.fuelLiters > 0
    && typeof record.pricePerLiter === 'number'
    && Number.isFinite(record.pricePerLiter)
    && record.pricePerLiter > 0
    && typeof record.totalCost === 'number'
    && Number.isFinite(record.totalCost)
    && record.totalCost > 0
    && isOptionalNonNegativeNumber(record.drivenKm)
    && isOptionalNonNegativeNumber(record.actualFuelPer100)
    && isOptionalNonNegativeNumber(record.costPerKm)
    && isOptionalNonNegativeNumber(record.dashboardOdo)
    && isOptionalNonNegativeNumber(record.dashboardAvgSpeed)
    && isOptionalNonNegativeNumber(record.dashboardFuelPer100)
    && isOptionalNonNegativeNumber(record.dashboardRange);
};

const readFuelRecords = async (request: Request, env: Env) => {
  if (!hasFuelAccess(request, env)) return json(request, env, { error: '油耗访问密钥无效' }, 401);
  if (!env.FUEL_BUCKET) return json(request, env, { error: 'Worker 未绑定 FUEL_BUCKET' }, 500);

  try {
    const object = await env.FUEL_BUCKET.get(FUEL_RECORDS_FILE);
    if (!object) return json(request, env, { error: '云端油耗记录尚未创建' }, 404);
    return new Response(object.body, {
      status: 200,
      headers: {
        ...corsHeaders(request, env),
        'Content-Type': object.httpMetadata?.contentType || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ETag: object.httpEtag,
        'X-Fuel-Synced-At': object.customMetadata?.syncedAt || '',
      },
    });
  } catch (error) {
    console.error('Failed to read fuel records from R2', error);
    return json(request, env, { error: '云端油耗记录读取失败' }, 500);
  }
};

const writeFuelRecords = async (request: Request, env: Env) => {
  if (!hasFuelAccess(request, env)) return json(request, env, { error: '油耗访问密钥无效' }, 401);
  if (!env.FUEL_BUCKET) return json(request, env, { error: 'Worker 未绑定 FUEL_BUCKET' }, 500);

  let raw: string;
  try {
    raw = await request.text();
  } catch (error) {
    console.error('Failed to read fuel records request body', error);
    return json(request, env, { error: '无法读取油耗记录请求体' }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_FUEL_JSON_BYTES) {
    return json(request, env, { error: '油耗记录超过 2MB 限制' }, 413);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to parse fuel records JSON', error);
    return json(request, env, { error: '油耗记录必须是有效 JSON' }, 400);
  }

  const records = data.records;
  if (!Array.isArray(records) || records.length > 10000 || !records.every(isFuelRecord)) {
    return json(request, env, { error: '油耗记录数据结构无效' }, 400);
  }

  const syncedAt = new Date().toISOString();
  const payload = JSON.stringify({ app: 'fuel-consumption-monitor', version: 1, syncedAt, records });
  try {
    await env.FUEL_BUCKET.put(FUEL_RECORDS_FILE, payload, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { syncedAt },
    });
  } catch (error) {
    console.error('Failed to write fuel records to R2', error);
    return json(request, env, { error: '云端油耗记录写入失败' }, 500);
  }
  return json(request, env, { ok: true, count: records.length, syncedAt });
};

const getBaiduOcrToken = async (env: Env) => {
  if (cachedBaiduToken && Date.now() < cachedBaiduTokenExpiresAt) return cachedBaiduToken;
  if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) throw new Error('Worker 未配置百度 OCR 密钥');

  const response = await fetch(BAIDU_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.BAIDU_API_KEY,
      client_secret: env.BAIDU_SECRET_KEY,
    }),
  });
  const data = await response.json() as Record<string, any>;
  if (!response.ok || !data.access_token) {
    throw new Error(String(data.error_description || data.error || `百度令牌请求失败：${response.status}`));
  }

  cachedBaiduToken = String(data.access_token);
  const expiresIn = Math.max(60, Number(data.expires_in) || 2592000);
  cachedBaiduTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
  return cachedBaiduToken;
};

const recognizeFuelImage = async (request: Request, env: Env) => {
  if (!hasFuelAccess(request, env)) return json(request, env, { error: '油耗访问密钥无效' }, 401);
  if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) {
    return json(request, env, { error: 'Worker 未配置 BAIDU_API_KEY 或 BAIDU_SECRET_KEY' }, 500);
  }

  const body = await readJsonBody(request);
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image) return json(request, env, { error: '缺少 OCR 图片数据' }, 400);
  if (new TextEncoder().encode(image).byteLength > MAX_OCR_IMAGE_BYTES) {
    return json(request, env, { error: 'OCR 图片超过 8MB 限制' }, 413);
  }

  try {
    const token = await getBaiduOcrToken(env);
    const response = await fetch(BAIDU_OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: token,
        image,
        language_type: 'CHN_ENG',
        detect_direction: 'true',
      }),
    });
    const data = await response.json() as JsonBody;
    if (!response.ok) {
      console.error('Baidu OCR request failed', response.status, data);
      return json(request, env, { error: `百度 OCR 请求失败：${response.status}` }, response.status);
    }
    return json(request, env, data);
  } catch (error) {
    console.error('Fuel OCR failed', error);
    return json(request, env, { error: error instanceof Error ? error.message : 'OCR 服务异常' }, 500);
  }
};

async function synthesize(request: Request, env: Env) {
  if (!env.DASHSCOPE_API_KEY) {
    return json(request, env, { error: 'Worker 未配置百炼 API Key' }, 500);
  }

  const body = await readJsonBody(request);
  if (!body) return json(request, env, { error: '请求体必须是 JSON' }, 400);

  const text = String(body.text || '').trim();
  const voiceKey = String(body.voiceKey || 'papa').trim();
  const voice = readVoiceMap(env)[voiceKey];
  const model = String(env.DASHSCOPE_TTS_MODEL || env.BAILIAN_TARGET_MODEL || DEFAULT_TTS_MODEL).trim();

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
    const message = await readProviderError(dashResponse);
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
      return json(request, env, { ok: true, service: 'sanqiu-toolbox-api', story: 'chat-completions', tts: 'qwen-tts-vc', image: 'remove.bg', fuel: 'r2+baidu-ocr' });
    }

    if (request.method === 'POST' && url.pathname === '/api/story/generate') {
      return generateStory(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/tts/synthesize') {
      return synthesize(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/image/remove-bg') {
      return removeImageBackground(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/fuel/records') {
      return readFuelRecords(request, env);
    }

    if (request.method === 'PUT' && url.pathname === '/api/fuel/records') {
      return writeFuelRecords(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/fuel/ocr') {
      return recognizeFuelImage(request, env);
    }

    return json(request, env, { error: 'Not found' }, 404);
  },
};
