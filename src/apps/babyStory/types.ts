export type StoryLength = 'short' | 'medium' | 'long';
export type StoryStyle = 'forest' | 'ocean' | 'star' | 'daily' | 'poem';
export type ReadingTone = 'soft' | 'happy' | 'sleepy';
export type VoiceKind = 'system' | 'custom';

export interface BabySettings {
  babyName: string;
  dueDate: string;
  pregnancyWeek: number;
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
  sampleDataUrl?: string;
  sampleDuration?: number;
}

export interface AudioRecord {
  id: string;
  storyId: string;
  voiceId: string;
  voiceName: string;
  dataUrl: string;
  duration: number;
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
}
