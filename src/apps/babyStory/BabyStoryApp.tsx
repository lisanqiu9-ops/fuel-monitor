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
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  PackageOpen,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { generateStory, synthesizeSpeech } from './api';
import {
  clearBabyStoryCache,
  defaultSettings,
  loadSettings,
  loadStories,
  loadVoices,
  saveCustomVoices,
  saveSettings,
  saveStories,
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
} from './types';
import { cn } from '../../lib/utils';

type TabId = 'home' | 'generate' | 'voices' | 'player' | 'history' | 'settings';
type LoadState = 'idle' | 'loading' | 'error';

interface BabyStoryAppProps {
  onBackToToolbox?: () => void;
}

const lengthLabels: Record<StoryLength, string> = {
  short: '短篇',
  medium: '中篇',
  long: '长篇',
};

const styleLabels: Record<StoryStyle, string> = {
  forest: '森林微光',
  ocean: '海湾晚风',
  star: '星星月亮',
  daily: '日常小事',
  poem: '诗意梦境',
};

const toneLabels: Record<ReadingTone, string> = {
  soft: '温柔',
  happy: '轻快',
  sleepy: '睡前',
};

const recommendThemes = ['月亮给宝宝写信', '小云朵去散步', '会发光的种子', '晚风里的小摇篮', '星星邮差'];

const navItems = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'generate', label: '生成', icon: Wand2 },
  { id: 'voices', label: '声音', icon: Mic },
  { id: 'player', label: '播放', icon: Play },
  { id: 'history', label: '历史', icon: BookOpen },
] as const;

const today = () => new Date().toISOString();
const id = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value));

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('录音保存失败'));
    reader.readAsDataURL(blob);
  });

export default function App({ onBackToToolbox }: BabyStoryAppProps) {
  const [settings, setSettings] = useState<BabySettings>(defaultSettings);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>(systemVoices);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [theme, setTheme] = useState('');
  const [length, setLength] = useState<StoryLength>('short');
  const [style, setStyle] = useState<StoryStyle>('star');
  const [tone, setTone] = useState<ReadingTone>('soft');
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('system-mama-soft');
  const [storyState, setStoryState] = useState<LoadState>('idle');
  const [audioState, setAudioState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const nextSettings = loadSettings();
    const nextStories = loadStories();
    const nextVoices = loadVoices();
    setSettings(nextSettings);
    setStories(nextStories);
    setVoices(nextVoices);
    setLength(nextSettings.defaultLength);
    setStyle(nextSettings.defaultStyle);
    setSelectedVoiceId(nextSettings.defaultVoiceId);
    setSelectedStoryId(nextStories[0]?.id ?? '');
  }, []);

  const selectedStory = stories.find(story => story.id === selectedStoryId) ?? stories[0];
  const selectedVoice = voices.find(voice => voice.id === selectedVoiceId) ?? voices[0];
  const recentAudio = stories.find(story => story.audio)?.audio;
  const recommendedTheme = recommendThemes[new Date().getDate() % recommendThemes.length];

  const pregnancyText = useMemo(() => {
    if (settings.dueDate) {
      const due = new Date(settings.dueDate);
      const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
      return days > 0 ? `距离预产期约 ${days} 天` : '宝宝可能已经见到世界啦';
    }
    return `孕 ${settings.pregnancyWeek} 周`;
  }, [settings.dueDate, settings.pregnancyWeek]);

  const persistStories = (nextStories: StoryRecord[]) => setStories(saveStories(nextStories));
  const persistSettings = (nextSettings: BabySettings) => setSettings(saveSettings(nextSettings));

  const handleGenerate = async (nextTheme = theme || recommendedTheme) => {
    setStoryState('loading');
    setError('');
    try {
      const nextDraft = await generateStory({
        theme: nextTheme,
        length,
        style,
        tone,
        babyName: settings.babyName,
      });
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
      });
      const audio: AudioRecord = {
        id: id(),
        storyId: record.id,
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        dataUrl: result.dataUrl,
        duration: result.duration,
        createdAt: today(),
      };
      const withoutRecord = stories.filter(story => story.id !== record.id);
      persistStories([{ ...record, audio, updatedAt: today() }, ...withoutRecord]);
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
              recentAudio={recentAudio}
              stories={stories}
              onGenerate={() => handleGenerate(recommendedTheme)}
              onGoGenerate={() => setActiveTab('generate')}
              onGoVoices={() => setActiveTab('voices')}
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
              onSynthesize={() => handleSynthesize()}
            />
          )}

          {activeTab === 'voices' && (
            <VoicesPage
              voices={voices}
              selectedVoiceId={selectedVoiceId}
              onSelect={setSelectedVoiceId}
              onVoicesChange={setVoices}
            />
          )}

          {activeTab === 'player' && (
            <PlayerPage
              story={selectedStory}
              audioState={audioState}
              error={error}
              onSynthesize={() => handleSynthesize(selectedStory)}
              onGoGenerate={() => setActiveTab('generate')}
            />
          )}

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
              voices={voices}
              onBackToToolbox={onBackToToolbox}
              onSettingsChange={persistSettings}
              onClear={() => {
                clearBabyStoryCache();
                setStories([]);
                setVoices(systemVoices);
                setSelectedStoryId('');
              }}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-md -translate-x-1/2 grid-cols-5 gap-1 border-t border-white/70 bg-[#fff8f0]/90 px-3 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition',
                  isActive ? 'bg-[#ead7ea] text-[#76506f]' : 'text-[#b09091]',
                )}
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
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn('min-h-10 rounded-2xl px-3 text-sm font-bold', active ? 'bg-[#79586f] text-white' : 'bg-[#f4e9e8] text-[#8b7370]')}
    >
      {label}
    </button>
  );
}

