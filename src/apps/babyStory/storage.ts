import { BabySettings, StoryRecord, VoiceProfile } from './types';

const LEGACY_SETTINGS_KEY = 'prenatal_story_settings_v1';
const LEGACY_STORIES_KEY = 'prenatal_story_records_v1';
const LEGACY_VOICES_KEY = 'prenatal_voice_profiles_v1';
const SETTINGS_KEY = 'babyStory:settings:v1';
const STORIES_KEY = 'babyStory:stories:v1';
const VOICES_KEY = 'babyStory:voices:v1';

export const systemVoices: VoiceProfile[] = [
  {
    id: 'system-mama-soft',
    name: '妈妈的轻声',
    kind: 'system',
    description: '柔和、慢速，适合睡前小故事。',
    createdAt: 'system',
  },
  {
    id: 'system-papa-warm',
    name: '爸爸的暖声',
    kind: 'system',
    description: '温暖、稳定，像靠近肚子的低声朗读。',
    createdAt: 'system',
  },
  {
    id: 'system-moon',
    name: '月光旁白',
    kind: 'system',
    description: '轻盈、舒缓，适合安静的夜晚。',
    createdAt: 'system',
  },
];

export const defaultSettings: BabySettings = {
  babyName: '小星星',
  dueDate: '',
  pregnancyWeek: 24,
  defaultLength: 'short',
  defaultStyle: 'star',
  defaultVoiceId: 'system-mama-soft',
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

export const loadVoices = () => [...systemVoices, ...loadCustomVoices()];

export const saveCustomVoices = (voices: VoiceProfile[]) => {
  localStorage.setItem(VOICES_KEY, JSON.stringify(voices.filter(voice => voice.kind === 'custom')));
  return loadVoices();
};

export const clearBabyStoryCache = () => {
  localStorage.removeItem(STORIES_KEY);
  localStorage.removeItem(VOICES_KEY);
  localStorage.removeItem(LEGACY_STORIES_KEY);
  localStorage.removeItem(LEGACY_VOICES_KEY);
};
