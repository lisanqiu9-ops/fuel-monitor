import { GenerateStoryInput, SynthesizeInput, SynthesizeResult, StoryDraft, StoryGenerationConfig } from './types';

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const storyWorlds = {
  forest: { place: '晨雾里的小森林', path: '铺满银杏叶的小路', helper: '会发光的小蘑菇', treasure: '一滴亮晶晶的露珠' },
  ocean: { place: '安静的海湾', path: '贝壳排成的小路', helper: '慢慢唱歌的小浪花', treasure: '一枚装着月光的贝壳' },
  star: { place: '窗边的星星邮局', path: '云朵铺好的小路', helper: '提着小灯的月亮邮差', treasure: '一封闪闪发亮的晚安信' },
  daily: { place: '家里的柔软毯子边', path: '从厨房米香到阳台风铃的小路', helper: '会叮当回应的小风铃', treasure: '一颗暖暖的小纽扣' },
  poem: { place: '晚风经过的小院', path: '花瓣和月光排成的小路', helper: '捧着春天来信的小花瓣', treasure: '一个轻轻发亮的小梦' },
} as const;

const toneWords = {
  soft: { move: '轻轻地', mood: '温柔地', close: '像一条柔软的小毯子' },
  happy: { move: '微笑着', mood: '高高兴兴地', close: '像一串小小的笑声' },
  sleepy: { move: '慢慢地', mood: '安安静静地', close: '像一朵快睡着的云' },
};

const normalizeTheme = (theme: string) => theme.trim() || '今晚的小冒险';
const heroFromTheme = (theme: string, babyName: string) => {
  const cleaned = normalizeTheme(theme).replace(/[《》“”"]/g, '');
  const match = cleaned.match(/^(.{1,6}?)(历险记|冒险记|奇遇记|的)/);
  return match?.[1] || babyName || '小星星';
};

const normalizeStoryDraft = (input: GenerateStoryInput, data: Record<string, unknown>): StoryDraft => {
  const theme = normalizeTheme(input.theme);
  const title = String(data.title || `${theme}的小小晚安故事`).trim();
  const body = String(data.body || '').replace(/\r\n/g, '\n').trim();

  if (!body) throw new Error('大模型没有返回故事正文');

  return {
    title: title || `${theme}的小小晚安故事`,
    body,
    theme,
    length: input.length,
    style: input.style,
    tone: input.tone,
  };
};

async function generateMockStory(input: GenerateStoryInput): Promise<StoryDraft> {
  await wait(650);
  const theme = normalizeTheme(input.theme);
  const hero = heroFromTheme(theme, input.babyName);
  const world = storyWorlds[input.style];
  const tone = toneWords[input.tone];
  const arc = [
    `今晚，爸爸妈妈把声音放得很低，给${input.babyName}讲《${theme}》。故事一开始，${hero}在${world.place}发现了${world.treasure}，它正一闪一闪，好像在说：“请把晚安送到远方。”`,
    `${hero}${tone.move}把${world.treasure}放进口袋，沿着${world.path}往前走。路上没有可怕的东西，只有暖暖的灯光、软软的风，还有一步一步变勇敢的小脚印。`,
    `走到半路，${world.helper}拦住了${hero}。它说，前面有一扇很小很小的门，只有说出一句温柔的话，门才会打开。${hero}想了想，${tone.mood}说：“今天辛苦啦，明天也会很好。”`,
    `小门打开了，里面不是陌生的地方，而是一间亮着小夜灯的屋子。屋子里有一张空空的小床，正在等一份晚安。${hero}把${world.treasure}放到枕边，整间屋子都变得暖和起来。`,
    `这时，${world.helper}告诉${hero}，真正的历险不是跑得很远，而是把心里的温柔带给需要它的人。${hero}点点头，又把一小束光收进口袋，准备带回家。`,
    `回去的路上，风变得更轻了，灯也变得更柔了。${hero}听见远处有人在哼晚安歌，那声音${tone.close}，把白天的小忙碌都慢慢盖好。`,
    `终于，${hero}回到故事开始的地方，把最后一束光放在窗边。窗外的星星眨了眨眼，好像在谢谢${hero}完成了这次小小的历险。`,
    `爸爸妈妈讲到这里，也把声音放得更轻。${input.babyName}在这份温柔里听见了勇敢、善良和晚安。故事合上了，小梦打开了，今晚可以安心睡着啦。`,
  ];
  const paragraphsByLength = {
    short: [arc[0], arc[1], arc[2], arc[7]],
    medium: [arc[0], arc[1], arc[2], arc[3], arc[5], arc[7]],
    long: arc,
  };
  const paragraphs = paragraphsByLength[input.length];

  return {
    title: `${theme}的小小晚安信`,
    body: paragraphs.join('\n\n'),
    theme,
    length: input.length,
    style: input.style,
    tone: input.tone,
  };
}

export async function generateStory(input: GenerateStoryInput, config?: StoryGenerationConfig): Promise<StoryDraft> {
  if (config?.realStoryEnabled && !config.workerBaseUrl) {
    throw new Error('已启用大模型生成故事，请先在设置页填写 Worker Base URL');
  }

  const shouldUseWorker = Boolean(config?.realStoryEnabled && config.workerBaseUrl);

  if (shouldUseWorker && config) {
    try {
      const response = await fetch(joinWorkerUrl(config.workerBaseUrl, '/api/story/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json() as Record<string, unknown>;
      return normalizeStoryDraft(input, data);
    } catch (error) {
      if (config.storyFallbackEnabled) return generateMockStory(input);
      throw error;
    }
  }

  return generateMockStory(input);
}

const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  samples.forEach(sample => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  });
  return new Blob([view], { type: 'audio/wav' });
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('音频转换失败'));
    reader.readAsDataURL(blob);
  });

