import { GenerateStoryInput, SynthesizeInput, SynthesizeResult, StoryDraft } from './types';

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const styleScene = {
  forest: ['晨雾里的小森林', '银杏叶轻轻摇动', '一只会发光的小蘑菇'],
  ocean: ['安静的海湾', '贝壳收藏着月光', '小浪花慢慢唱歌'],
  star: ['窗边的星星', '月亮的小邮局', '云朵铺好的小路'],
  daily: ['家里的柔软毯子', '厨房飘来的米香', '阳台上的小风铃'],
  poem: ['一封写给春天的信', '花瓣里的小梦', '晚风经过的小院'],
} as const;

const lengthParagraphs = { short: 4, medium: 7, long: 10 };
const toneWords = { soft: '轻轻地', happy: '微笑着', sleepy: '慢慢地' };

export async function generateStory(input: GenerateStoryInput): Promise<StoryDraft> {
  await wait(650);
  const scenes = styleScene[input.style];
  const paragraphs = Array.from({ length: lengthParagraphs[input.length] }, (_, index) => {
    const scene = scenes[index % scenes.length];
    const tone = toneWords[input.tone];
    const babyLine = index % 2 === 0
      ? `${input.babyName}在妈妈的怀抱里听见了这份温柔。`
      : `${input.babyName}可以安心地做一个甜甜的小梦。`;
    return `${scene}里，有一个关于“${input.theme}”的小秘密。小风${tone}走过窗台，把一朵暖暖的光送到家里。爸爸妈妈把声音放得很低，像把云朵叠成小被子。${babyLine}`;
  });

  return {
    title: `${input.theme}的小小晚安信`,
    body: paragraphs.join('\n\n'),
    theme: input.theme,
    length: input.length,
    style: input.style,
    tone: input.tone,
  };
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
  throw new Error('当前未启用 mock 兜底。请配置 Worker 或打开 mock 兜底。');
}
