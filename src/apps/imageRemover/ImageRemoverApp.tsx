import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { removeBackground } from '@imgly/background-removal';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileImage,
  ImageDown,
  Loader2,
  Lock,
  RotateCcw,
  Scissors,
  Sparkles,
  Upload,
  Wifi,
  X,
} from 'lucide-react';

type EngineMode = 'local' | 'cloud';
type ProcessState = 'idle' | 'processing' | 'done' | 'error';

type InputImage = {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
};

type ImageRemoverAppProps = {
  onBackToToolbox?: () => void;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const BG_COLORS = [
  { value: 'transparent', label: '透明' },
  { value: '#ffffff', label: '白色' },
  { value: '#1f2937', label: '深灰' },
  { value: '#ef4444', label: '红色' },
  { value: '#2563eb', label: '蓝色' },
  { value: '#16a34a', label: '绿色' },
];

const checkerboard = {
  backgroundImage: 'conic-gradient(#dbe2ea 25%, #fff 25%, #fff 50%, #dbe2ea 50%, #dbe2ea 75%, #fff 75%)',
  backgroundSize: '18px 18px',
};

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default function ImageRemoverApp({ onBackToToolbox }: ImageRemoverAppProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<InputImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<EngineMode>('local');
  const [state, setState] = useState<ProcessState>('idle');
  const [progress, setProgress] = useState(0);
  const [bgColor, setBgColor] = useState('transparent');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const activeImage = useMemo(() => images.find(image => image.id === activeId) || images[0] || null, [activeId, images]);
  const resultUrl = activeImage ? results[activeImage.id] : null;

  const addFiles = useCallback((fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    const valid = files.filter(file => file.type.startsWith('image/') && file.size <= MAX_FILE_SIZE);
    const rejected = files.length - valid.length;

    if (!valid.length) {
      if (rejected) setMessage('请选择 20MB 以内的图片文件。');
      return;
    }

    const next = valid.map(file => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID?.() || Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    setImages(current => [...current, ...next]);
    setActiveId(current => current || next[0].id);
    setState('idle');
    setProgress(0);
    setMessage(rejected ? '部分文件不是图片或超过 20MB，已自动跳过。' : '');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const runLocal = useCallback(async (file: File) => {
    return removeBackground(file, {
      model: 'isnet_quint8',
      output: { format: 'image/png', quality: 1 },
      progress: (_key: string, current: number, total: number) => {
        if (!total) return;
        setProgress(Math.max(5, Math.min(95, Math.round((current / total) * 100))));
      },
    });
  }, []);

  const runCloud = useCallback(async (file: File) => {
    const apiKey = import.meta.env.VITE_REMOVE_BG_KEY;
    if (!apiKey) throw new Error('云端模式未配置 remove.bg API Key，请切换到本地模式。');
    setProgress(15);

    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: formData,
    });
    setProgress(75);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`remove.bg 返回 ${response.status}：${detail}`);
    }

    return response.blob();
  }, []);

  const processActive = useCallback(async () => {
    if (!activeImage || state === 'processing') return;
    setState('processing');
    setProgress(5);
    setMessage(mode === 'local' ? '首次本地处理会下载模型资源，之后由浏览器缓存。' : '正在调用 remove.bg 云端接口。');

    try {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const blob = mode === 'cloud' ? await runCloud(activeImage.file) : await runLocal(activeImage.file);
      const url = URL.createObjectURL(blob);
      setResults(current => ({ ...current, [activeImage.id]: url }));
      setProgress(100);
      setState('done');
      setMessage('背景已移除，可以预览或下载。');
    } catch (error) {
      setState('error');
      setProgress(0);
      setMessage(error instanceof Error ? error.message : '处理失败，请稍后重试。');
    }
  }, [activeImage, mode, resultUrl, runCloud, runLocal, state]);

  const removeImage = useCallback((id: string) => {
    setImages(current => {
      const target = current.find(image => image.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter(image => image.id !== id);
    });
    setResults(current => {
      if (current[id]) URL.revokeObjectURL(current[id]);
      const next = { ...current };
      delete next[id];
      return next;
    });
    setActiveId(current => (current === id ? null : current));
    setState('idle');
    setProgress(0);
  }, []);

  const resetAll = useCallback(() => {
    images.forEach(image => URL.revokeObjectURL(image.url));
    Object.values(results).forEach((url: string) => URL.revokeObjectURL(url));
    setImages([]);
    setResults({});
    setActiveId(null);
    setState('idle');
    setProgress(0);
    setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  }, [images, results]);

  const download = useCallback((format: 'png' | 'jpg') => {
    if (!activeImage || !resultUrl) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpg' || bgColor !== 'transparent') {
        ctx.fillStyle = bgColor === 'transparent' ? '#ffffff' : bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeImage.name.replace(/\.[^.]+$/, '')}-去背景.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }, format === 'png' ? 'image/png' : 'image/jpeg', 0.94);
    };
    image.src = resultUrl;
  }, [activeImage, bgColor, resultUrl]);

  const stageText = state === 'processing' ? `正在处理 ${progress}%` : state === 'done' ? '处理完成' : state === 'error' ? '处理失败' : '等待上传图片';

  return (
    <main className="h-dvh overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f1edf6_55%,#f8f1ea_100%)] text-[#403632] antialiased">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        <header className="shrink-0 px-5 pb-3 pt-[calc(16px+env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBackToToolbox} className="grid h-10 w-10 place-items-center rounded-full bg-white/76 text-[#7b6662] shadow-[0_8px_20px_rgba(91,72,72,0.08),0_0_0_1px_rgba(255,255,255,0.78)]" aria-label="返回三秋工具箱">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-black text-[#a38189]">图片工具</p>
              <h1 className="truncate text-lg font-black">AI 抠图去背景</h1>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#ead7ea] text-[#76506f]">
              <Scissors size={19} />
            </div>
          </div>
        </header>

        <section className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
          <section className="rounded-[26px] bg-white/78 p-4 shadow-[0_16px_38px_rgba(91,72,72,0.10),0_0_0_1px_rgba(255,255,255,0.82)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#a38189]">{stageText}</p>
                <p className="mt-1 text-sm font-bold text-[#7d6965]">{activeImage ? `${activeImage.name} · ${formatSize(activeImage.size)}` : '支持 JPG、PNG、WebP，单张不超过 20MB'}</p>
              </div>
              <button type="button" onClick={() => inputRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5ede8] text-[#76506f]" aria-label="添加图片">
                <Upload size={19} />
              </button>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => !activeImage && inputRef.current?.click()}
              onKeyDown={event => {
                if (!activeImage && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click();
              }}
              onDragOver={event => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={event => {
                event.preventDefault();
                setIsDragOver(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`mt-4 overflow-hidden rounded-[22px] border border-white/80 bg-[#f7efe9] ${isDragOver ? 'ring-2 ring-[#76506f]' : ''}`}
            >
              {activeImage ? (
                <ImagePreview originalUrl={activeImage.url} resultUrl={resultUrl} bgColor={bgColor} />
              ) : (
                <div className="grid min-h-[280px] place-items-center px-6 text-center">
                  <div>
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white/82 text-[#76506f]">
                      <Upload size={28} />
                    </div>
                    <p className="mt-4 text-base font-black">拖拽图片到这里</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#8b7471]">或点击选择文件开始去背景。</p>
                  </div>
                </div>
              )}
            </div>

            {state === 'processing' && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6ddd8]">
                <div className="h-full rounded-full bg-[#76506f] transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </section>

          <section className="mt-3 grid grid-cols-2 gap-3">
            <ModeButton active={mode === 'local'} icon={<Lock size={17} />} label="本地" onClick={() => setMode('local')} />
            <ModeButton active={mode === 'cloud'} icon={<Wifi size={17} />} label="云端" onClick={() => setMode('cloud')} />
          </section>

          <section className="mt-3 rounded-[22px] bg-white/70 p-4 shadow-[0_12px_28px_rgba(91,72,72,0.08),0_0_0_1px_rgba(255,255,255,0.78)]">
            <p className="text-xs font-black text-[#a38189]">背景色</p>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {BG_COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  aria-label={color.label}
                  onClick={() => setBgColor(color.value)}
                  className={`h-9 rounded-[14px] border-2 ${bgColor === color.value ? 'border-[#76506f]' : 'border-white/80'}`}
                  style={color.value === 'transparent' ? checkerboard : { backgroundColor: color.value }}
                />
              ))}
            </div>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" disabled={!activeImage || state === 'processing'} onClick={processActive} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-[18px] bg-[#6f536b] text-sm font-black text-white disabled:opacity-45">
              {state === 'processing' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {state === 'processing' ? `处理中 ${progress}%` : '开始抠图'}
            </button>
            <button type="button" disabled={!resultUrl} onClick={() => download('png')} className="flex h-11 items-center justify-center gap-2 rounded-[16px] bg-white/74 text-xs font-black text-[#5f775b] disabled:opacity-45">
              <FileImage size={16} />
              下载 PNG
            </button>
            <button type="button" disabled={!resultUrl} onClick={() => download('jpg')} className="flex h-11 items-center justify-center gap-2 rounded-[16px] bg-white/74 text-xs font-black text-[#4f6b7a] disabled:opacity-45">
              <ImageDown size={16} />
              下载 JPG
            </button>
          </section>

          {message && (
            <section className={`mt-3 flex gap-2 rounded-[18px] p-3 text-xs font-bold leading-5 ${state === 'error' ? 'bg-red-50 text-red-700' : 'bg-white/70 text-[#7d6965]'}`}>
              {state === 'error' ? <AlertCircle className="mt-0.5 shrink-0" size={16} /> : <Check className="mt-0.5 shrink-0" size={16} />}
              <p>{message}</p>
            </section>
          )}

          {images.length > 0 && (
            <section className="mt-3 rounded-[22px] bg-white/70 p-3 shadow-[0_12px_28px_rgba(91,72,72,0.08),0_0_0_1px_rgba(255,255,255,0.78)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black text-[#a38189]">图片队列</p>
                <button type="button" onClick={resetAll} className="inline-flex items-center gap-1 text-xs font-black text-[#b45f5f]">
                  <RotateCcw size={13} />
                  清空
                </button>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {images.map(image => (
                  <button key={image.id} type="button" onClick={() => setActiveId(image.id)} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[16px] border-2 ${activeImage?.id === image.id ? 'border-[#76506f]' : 'border-white/80'}`}>
                    <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                    {results[image.id] && <span className="absolute bottom-1 left-1 rounded-full bg-[#5f775b] px-1.5 py-0.5 text-[10px] font-black text-white">完成</span>}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="删除图片"
                      onClick={event => {
                        event.stopPropagation();
                        removeImage(image.id);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') removeImage(image.id);
                      }}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white"
                    >
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={event => addFiles(event.target.files)} />
    </main>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-11 items-center justify-center gap-2 rounded-[17px] text-sm font-black shadow-[0_10px_24px_rgba(91,72,72,0.08)] ${active ? 'bg-[#6f536b] text-white' : 'bg-white/74 text-[#8b7471]'}`}>
      {icon}
      {label}
    </button>
  );
}

function ImagePreview({ originalUrl, resultUrl, bgColor }: { originalUrl: string; resultUrl: string | null; bgColor: string }) {
  return (
    <div className="relative flex min-h-[280px] items-center justify-center" style={bgColor === 'transparent' ? checkerboard : { backgroundColor: bgColor }}>
      <img src={resultUrl || originalUrl} alt={resultUrl ? '处理结果' : '原图预览'} className="max-h-[420px] w-full object-contain" />
      {resultUrl && (
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white">
          已去背景
        </div>
      )}
    </div>
  );
}
