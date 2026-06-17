import { BabySettings, StoryRecord, VoiceProfile, VoiceRuntimeConfig } from './types';

const LEGACY_SETTINGS_KEY = 'prenatal_story_settings_v1';
const LEGACY_STORIES_KEY = 'prenatal_story_records_v1';
const LEGACY_VOICES_KEY = 'prenatal_voice_profiles_v1';
const SETTINGS_KEY = 'babyStory:settings:v1';
const STORIES_KEY = 'babyStory:stories:v1';
const VOICES_KEY = 'babyStory:voices:v1';
const VOICE_RUNTIME_KEY = 'babyStory:voiceRuntime:v1';

export const systemVoices: VoiceProfile[] = [
  {
    id: 'bailian-papa',
    name: '爸爸声音',
    kind: 'custom',
    provider: 'bailian',
    voiceKey: 'papa',
    description: '由 Worker 白名单映射到已授权百炼音色。',
    createdAt: 'system',
  },
  {
    id: 'bailian-mama',
    name: '妈妈声音',
    kind: 'custom',
    provider: 'bailian',
    voiceKey: 'mama',
    description: '由 Worker 白名单映射到已授权百炼音色。',
    createdAt: 'system',
  },
  {
    id: 'system-mama-soft',
    name: '妈妈的轻声',
    kind: 'system',
    provider: 'system',
    description: '本地 mock 音色，柔和、慢速，适合睡前小故事。',
    createdAt: 'system',
  },
  {
    id: 'system-papa-warm',
    name: '爸爸的暖声',
    kind: 'system',
    provider: 'system',
    description: '本地 mock 音色，温暖、稳定。',
    createdAt: 'system',
  },
  {
    id: 'system-moon',
    name: '月光旁白',
    kind: 'system',
    provider: 'system',
    description: '本地 mock 音色，轻盈、舒缓。',
    createdAt: 'system',
  },
];

export const defaultSettings: BabySettings = {
  babyName: '小星星',
  dueDate: '',
  pregnancyWeek: 24,
  defaultLength: 'short',
  defaultStyle: 'star',
  defaultVoiceId: 'bailian-papa',
};

export const defaultVoiceRuntimeConfig: VoiceRuntimeConfig = {
  workerBaseUrl: '',
  realVoiceEnabled: false,
  mockFallbackEnabled: true,
  targetModel: 'qwen3-tts-vc-2026-01-22',
  defaultRate: 0.85,
  defaultVolume: 50,
  defaultInstruction: '请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，语速稍慢，停顿自然。',
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};

const readJsonWithLegacy = <T,>(key: string, legacyKey: string, fallback: T): T => {
  const current = readJson<T>(key, fallback);
  if (current !== fallback) return current;
  return readJson<T>(legacyKey, fallback);
};

const readArray = <T,>(key: string, legacyKey?: string): T[] => {
  try {
    const raw = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const loadSettings = () => readJsonWithLegacy<BabySettings>(SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings);

export const saveSettings = (settings: BabySettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
};

export const loadStories = () =>
  readArray<StoryRecord>(STORIES_KEY, LEGACY_STORIES_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const saveStories = (stories: StoryRecord[]) => {
  const sorted = [...stories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  localStorage.setItem(STORIES_KEY, JSON.stringify(sorted));
  return sorted;
};

export const loadCustomVoices = () => readArray<VoiceProfile>(VOICES_KEY, LEGACY_VOICES_KEY);

export const loadVoices = () => {
  const customVoices = loadCustomVoices().filter(voice => voice.voiceKey || voice.provider !== 'bailian');
  return [...systemVoices, ...customVoices];
};

export const saveCustomVoices = (voices: VoiceProfile[]) => {
  const sanitized = voices
    .filter(voice => voice.kind === 'custom' && !voice.id.startsWith('bailian-'))
    .map(({ voiceId: _voiceId, sampleUrl: _sampleUrl, sampleDataUrl: _sampleDataUrl, previewAudioUrl: _previewAudioUrl, requestId: _requestId, sampleDuration: _sampleDuration, ...voice }) => voice);
  localStorage.setItem(VOICES_KEY, JSON.stringify(sanitized));
  return loadVoices();
};

export const loadVoiceRuntimeConfig = () =>
  readJson<VoiceRuntimeConfig>(VOICE_RUNTIME_KEY, defaultVoiceRuntimeConfig);

export const saveVoiceRuntimeConfig = (config: VoiceRuntimeConfig) => {
  const sanitized: VoiceRuntimeConfig = {
    ...defaultVoiceRuntimeConfig,
    ...config,
    workerBaseUrl: config.workerBaseUrl.trim().replace(/\/+$/, ''),
    targetModel: config.targetModel || defaultVoiceRuntimeConfig.targetModel,
  };
  localStorage.setItem(VOICE_RUNTIME_KEY, JSON.stringify(sanitized));
  return sanitized;
};

export const clearBabyStoryCache = () => {
  localStorage.removeItem(STORIES_KEY);
  localStorage.removeItem(VOICES_KEY);
  localStorage.removeItem(VOICE_RUNTIME_KEY);
  localStorage.removeItem(LEGACY_STORIES_KEY);
  localStorage.removeItem(LEGACY_VOICES_KEY);
};
