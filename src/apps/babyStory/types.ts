export type StoryLength = 'short' | 'medium' | 'long';
export type StoryStyle = 'forest' | 'ocean' | 'star' | 'daily' | 'poem';
export type ReadingTone = 'soft' | 'happy' | 'sleepy';
export type VoiceKind = 'system' | 'custom';
export type VoiceProvider = 'system' | 'bailian' | 'mock';

export interface BabySettings {
  babyName: string;
  dueDate: string;
  pregnancyWeek: number;
  pregnancyDay: number;
  defaultLength: StoryLength;
  defaultStyle: StoryStyle;
  defaultVoiceId: string;
}

export interface StoryDraft {
  title: string;
  body: string;
  theme: string;
  length: StoryLength;
  style: StoryStyle;
  tone: ReadingTone;
}

export interface VoiceProfile {
  id: string;
  name: string;
  kind: VoiceKind;
  description: string;
  createdAt: string;
  provider?: VoiceProvider;
  voiceId?: string;
  voiceKey?: string;
  targetModel?: string;
  // Legacy-only fields. New Cloudflare Worker flow must not save raw samples or long-lived sample URLs.
  sampleUrl?: string;
  previewAudioUrl?: string;
  requestId?: string;
  sampleDataUrl?: string;
  sampleDuration?: number;
}

export interface AudioRecord {
  id: string;
  storyId: string;
  voiceId: string;
  voiceName: string;
  dataUrl?: string;
  audioUrl?: string;
  audioId?: string;
  provider?: VoiceProvider;
  model?: string;
  requestId?: string;
  expiresAt?: number | null;
  duration?: number;
  createdAt: string;
}

export interface StoryRecord extends StoryDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  audio?: AudioRecord;
}

export interface GenerateStoryInput {
  theme: string;
  length: StoryLength;
  style: StoryStyle;
  tone: ReadingTone;
  babyName: string;
}

export interface SynthesizeInput {
  storyId: string;
  text: string;
  voice: VoiceProfile;
  tone: ReadingTone;
  voiceConfig: VoiceRuntimeConfig;
}

export interface SynthesizeResult {
  dataUrl?: string;
  audioUrl?: string;
  audioId?: string;
  duration?: number;
  expiresAt?: number | null;
  requestId?: string;
  provider?: VoiceProvider;
  model?: string;
  voiceId?: string;
  voiceKey?: string;
}

export interface VoiceRuntimeConfig {
  workerBaseUrl: string;
  realVoiceEnabled: boolean;
  mockFallbackEnabled: boolean;
  targetModel: string;
  defaultRate: number;
  playbackRate: number;
  defaultVolume: number;
  defaultInstruction: string;
}