const mockSynthesizeSpeech = async (input: SynthesizeInput): Promise<SynthesizeResult> => {
  await wait(500);
  const sampleRate = 22050;
  const duration = Math.min(48, Math.max(12, Math.round(input.text.length / 32)));
  const samples = new Float32Array(sampleRate * duration);
  const base = input.voice.id.includes('papa') ? 174 : input.voice.kind === 'custom' ? 210 : 246;
  const toneBump = input.tone === 'happy' ? 32 : input.tone === 'sleepy' ? -24 : 0;

  for (let i = 0; i < samples.length; i += 1) {
    const t = i / sampleRate;
    const phrase = Math.floor(t / 1.4);
    const envelope = Math.sin(Math.PI * ((t % 1.4) / 1.4));
    const freq = base + toneBump + (phrase % 5) * 12;
    samples[i] = (Math.sin(2 * Math.PI * freq * t) * 0.18 + Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.06) * envelope;
  }

  return {
    dataUrl: await blobToDataUrl(encodeWav(samples, sampleRate)),
    duration,
    provider: 'mock',
    voiceKey: input.voice.voiceKey || input.voice.id,
  };
};

const readApiError = async (response: Response) => {
  try {
    const data = await response.json();
    return data.error || data.message || JSON.stringify(data);
  } catch {
    return response.statusText;
  }
};

const joinWorkerUrl = (baseUrl: string, pathname: string) => {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  if (!normalizedBase) throw new Error('请先在设置页配置 Cloudflare Worker Base URL');
  return `${normalizedBase}${pathname}`;
};

export async function synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeResult> {
  const shouldUseWorker = input.voiceConfig.realVoiceEnabled && input.voice.provider === 'bailian' && input.voice.voiceKey;

  if (shouldUseWorker) {
    try {
      const response = await fetch(joinWorkerUrl(input.voiceConfig.workerBaseUrl, '/api/tts/synthesize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input.text,
          voiceKey: input.voice.voiceKey,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json();
    } catch (error) {
      if (input.voiceConfig.mockFallbackEnabled) return mockSynthesizeSpeech(input);
      throw error;
    }
  }

  if (input.voiceConfig.mockFallbackEnabled) return mockSynthesizeSpeech(input);
  throw new Error('当前未启用本地兜底。请配置 Worker 或打开本地兜底。');
}
