import { BabySettings, StoryRecord, VoiceProfile, VoiceRuntimeConfig } from './types';

const LEGACY_SETTINGS_KEY = 'prenatal_story_settings_v1';
const LEGACY_STORIES_KEY = 'prenatal_story_records_v1';
const LEGACY_VOICES_KEY = 'prenatal_voice_profiles_v1';
const SETTINGS_KEY = 'babyStory:settings:v1';
const STORIES_KEY = 'babyStory:stories:v1';
const VOICE_RUNTIME_KEY = 'babyStory:voiceRuntime:v1';

export const systemVoices: VoiceProfile[] = [
  {
    id: 'bailian-papa',
    name: '爸爸声音',
    kind: 'custom',
    provider: 'bailian',
    voiceKey: 'papa',
    description: '由 Cloudflare Worker 白名单映射到已授权百炼音色。',
    createdAt: 'system',
  },
  {
    id: 'bailian-mama',
    name: '妈妈声音',
    kind: 'custom',
    provider: 'bailian',
    voiceKey: 'mama',
    description: '由 Cloudflare Worker 白名单映射到已授权百炼音色。',
    createdAt: 'system',
  },
];

export const defaultSettings: BabySettings = {
  babyName: '小星星',
  dueDate: '',
  pregnancyWeek: 24,
  pregnancyDay: 0,
  defaultLength: 'short',
  defaultStyle: 'star',
  defaultVoiceId: 'bailian-papa',
};

export const defaultVoiceRuntimeConfig: VoiceRuntimeConfig = {
  workerBaseUrl: '',
  realStoryEnabled: false,
  storyFallbackEnabled: true,
  storyProvider: 'dashscope',
  storyModel: 'qwen-plus-2025-07-28',
  storyTemperature: 0.75,
  realVoiceEnabled: false,
  mockFallbackEnabled: true,
  targetModel: 'qwen3-tts-vc-2026-01-22',
  defaultRate: 1,
  playbackRate: 1,
  defaultVolume: 50,
  defaultInstruction: '请用温柔、轻声、亲切、适合胎教睡前故事的语气朗读，使用标准语速，停顿自然。',
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

export const loadSettings = () => {
  const settings = readJsonWithLegacy<BabySettings>(SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings);
  if (systemVoices.some(voice => voice.id === settings.defaultVoiceId)) return settings;
  return { ...settings, defaultVoiceId: defaultSettings.defaultVoiceId };
};

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

export const loadVoices = () => systemVoices;

export const loadVoiceRuntimeConfig = () => {
  const config = readJson<VoiceRuntimeConfig>(VOICE_RUNTIME_KEY, defaultVoiceRuntimeConfig);
  if (config.defaultRate === 0.85 && config.playbackRate === 0.85) {
    return { ...config, defaultRate: 1, playbackRate: 1 };
  }
  return config;
};

export const saveVoiceRuntimeConfig = (config: VoiceRuntimeConfig) => {
  const sanitized: VoiceRuntimeConfig = {
    ...defaultVoiceRuntimeConfig,
    ...config,
    workerBaseUrl: config.workerBaseUrl.trim().replace(/\/+$/, ''),
    realStoryEnabled: Boolean(config.realStoryEnabled),
    storyFallbackEnabled: Boolean(config.storyFallbackEnabled),
    storyProvider: config.storyProvider === 'deepseek' ? 'deepseek' : 'dashscope',
    storyModel: (config.storyModel || defaultVoiceRuntimeConfig.storyModel).trim(),
    storyTemperature: Math.min(1.2, Math.max(0.2, Number.isFinite(config.storyTemperature) ? config.storyTemperature : defaultVoiceRuntimeConfig.storyTemperature)),
    targetModel: defaultVoiceRuntimeConfig.targetModel,
    defaultRate: defaultVoiceRuntimeConfig.defaultRate,
    playbackRate: Math.min(1.25, Math.max(0.7, Number.isFinite(config.playbackRate) ? config.playbackRate : defaultVoiceRuntimeConfig.playbackRate)),
    defaultVolume: defaultVoiceRuntimeConfig.defaultVolume,
    defaultInstruction: defaultVoiceRuntimeConfig.defaultInstruction,
  };
  localStorage.setItem(VOICE_RUNTIME_KEY, JSON.stringify(sanitized));
  return sanitized;
};

export const clearBabyStoryCache = () => {
  localStorage.removeItem(STORIES_KEY);
  localStorage.removeItem(VOICE_RUNTIME_KEY);
  localStorage.removeItem(LEGACY_STORIES_KEY);
  localStorage.removeItem(LEGACY_VOICES_KEY);
};