function HomePage(props: {
  pregnancyText: string;
  recommendedTheme: string;
  recentAudio?: AudioRecord;
  stories: StoryRecord[];
  onGenerate: () => void;
  onGoGenerate: () => void;
  onGoVoices: () => void;
  onGoPlayer: () => void;
  onGoHistory: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-[#fff7ec]/82">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f2d8df] text-[#865c73]">
            <Baby size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#9b7b80]">{props.pregnancyText}</p>
            <h2 className="mt-1 text-xl font-black text-[#473934]">今天也给宝宝一点温柔</h2>
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
        <button type="button" onClick={props.onGenerate} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6f536b] text-sm font-black text-white">
          <Wand2 size={18} /> 生成今日故事
        </button>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={props.onGoGenerate} className="rounded-[24px] bg-[#efe1ef] p-4 text-left text-[#73526c]">
          <Plus size={20} />
          <span className="mt-3 block text-sm font-black">新故事</span>
        </button>
        <button type="button" onClick={props.onGoVoices} className="rounded-[24px] bg-[#f3e8d9] p-4 text-left text-[#8a6850]">
          <Mic size={20} />
          <span className="mt-3 block text-sm font-black">录声音</span>
        </button>
        <button type="button" onClick={props.onGoHistory} className="rounded-[24px] bg-[#e7eadf] p-4 text-left text-[#66725e]">
          <BookOpen size={20} />
          <span className="mt-3 block text-sm font-black">历史</span>
        </button>
      </div>

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
              <p className="text-xs font-bold text-[#9d8582]">{Math.round(props.recentAudio.duration)} 秒 mock 朗读</p>
            </div>
          </div>
        ) : (
          <EmptyState text="还没有播放记录。生成一篇故事后，就可以合成朗读音频。" />
        )}
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
  return (
    <div className="space-y-4">
      <Card>
        <label className="text-sm font-black text-[#8c6380]">故事主题</label>
        <textarea
          value={props.theme}
          onChange={event => props.onThemeChange(event.target.value)}
          rows={3}
          placeholder="例如：月亮给宝宝写了一封信"
          className="mt-3 w-full resize-none rounded-3xl border border-[#eadcda] bg-[#fffaf5] p-4 text-base font-bold outline-none placeholder:text-[#c3aaaa]"
        />
        <OptionGroup title="故事长度">
          {Object.entries(lengthLabels).map(([value, label]) => (
            <span key={value}>
              <PillButton value={value as StoryLength} label={label} active={props.length === value} onClick={props.onLengthChange} />
            </span>
          ))}
        </OptionGroup>
        <OptionGroup title="故事风格">
          {Object.entries(styleLabels).map(([value, label]) => (
            <span key={value}>
              <PillButton value={value as StoryStyle} label={label} active={props.style === value} onClick={props.onStyleChange} />
            </span>
          ))}
        </OptionGroup>
        <OptionGroup title="朗读语气">
          {Object.entries(toneLabels).map(([value, label]) => (
            <span key={value}>
              <PillButton value={value as ReadingTone} label={label} active={props.tone === value} onClick={props.onToneChange} />
            </span>
          ))}
        </OptionGroup>
        <button type="button" disabled={isLoading} onClick={props.onGenerate} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6f536b] text-sm font-black text-white disabled:opacity-60">
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 生成胎教故事
        </button>
        {props.storyState === 'error' && <ErrorState text={props.error} />}
      </Card>

      {props.draft ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">预览与编辑</h2>
            <Pencil size={18} className="text-[#b18091]" />
          </div>
          <input
            value={props.draft.title}
            onChange={event => props.onDraftChange({ ...props.draft!, title: event.target.value })}
            className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-base font-black outline-none"
          />
          <textarea
            value={props.draft.body}
            onChange={event => props.onDraftChange({ ...props.draft!, body: event.target.value })}
            rows={12}
            className="mt-3 w-full resize-none rounded-3xl border border-[#eadcda] bg-[#fffaf5] p-4 text-sm leading-7 outline-none"
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={props.onSave} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#efe5e1] text-xs font-black text-[#735f5a]"><Save size={16} />保存</button>
            <button type="button" onClick={props.onGenerate} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#eee3ef] text-xs font-black text-[#76506f]"><RotateCcw size={16} />重写</button>
            <button type="button" onClick={props.onSynthesize} className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-[#6f536b] text-xs font-black text-white">
              {props.audioState === 'loading' ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} />}朗读
            </button>
          </div>
          {props.audioState === 'error' && <ErrorState text={props.error} />}
        </Card>
      ) : (
        <EmptyState text="输入一个主题，就可以生成适合胎教朗读的小故事。" />
      )}
    </div>
  );
}

