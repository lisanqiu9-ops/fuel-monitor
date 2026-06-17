import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Heart,
  Home,
  Loader2,
  PackageOpen,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { generateStory, synthesizeSpeech } from './api';
import {
  clearBabyStoryCache,
  defaultSettings,
  defaultVoiceRuntimeConfig,
  loadSettings,
  loadStories,
  loadVoiceRuntimeConfig,
  loadVoices,
  saveSettings,
  saveStories,
  saveVoiceRuntimeConfig,
  systemVoices,
} from './storage';
import {
  AudioRecord,
  BabySettings,
  ReadingTone,
  StoryDraft,
  StoryLength,
  StoryRecord,
  StoryStyle,
  VoiceProfile,
  VoiceRuntimeConfig,
} from './types';
import { cn } from '../../lib/utils';

type TabId = 'home' | 'generate' | 'player' | 'history' | 'settings';
type LoadState = 'idle' | 'loading' | 'error';

interface BabyStoryAppProps {
  onBackToToolbox?: () => void;
}

const lengthLabels: Record<StoryLength, string> = { short: '短篇', medium: '中篇', long: '长篇' };
const styleLabels: Record<StoryStyle, string> = {
  forest: '森林微光',
  ocean: '海湾晚风',
  star: '星星月亮',
  daily: '日常小事',
  poem: '诗意梦境',
};
const toneLabels: Record<ReadingTone, string> = { soft: '温柔', happy: '轻快', sleepy: '睡前' };
const recommendThemes = ['月亮给宝宝写信', '小云朵去散步', '会发光的种子', '晚风里的小摇篮', '星星邮差'];

const navItems = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'generate', label: '生成', icon: Wand2 },
  { id: 'player', label: '播放', icon: Play },
  { id: 'history', label: '历史', icon: BookOpen },
] as const;

const today = () => new Date().toISOString();
const id = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const formatPregnancyAge = (week: number, day: number) => day > 0 ? `孕 ${week} 周 + ${day} 天` : `孕 ${week} 周`;
const localDayTime = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const playbackRateOptions = [0.75, 0.85, 1, 1.15] as const;