function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-black text-[#a08182]">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function VoicesPage(props: {
  voices: VoiceProfile[];
  selectedVoiceId: string;
  onSelect: (id: string) => void;
  onVoicesChange: (voices: VoiceProfile[]) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState('我的温柔声音');
  const [message, setMessage] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();

  const stopRecording = () => recorderRef.current?.state === 'recording' && recorderRef.current.stop();

  const startRecording = async () => {
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        window.clearInterval(timerRef.current);
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedUrl(await blobToDataUrl(blob));
        setRecording(false);
      };
      setSeconds(0);
      setRecording(true);
      recorder.start();
      timerRef.current = window.setInterval(() => {
        setSeconds(current => {
          if (current >= 19) stopRecording();
          return current + 1;
        });
      }, 1000);
    } catch {
      setMessage('无法访问麦克风，请检查浏览器权限。');
    }
  };

  const saveVoice = () => {
    if (!recordedUrl || seconds < 10) {
      setMessage('请录制 10 到 20 秒的声音样本后再保存。');
      return;
    }
    const customVoice: VoiceProfile = {
      id: id(),
      name,
      kind: 'custom',
      description: '已保存的本人或获授权家人声音样本，真实克隆接口后续由后端代理处理。',
      createdAt: today(),
      sampleDataUrl: recordedUrl,
      sampleDuration: seconds,
    };
    const next = saveCustomVoices([...props.voices, customVoice]);
    props.onVoicesChange(next);
    props.onSelect(customVoice.id);
    setRecordedUrl('');
    setSeconds(0);
    setMessage('音色记录已保存。');
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-black">选择声音</h2>
        <div className="mt-3 space-y-2">
          {props.voices.map(voice => (
            <button
              key={voice.id}
              type="button"
              onClick={() => props.onSelect(voice.id)}
              className={cn('flex w-full items-center gap-3 rounded-3xl border p-3 text-left', props.selectedVoiceId === voice.id ? 'border-[#8c6380] bg-[#f1e3f0]' : 'border-white/80 bg-[#fffaf5]')}
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#8c6380]"><Volume2 size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{voice.name}</p>
                <p className="text-xs leading-5 text-[#937b77]">{voice.description}</p>
              </div>
              <ChevronRight size={18} className="text-[#b79b9a]" />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-black">我的声音</h2>
        <p className="mt-2 rounded-2xl bg-[#fff4df] p-3 text-xs font-bold leading-5 text-[#8c6d4d]">
          只能采样本人或已获授权的家人声音。请不要录制或复刻陌生人、明星、主播等未授权声音。
        </p>
        <input value={name} onChange={event => setName(event.target.value)} className="mt-3 w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" />
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={recording ? stopRecording : startRecording} className={cn('flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white', recording ? 'bg-[#b35d6b]' : 'bg-[#6f536b]')}>
            <Mic size={18} /> {recording ? `停止录制 ${seconds}s` : '录制 10-20 秒'}
          </button>
          <button type="button" onClick={saveVoice} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efe5e1] text-[#735f5a]" aria-label="保存音色"><Save size={18} /></button>
        </div>
        {recordedUrl && <audio className="mt-3 w-full" src={recordedUrl} controls />}
        {message && <p className="mt-3 text-xs font-bold text-[#8c6380]">{message}</p>}
      </Card>
    </div>
  );
}

function PlayerPage(props: {
  story?: StoryRecord;
  audioState: LoadState;
  error: string;
  onSynthesize: () => void;
  onGoGenerate: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [props.story?.audio?.id]);

  if (!props.story) {
    return <EmptyState text="还没有故事。先生成一篇胎教故事，再来这里播放。" action="去生成" onAction={props.onGoGenerate} />;
  }

  const audio = props.story.audio;
  const toggle = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#ead7ea] text-[#76506f]">
          <Heart size={42} fill="currentColor" />
        </div>
        <h2 className="mt-5 text-xl font-black">{props.story.title}</h2>
        <p className="mt-2 text-sm font-bold text-[#9b7b80]">{lengthLabels[props.story.length]} · {toneLabels[props.story.tone]}</p>
      </Card>

      {audio ? (
        <Card>
          <audio
            ref={audioRef}
            src={audio.dataUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={event => setProgress((event.currentTarget.currentTime / (event.currentTarget.duration || 1)) * 100)}
            onEnded={() => setPlaying(false)}
          />
          <div className="flex items-center justify-between text-xs font-black text-[#9b7b80]">
            <span>{audio.voiceName}</span>
            <span>{Math.round(audio.duration)} 秒</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={event => {
              const next = Number(event.target.value);
              setProgress(next);
              if (audioRef.current) audioRef.current.currentTime = ((audioRef.current.duration || audio.duration) * next) / 100;
            }}
            className="mt-5 w-full accent-[#76506f]"
          />
          <div className="mt-5 flex items-center justify-center gap-3">
            <button type="button" onClick={toggle} className="grid h-16 w-16 place-items-center rounded-full bg-[#6f536b] text-white">
              {playing ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
            </button>
            <button type="button" onClick={props.onSynthesize} className="grid h-12 w-12 place-items-center rounded-full bg-[#efe5e1] text-[#735f5a]" aria-label="重新生成音频">
              {props.audioState === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
            </button>
          </div>
        </Card>
      ) : (
        <EmptyState text="这篇故事还没有朗读音频。" action="生成 mock 朗读" onAction={props.onSynthesize} />
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
              <p className="text-xs font-black text-[#a08182]">{formatDate(story.createdAt)}</p>
              <h3 className="mt-1 font-black">{story.title}</h3>
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

function SettingsPage(props: { settings: BabySettings; voices: VoiceProfile[]; onSettingsChange: (settings: BabySettings) => void; onClear: () => void; onBackToToolbox?: () => void }) {
  const [local, setLocal] = useState(props.settings);
  useEffect(() => setLocal(props.settings), [props.settings]);

  const update = (patch: Partial<BabySettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    props.onSettingsChange(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-black">宝宝信息</h2>
        <SettingsField label="宝宝昵称">
          <input value={local.babyName} onChange={event => update({ babyName: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" />
        </SettingsField>
        <SettingsField label="预产期">
          <input type="date" value={local.dueDate} onChange={event => update({ dueDate: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" />
        </SettingsField>
        <SettingsField label="孕周">
          <input type="number" min={1} max={42} value={local.pregnancyWeek} onChange={event => update({ pregnancyWeek: Number(event.target.value) })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none" />
        </SettingsField>
      </Card>

      <Card>
        <h2 className="text-lg font-black">默认偏好</h2>
        <SettingsField label="默认长度">
          <select value={local.defaultLength} onChange={event => update({ defaultLength: event.target.value as StoryLength })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none">
            {Object.entries(lengthLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="默认风格">
          <select value={local.defaultStyle} onChange={event => update({ defaultStyle: event.target.value as StoryStyle })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none">
            {Object.entries(styleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </SettingsField>
        <SettingsField label="默认声音">
          <select value={local.defaultVoiceId} onChange={event => update({ defaultVoiceId: event.target.value })} className="w-full rounded-2xl border border-[#eadcda] bg-[#fffaf5] px-4 py-3 text-sm font-bold outline-none">
            {props.voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
        </SettingsField>
      </Card>

      <Card>
        <h2 className="text-lg font-black">缓存</h2>
        <p className="mt-2 text-sm leading-6 text-[#8c7470]">故事、音色和 mock 音频保存在本机浏览器。清理后不可恢复。</p>
        <button type="button" onClick={props.onClear} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#fff0f0] text-sm font-black text-[#a9525e]"><Trash2 size={17} />清理故事与音色缓存</button>
      </Card>

      {props.onBackToToolbox && (
        <Card>
          <button type="button" onClick={props.onBackToToolbox} className="flex w-full items-center justify-between gap-4 text-left">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]">
                <PackageOpen size={19} />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-black text-[#403632]">返回三秋工具箱</strong>
                <span className="mt-1 block text-xs font-bold text-[#9b7b80]">切换到其他个人工具</span>
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-[#b79b9a]" />
          </button>
        </Card>
      )}
    </div>
  );
}

function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-black text-[#a08182]">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <Card className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f1e3f0] text-[#76506f]"><Clock size={24} /></div>
      <p className="mt-4 text-sm font-bold leading-6 text-[#8c7470]">{text}</p>
      {action && <button type="button" onClick={onAction} className="mt-4 h-11 rounded-2xl bg-[#6f536b] px-5 text-sm font-black text-white">{action}</button>}
    </Card>
  );
}

function ErrorState({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl bg-[#fff0f0] p-3 text-xs font-black leading-5 text-[#a9525e]">{text}</p>;
}