export default function BabyStoryApp({ onBackToToolbox }: BabyStoryAppProps) {
  const [settings, setSettings] = useState<BabySettings>(defaultSettings);
  const [voiceConfig, setVoiceConfig] = useState<VoiceRuntimeConfig>(defaultVoiceRuntimeConfig);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>(systemVoices);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [theme, setTheme] = useState('');
  const [length, setLength] = useState<StoryLength>('short');
  const [style, setStyle] = useState<StoryStyle>('star');
  const [tone, setTone] = useState<ReadingTone>('soft');
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState(defaultSettings.defaultVoiceId);
  const [storyState, setStoryState] = useState<LoadState>('idle');
  const [audioState, setAudioState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const nextSettings = loadSettings();
    const nextStories = loadStories();
    const nextVoices = loadVoices();
    setSettings(nextSettings);
    setVoiceConfig(loadVoiceRuntimeConfig());
    setStories(nextStories);
    setVoices(nextVoices);
    setLength(nextSettings.defaultLength);
    setStyle(nextSettings.defaultStyle);
    setSelectedVoiceId(nextSettings.defaultVoiceId || defaultSettings.defaultVoiceId);
    setSelectedStoryId(nextStories[0]?.id ?? '');
  }, []);

  const selectedStory = stories.find(story => story.id === selectedStoryId) ?? stories[0];
  const selectedVoice = voices.find(voice => voice.id === selectedVoiceId) ?? voices[0];
  const recentAudio = stories.find(story => story.audio)?.audio;
  const recommendedTheme = recommendThemes[new Date().getDate() % recommendThemes.length];

  const pregnancyText = useMemo(() => {
    if (settings.dueDate) {
      const due = new Date(settings.dueDate);
      if (!Number.isNaN(due.getTime())) {
        const daysUntilDue = Math.ceil((localDayTime(due) - localDayTime(new Date())) / 86400000);
        if (daysUntilDue >= 0) {
          const gestationalDays = clamp(280 - daysUntilDue, 0, 294);
          const week = Math.floor(gestationalDays / 7);
          const day = gestationalDays % 7;
          return `${formatPregnancyAge(week, day)} · 距预产期约 ${daysUntilDue} 天`;
        }
        return '宝宝可能已经见到世界啦';
      }
    }
    return formatPregnancyAge(settings.pregnancyWeek, settings.pregnancyDay ?? 0);
  }, [settings.dueDate, settings.pregnancyDay, settings.pregnancyWeek]);

  const persistStories = (nextStories: StoryRecord[]) => setStories(saveStories(nextStories));
  const persistSettings = (nextSettings: BabySettings) => setSettings(saveSettings(nextSettings));
  const persistVoiceConfig = (nextConfig: VoiceRuntimeConfig) => setVoiceConfig(saveVoiceRuntimeConfig(nextConfig));
  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    persistSettings({ ...settings, defaultVoiceId: voiceId });
  };

  const handleGenerate = async (nextTheme = theme || recommendedTheme) => {
    setStoryState('loading');
    setError('');
    try {
      const nextDraft = await generateStory({ theme: nextTheme, length, style, tone, babyName: settings.babyName });
      setTheme(nextTheme);
      setDraft(nextDraft);
      setActiveTab('generate');
      setStoryState('idle');
    } catch (err) {
      setStoryState('error');
      setError(err instanceof Error ? err.message : '故事生成失败，请稍后再试');
    }
  };

  const saveDraft = () => {
    if (!draft) return null;
    const existing = selectedStory && selectedStory.title === draft.title ? selectedStory : null;
    const now = today();
    const record: StoryRecord = {
      ...draft,
      id: existing?.id ?? id(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      audio: existing?.audio,
    };
    persistStories([record, ...stories.filter(story => story.id !== record.id)]);
    setSelectedStoryId(record.id);
    return record;
  };

  const handleSynthesize = async (record = saveDraft()) => {
    if (!record || !selectedVoice) return;
    setAudioState('loading');
    setError('');
    try {
      const result = await synthesizeSpeech({
        storyId: record.id,
        text: `${record.title}\n${record.body}`,
        voice: selectedVoice,
        tone: record.tone,
        voiceConfig,
      });
      const audio: AudioRecord = {
        id: id(),
        storyId: record.id,
        voiceId: result.voiceKey || selectedVoice.voiceKey || selectedVoice.id,
        voiceName: selectedVoice.name,
        dataUrl: result.dataUrl,
        audioUrl: result.audioUrl,
        audioId: result.audioId,
        provider: result.provider || selectedVoice.provider,
        model: result.model || selectedVoice.targetModel,
        requestId: result.requestId,
        expiresAt: result.expiresAt,
        duration: result.duration,
        createdAt: today(),
      };
      persistStories([{ ...record, audio, updatedAt: today() }, ...stories.filter(story => story.id !== record.id)]);
      setSelectedStoryId(record.id);
      setActiveTab('player');
      setAudioState('idle');
    } catch (err) {
      setAudioState('error');
      setError(err instanceof Error ? err.message : '音频生成失败，请稍后再试');
    }
  };

  const handleDeleteStory = (storyId: string) => {
    const nextStories = stories.filter(story => story.id !== storyId);
    persistStories(nextStories);
    setSelectedStoryId(nextStories[0]?.id ?? '');
    if (!nextStories.length) setActiveTab('home');
  };

  return (
    <div className="h-dvh bg-[#f8f1ea] text-[#463b36]">
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f5edf6_48%,#f8f1ea_100%)] shadow-2xl">
        <header className="shrink-0 px-5 pb-3 pt-[calc(18px+env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#a38189]">胎教故事助手</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-[#403632]">{settings.babyName}的晚安故事</h1>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/75 text-[#8f6f86] shadow-sm"
              aria-label="设置"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
          {activeTab === 'home' && (
            <HomePage
              pregnancyText={pregnancyText}
              recommendedTheme={recommendedTheme}
              recentStory={stories[0]}
              recentAudio={recentAudio}
              onGenerate={() => handleGenerate(recommendedTheme)}
              onGoEditStory={story => {
                setSelectedStoryId(story.id);
                setDraft(story);
                setTheme(story.theme);
                setLength(story.length);
                setStyle(story.style);
                setTone(story.tone);
                setActiveTab('generate');
              }}
              onGoPlayer={() => setActiveTab('player')}
              onGoHistory={() => setActiveTab('history')}
            />
          )}
          {activeTab === 'generate' && (
            <GeneratePage
              theme={theme}
              length={length}
              style={style}
              tone={tone}
              draft={draft}
              storyState={storyState}
              audioState={audioState}
              error={error}
              onThemeChange={setTheme}
              onLengthChange={setLength}
              onStyleChange={setStyle}
              onToneChange={setTone}
              onGenerate={() => handleGenerate()}
              onDraftChange={setDraft}
              onSave={saveDraft}
              onSynthesize={() => {
                const record = saveDraft();
                if (!record) return;
                setSelectedStoryId(record.id);
                setActiveTab('player');
              }}
            />
          )}
          {activeTab === 'player' && <PlayerPage story={selectedStory} voices={voices} selectedVoiceId={selectedVoiceId} voiceConfig={voiceConfig} audioState={audioState} error={error} onVoiceSelect={handleVoiceSelect} onVoiceConfigChange={persistVoiceConfig} onSynthesize={() => handleSynthesize(selectedStory)} onGoGenerate={() => setActiveTab('generate')} />}
          {activeTab === 'history' && (
            <HistoryPage
              stories={stories}
              onPlay={story => {
                setSelectedStoryId(story.id);
                setActiveTab('player');
              }}
              onEdit={story => {
                setSelectedStoryId(story.id);
                setDraft(story);
                setTheme(story.theme);
                setLength(story.length);
                setStyle(story.style);
                setTone(story.tone);
                setActiveTab('generate');
              }}
              onDelete={handleDeleteStory}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              voiceConfig={voiceConfig}
              onSettingsChange={persistSettings}
              onVoiceConfigChange={persistVoiceConfig}
              onBackToToolbox={onBackToToolbox}
              onClear={() => {
                clearBabyStoryCache();
                setStories([]);
                setVoices(systemVoices);
                setVoiceConfig(defaultVoiceRuntimeConfig);
                setSelectedStoryId('');
              }}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-md -translate-x-1/2 grid-cols-4 gap-1 border-t border-white/70 bg-[#fff8f0]/90 px-3 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn('flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition', isActive ? 'bg-[#ead7ea] text-[#76506f]' : 'text-[#b09091]')}
              >
                <Icon size={21} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-[28px] border border-white/75 bg-white/72 p-4 shadow-[0_14px_34px_rgba(114,82,92,0.10)] backdrop-blur', className)}>{children}</section>;
}

function PillButton<T extends string>({ value, active, label, onClick }: { value: T; active: boolean; label: string; onClick: (value: T) => void }) {
  return <button type="button" onClick={() => onClick(value)} className={cn('min-h-10 rounded-2xl px-3 text-sm font-bold', active ? 'bg-[#79586f] text-white' : 'bg-[#f4e9e8] text-[#8b7370]')}>{label}</button>;
}

function HomePage(props: {
  pregnancyText: string;
  recommendedTheme: string;
  recentStory?: StoryRecord;
  recentAudio?: AudioRecord;
  onGenerate: () => void;
  onGoEditStory: (story: StoryRecord) => void;
  onGoPlayer: () => void;
  onGoHistory: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-[#fff7ec]/82">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f2d8df] text-[#865c73]"><Baby size={28} /></div>
          <div className="min-w-0">
            <p className="text-xs font-black text-[#a08182]">当前孕周</p>
            <h2 className="mt-1 text-xl font-black text-[#473934]">{props.pregnancyText}</h2>
            <p className="mt-1 text-sm font-bold text-[#9b7b80]">今天也给宝宝一点温柔</p>
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-[#b18091]">今日推荐主题</p>
            <h3 className="mt-2 text-lg font-black">{props.recommendedTheme}</h3>
            <p className="mt-2 text-sm leading-6 text-[#8c7470]">适合轻声读给宝宝听，句子会保持短一些，画面更柔软。</p>
          </div>
          <Sparkles className="mt-1 text-[#d7a8c9]" />
        </div>
        <button type="button" onClick={props.onGenerate} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6f536b] text-sm font-black text-white"><Wand2 size={18} /> 按默认偏好生成</button>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">最近故事</h3>
          <button type="button" onClick={props.onGoHistory} className="text-xs font-black text-[#8c6380]">全部历史</button>
        </div>
        {props.recentStory ? (
          <button type="button" onClick={() => props.onGoEditStory(props.recentStory!)} className="flex w-full items-start gap-3 rounded-2xl bg-[#fffaf5] p-3 text-left">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><BookOpen size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{props.recentStory.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#9d8582]">{props.recentStory.body}</p>
              <p className="mt-2 text-[11px] font-black text-[#8c6380]">{props.recentStory.audio ? '已有朗读音频' : '还没有生成朗读'}</p>
            </div>
            <ChevronRight size={18} className="mt-2 shrink-0 text-[#b79b9a]" />
          </button>
        ) : <EmptyState text="还没有保存的故事。可以先按默认偏好生成一篇今日故事。" />}
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">最近播放</h3>
          <button type="button" onClick={props.onGoPlayer} className="text-xs font-black text-[#8c6380]">打开播放器</button>
        </div>
        {props.recentAudio ? (
          <div className="flex items-center gap-3 rounded-2xl bg-[#f6eceb] p-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#8c6380]"><Volume2 size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{props.recentAudio.voiceName}</p>
              <p className="text-xs font-bold text-[#9d8582]">{props.recentAudio.provider === 'bailian' ? '百炼真实音频' : `${Math.round(props.recentAudio.duration || 0)} 秒 mock 朗读`}</p>
            </div>
          </div>
        ) : <EmptyState text="还没有播放记录。生成一篇故事后，就可以合成朗读音频。" />}
      </Card>
    </div>
  );
}

function GeneratePage(props: {
  theme: string;
  length: StoryLength;
  style: StoryStyle;
  tone: ReadingTone;
  draft: StoryDraft | null;
  storyState: LoadState;
  audioState: LoadState;
  error: string;
  onThemeChange: (value: string) => void;
  onLengthChange: (value: StoryLength) => void;
  onStyleChange: (value: StoryStyle) => void;
  onToneChange: (value: ReadingTone) => void;
  onGenerate: () => void;
  onDraftChange: (draft: StoryDraft) => void;
  onSave: () => StoryRecord | null;
  onSynthesize: () => void;
}) {
  const isLoading = props.storyState === 'loading';
  const [saveNotice, setSaveNotice] = useState('');
  const handleSaveClick = () => {
    const saved = props.onSave();
    if (!saved) return;
    setSaveNotice('已保存到历史');
    window.setTimeout(() => setSaveNotice(''), 1800);
  };
  return (
    <div className="space-y-4">
      <Card>
        <label className="text-sm font-black text-[#8c6380]">故事主题</label>
        <textarea value={props.theme} onChange={event => props.onThemeChange(event.target.value)} rows={3} placeholder="例如：月亮给宝宝写了一封信" className="mt-3 w-full resize-none rounded-3xl border border-[#eadcda] bg-[#fffaf5] p-4 text-base font-bold outline-none placeholder:text-[#c3aaaa]" />
        <OptionGroup title="故事长度">{Object.entries(lengthLabels).map(([value, label]) => <span key={value}><PillButton value={value as StoryLength} label={label} active={props.length === value} onClick={props.onLengthChange} /></span>)}</OptionGroup>
        <OptionGroup title="故事风格">{Object.entries(styleLabels).map(([value, label]) => <span key={value}><PillButton value={value as StoryStyle} label={label} active={props.style === value} onClick={props.onStyleChange} /></span>)}</OptionGroup>
        <OptionGroup title="朗读语气">{Object.entries(toneLabels).map(([value, label]) => <span key={value}><PillButton value={value as ReadingTone} label={label} active={props.tone === value} onClick={props.onToneChange} /></span>)}</OptionGroup>
        <button type="button" disabled={isLoading} onClick={props.onGenerate} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6f536b] text-sm font-black text-white disabled:opacity-60">{isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 生成胎教故事</button>
        {props.storyState === 'error' && <ErrorState text={props.error} />}
      </Card>
      {props.draft ? (
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">预览与编辑</h2><Pencil size={18} className="text-[#b18091]" /></div>
          <input value={props.draft.title} onChange={event => props.onDraftChange({ ...props.draft!, title: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-base font-black outline-none" />
          <textarea value={props.draft.body} onChange={event => props.onDraftChange({ ...props.draft!, body: event.target.value })} rows={10} className="mt-3 w-full resize-none rounded-3xl border border-[#eadcda] bg-[#fffaf5] p-4 text-sm font-bold leading-7 outline-none" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={handleSaveClick} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#efe5e1] text-xs font-black text-[#735f5a]"><Save size={16} />保存</button>
            <button type="button" onClick={props.onGenerate} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#eee3ef] text-xs font-black text-[#76506f]"><RotateCcw size={16} />重写</button>
            <button type="button" onClick={props.onSynthesize} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#6f536b] text-xs font-black text-white"><Volume2 size={16} />去朗读</button>
          </div>
          {saveNotice && <p className="mt-3 rounded-2xl bg-[#eef7ed] p-3 text-xs font-black leading-5 text-[#5f7a58]">{saveNotice}</p>}
          {props.audioState === 'error' && <ErrorState text={props.error} />}
        </Card>
      ) : <EmptyState text="输入一个主题，就可以生成适合胎教朗读的小故事。" />}
    </div>
  );
}

function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mt-4"><p className="mb-2 text-xs font-black text-[#a08182]">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}

function PlayerPage(props: { story?: StoryRecord; voices: VoiceProfile[]; selectedVoiceId: string; voiceConfig: VoiceRuntimeConfig; audioState: LoadState; error: string; onVoiceSelect: (id: string) => void; onVoiceConfigChange: (config: VoiceRuntimeConfig) => void; onSynthesize: () => void; onGoGenerate: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => { setProgress(0); setPlaying(false); }, [props.story?.audio?.id]);
  const playbackRate = props.voiceConfig.playbackRate ?? 0.85;
  const applyPlaybackRate = () => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  };
  useEffect(() => { applyPlaybackRate(); }, [playbackRate]);
  const handlePlaybackRateChange = (nextRate: number) => {
    props.onVoiceConfigChange({ ...props.voiceConfig, playbackRate: nextRate });
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };
  if (!props.story) return <EmptyState text="还没有故事。先生成一篇胎教故事，再来这里播放。" action="去生成" onAction={props.onGoGenerate} />;
  const audio = props.story.audio;
  const audioSrc = audio?.audioUrl || audio?.dataUrl || '';
  const isExpired = Boolean(audio?.expiresAt && Date.now() / 1000 > audio.expiresAt);
  const toggle = () => {
    if (!audioRef.current || isExpired) return;
    applyPlaybackRate();
    if (audioRef.current.paused) audioRef.current.play(); else audioRef.current.pause();
  };
  return (
    <div className="space-y-4">
      <Card className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#ead7ea] text-[#76506f]"><Heart size={42} fill="currentColor" /></div><h2 className="mt-5 text-xl font-black">{props.story.title}</h2><p className="mt-2 text-sm font-bold text-[#9b7b80]">{lengthLabels[props.story.length]} · {toneLabels[props.story.tone]}</p></Card>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black">朗读声音</h3>
            <p className="mt-1 text-xs font-bold text-[#9b7b80]">切换声音后，需要重新生成朗读音频。</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {props.voices.map(voice => (
            <button
              key={voice.id}
              type="button"
              onClick={() => props.onVoiceSelect(voice.id)}
              className={cn('h-12 rounded-2xl border text-sm font-black transition', props.selectedVoiceId === voice.id ? 'border-[#8c6380] bg-[#ead7ea] text-[#6f536b]' : 'border-[#eadcda] bg-[#fffaf5] text-[#8c7470]')}
            >
              {voice.name}
            </button>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black">播放倍速</h3>
            <span className="text-xs font-black text-[#9b7b80]">{playbackRate}x</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {playbackRateOptions.map(rate => (
              <button
                key={rate}
                type="button"
                onClick={() => handlePlaybackRateChange(rate)}
                className={cn('h-10 rounded-2xl border text-xs font-black transition', playbackRate === rate ? 'border-[#8c6380] bg-[#ead7ea] text-[#6f536b]' : 'border-[#eadcda] bg-[#fffaf5] text-[#8c7470]')}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </Card>
      {audio ? (
        <Card>
          <audio ref={audioRef} src={audioSrc} onLoadedMetadata={applyPlaybackRate} onPlay={() => { applyPlaybackRate(); setPlaying(true); }} onPause={() => setPlaying(false)} onTimeUpdate={event => setProgress((event.currentTarget.currentTime / (event.currentTarget.duration || 1)) * 100)} onEnded={() => setPlaying(false)} />
          <div className="flex items-center justify-between text-xs font-black text-[#9b7b80]"><span>{audio.voiceName}</span><span>{audio.provider === 'bailian' ? `百炼真实音频 · ${playbackRate}x` : `${Math.round(audio.duration || 0)} 秒 · ${playbackRate}x`}</span></div>
          {audio.provider === 'bailian' && <p className="mt-3 rounded-2xl bg-[#f8f0f5] p-3 text-xs font-bold leading-5 text-[#8c6380]">百炼真实音频{audio.model ? ` · ${audio.model}` : ''}{audio.expiresAt ? ` · 过期时间 ${new Date(audio.expiresAt * 1000).toLocaleString()}` : ''}</p>}
          {isExpired && <p className="mt-3 rounded-2xl bg-[#fff0f0] p-3 text-xs font-black leading-5 text-[#a9525e]">这段百炼音频 URL 已过期，请重新生成朗读。</p>}
          <input type="range" min={0} max={100} value={progress} onChange={event => { const next = Number(event.target.value); setProgress(next); if (audioRef.current) audioRef.current.currentTime = ((audioRef.current.duration || audio.duration || 1) * next) / 100; }} className="mt-5 w-full accent-[#76506f]" />
          <div className="mt-5 flex items-center justify-center gap-3"><button type="button" onClick={toggle} disabled={isExpired || !audioSrc} className="grid h-16 w-16 place-items-center rounded-full bg-[#6f536b] text-white disabled:opacity-50">{playing ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}</button><button type="button" onClick={props.onSynthesize} disabled={props.audioState === 'loading'} className="grid h-12 w-12 place-items-center rounded-full bg-[#efe5e1] text-[#735f5a] disabled:opacity-60" aria-label="重新生成音频">{props.audioState === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}</button></div>
        </Card>
      ) : (
        <Card className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><Volume2 size={24} /></div>
          <p className="mt-4 text-sm font-bold leading-6 text-[#8c7470]">这篇故事还没有朗读音频。</p>
          <button type="button" disabled={props.audioState === 'loading'} onClick={props.onSynthesize} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6f536b] text-sm font-black text-white disabled:opacity-60">
            {props.audioState === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Volume2 size={18} />}
            {props.audioState === 'loading' ? '正在生成朗读' : '生成朗读'}
          </button>
        </Card>
      )}
      {props.audioState === 'error' && <ErrorState text={props.error} />}
    </div>
  );
}

function HistoryPage(props: { stories: StoryRecord[]; onPlay: (story: StoryRecord) => void; onEdit: (story: StoryRecord) => void; onDelete: (id: string) => void }) {
  if (!props.stories.length) return <EmptyState text="历史里还没有故事。每天写一篇，宝宝会慢慢拥有自己的小书架。" />;
  return (
    <div className="space-y-3">
      {props.stories.map(story => (
        <div key={story.id}>
          <Card>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><CalendarDays size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#a08182]">{formatDate(story.createdAt)}</p>
                    <h3 className="mt-1 font-black">{story.title}</h3>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-black', story.audio ? 'bg-[#f1e3f0] text-[#76506f]' : 'bg-[#fff4df] text-[#8c6d4d]')}>{story.audio ? '已有朗读' : '未朗读'}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8c7470]">{story.body}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => props.onPlay(story)} className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-[#6f536b] text-xs font-black text-white"><Play size={15} />播放</button>
              <button type="button" onClick={() => props.onEdit(story)} className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-[#efe5e1] text-xs font-black text-[#735f5a]"><Pencil size={15} />编辑</button>
              <button type="button" onClick={() => props.onDelete(story.id)} className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-[#fff0f0] text-xs font-black text-[#a9525e]"><Trash2 size={15} />删除</button>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function SettingsPage(props: { settings: BabySettings; voiceConfig: VoiceRuntimeConfig; onSettingsChange: (settings: BabySettings) => void; onVoiceConfigChange: (config: VoiceRuntimeConfig) => void; onClear: () => void; onBackToToolbox?: () => void }) {
  const [local, setLocal] = useState(props.settings);
  const [voiceLocal, setVoiceLocal] = useState(props.voiceConfig);
  useEffect(() => setLocal(props.settings), [props.settings]);
  useEffect(() => setVoiceLocal(props.voiceConfig), [props.voiceConfig]);
  const update = (patch: Partial<BabySettings>) => { const next = { ...local, ...patch }; setLocal(next); props.onSettingsChange(next); };
  const updateVoice = (patch: Partial<VoiceRuntimeConfig>) => { const next = { ...voiceLocal, ...patch }; setVoiceLocal(next); props.onVoiceConfigChange(next); };
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-black">宝宝信息</h2>
        <SettingsField label="宝宝昵称"><input value={local.babyName} onChange={event => update({ babyName: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" /></SettingsField>
        <SettingsField label="预产期"><input type="date" value={local.dueDate} onChange={event => update({ dueDate: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" /></SettingsField>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SettingsField label="孕周">
            <input
              type="number"
              min={1}
              max={42}
              value={local.pregnancyWeek}
              onChange={event => update({ pregnancyWeek: clamp(Number(event.target.value), 1, 42) })}
              className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none"
            />
          </SettingsField>
          <SettingsField label="天数">
            <input
              type="number"
              min={0}
              max={6}
              value={local.pregnancyDay ?? 0}
              onChange={event => update({ pregnancyDay: clamp(Number(event.target.value), 0, 6) })}
              className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none"
            />
          </SettingsField>
        </div>
        <p className="mt-3 rounded-2xl bg-[#fffaf5] p-3 text-xs font-bold leading-5 text-[#9b7b80]">填写预产期后，首页会自动推算孕周；没有预产期时使用手动设置的周数和天数。</p>
      </Card>
      <Card><h2 className="text-lg font-black">默认偏好</h2><SettingsField label="默认长度"><select value={local.defaultLength} onChange={event => update({ defaultLength: event.target.value as StoryLength })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none">{Object.entries(lengthLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></SettingsField><SettingsField label="默认风格"><select value={local.defaultStyle} onChange={event => update({ defaultStyle: event.target.value as StoryStyle })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none">{Object.entries(styleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></SettingsField></Card>
      <Card><h2 className="text-lg font-black">百炼朗读</h2><p className="mt-2 text-sm leading-6 text-[#8c7470]">个人使用只需要配置 Worker 地址。爸爸/妈妈真实音色 ID 在 Cloudflare Worker 后台维护，前端只发送 papa 或 mama。</p><SettingsField label="Worker Base URL"><input value={voiceLocal.workerBaseUrl} onChange={event => updateVoice({ workerBaseUrl: event.target.value })} placeholder="https://your-worker.example.workers.dev" className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" /></SettingsField><label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#fffaf5] p-3 text-sm font-bold text-[#735f5a]"><span>启用百炼真实语音</span><input type="checkbox" checked={voiceLocal.realVoiceEnabled} onChange={event => updateVoice({ realVoiceEnabled: event.target.checked })} className="accent-[#76506f]" /></label><label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#fffaf5] p-3 text-sm font-bold text-[#735f5a]"><span>Worker 不可用时使用 mock</span><input type="checkbox" checked={voiceLocal.mockFallbackEnabled} onChange={event => updateVoice({ mockFallbackEnabled: event.target.checked })} className="accent-[#76506f]" /></label><p className="mt-3 rounded-2xl bg-[#f8f0f5] p-3 text-xs font-bold leading-5 text-[#8c6380]">模型、音色 ID、朗读参数都由 Worker 和百炼后台控制，前端不再配置。</p></Card>
      <Card><h2 className="text-lg font-black">缓存</h2><p className="mt-2 text-sm leading-6 text-[#8c7470]">故事、音色配置和 mock 音频保存在本机浏览器。清理后不可恢复。</p><button type="button" onClick={props.onClear} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#fff0f0] text-sm font-black text-[#a9525e]"><Trash2 size={17} />清理故事与音色缓存</button></Card>
      {props.onBackToToolbox && <Card><button type="button" onClick={props.onBackToToolbox} className="flex w-full items-center justify-between gap-4 text-left"><span className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><PackageOpen size={19} /></span><span className="min-w-0"><strong className="block text-sm font-black text-[#403632]">返回三秋工具箱</strong><span className="mt-1 block text-xs font-bold text-[#9b7b80]">切换到其他个人工具</span></span></span><ChevronRight size={18} className="shrink-0 text-[#b79b9a]" /></button></Card>}
    </div>
  );
}

function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-4 block"><span className="mb-2 block text-xs font-black text-[#a08182]">{label}</span>{children}</label>;
}

function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return <Card className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><Clock size={24} /></div><p className="mt-4 text-sm font-bold leading-6 text-[#8c7470]">{text}</p>{action && <button type="button" onClick={onAction} className="mt-4 h-11 rounded-2xl bg-[#6f536b] px-5 text-sm font-black text-white">{action}</button>}</Card>;
}

function ErrorState({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl bg-[#fff0f0] p-3 text-xs font-black leading-5 text-[#a9525e]">{text}</p>;
}
