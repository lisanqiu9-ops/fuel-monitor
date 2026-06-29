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
  Sparkles,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

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

const pressClass = 'transition-transform duration-150 ease-out active:scale-[0.96]';
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

  const stageText = state === 'processing' ? '正在处理' : state === 'done' ? '处理完成' : state === 'error' ? '处理失败' : '等待上传图片';

  return (
    <main className="h-dvh overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f1edf6_55%,#f8f1ea_100%)] text-[#403632] antialiased">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        <header className="shrink-0 px-4 pb-2 pt-[calc(12px+env(safe-area-inset-top,0px))]">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
            <button
              type="button"
              onClick={onBackToToolbox}
              className={cn('grid h-11 w-11 place-items-center rounded-full bg-white/78 text-[#7b6662] shadow-[0_10px_24px_rgba(91,72,72,0.10),0_0_0_1px_rgba(255,255,255,0.78)]', pressClass)}
              aria-label="返回三秋工具箱"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-black leading-4 text-[#a38189]">图片工具</p>
              <h1 className="truncate text-lg font-black leading-6 text-balance">AI 抠图去背景</h1>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn('grid h-11 w-11 place-items-center rounded-full bg-[#ead7ea] text-[#76506f] shadow-[0_10px_24px_rgba(118,80,111,0.16)]', pressClass)}
              aria-label="添加图片"
            >
              <Upload size={19} />
            </button>
          </div>
        </header>

        <section className="shrink-0 px-4 pb-3">
          <div className="rounded-[28px] bg-white/82 p-3 shadow-[0_18px_42px_rgba(91,72,72,0.12),0_0_0_1px_rgba(255,255,255,0.84)] backdrop-blur">
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-xs font-black text-[#a38189]">{stageText}</p>
                <p className="mt-1 truncate text-sm font-bold text-[#7d6965]">
                  {activeImage ? `${activeImage.name} · ${formatSize(activeImage.size)}` : '支持 JPG、PNG、WebP，单张不超过 20MB'}
                </p>
              </div>
              {state === 'processing' && <span className="shrink-0 text-sm font-black tabular-nums text-[#76506f]">{progress}%</span>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ModeButton active={mode === 'local'} icon={<Lock size={17} />} label="本地" onClick={() => setMode('local')} />
              <ModeButton active={mode === 'cloud'} icon={<Wifi size={17} />} label="云端" onClick={() => setMode('cloud')} />
            </div>

            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
              <button
                type="button"
                disabled={!activeImage || state === 'processing'}
                onClick={processActive}
                className={cn(
                  'flex h-11 min-w-0 items-center justify-center gap-2 rounded-[17px] bg-[#6f536b] pl-4 pr-3.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(111,83,107,0.20)] disabled:bg-[#c7b7c1] disabled:text-white/70',
                  pressClass,
                )}
              >
                {state === 'processing' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                <span className="truncate">{state === 'processing' ? '处理中' : '开始抠图'}</span>
              </button>
              <IconActionButton label="下载 PNG" disabled={!resultUrl} onClick={() => download('png')} icon={<FileImage size={17} />} tone="green" />
              <IconActionButton label="下载 JPG" disabled={!resultUrl} onClick={() => download('jpg')} icon={<ImageDown size={17} />} tone="blue" />
            </div>

            {state === 'processing' && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e6ddd8]">
                <div className="h-full rounded-full bg-[#76506f] transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 flex-1 px-4 pb-3">
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
            className={cn(
              'grid h-full min-h-[260px] overflow-hidden rounded-[30px] bg-white/74 p-3 shadow-[0_18px_42px_rgba(91,72,72,0.11),0_0_0_1px_rgba(255,255,255,0.84)] backdrop-blur transition-[box-shadow,scale] duration-150 ease-out',
              isDragOver && 'scale-[1.01] shadow-[0_20px_48px_rgba(118,80,111,0.18),0_0_0_2px_rgba(118,80,111,0.30)]',
            )}
          >
            {activeImage ? (
              <ImagePreview originalUrl={activeImage.url} resultUrl={resultUrl} bgColor={bgColor} />
            ) : (
              <div className="grid h-full place-items-center rounded-[22px] bg-[#f4ece7] px-6 text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white/86 text-[#76506f] shadow-[0_12px_28px_rgba(91,72,72,0.10)]">
                    <Upload size={28} />
                  </div>
                  <p className="mt-4 text-base font-black text-balance">拖拽图片到这里</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#8b7471] text-pretty">或点击选择文件开始去背景。</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="shrink-0 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <div className="rounded-[26px] bg-white/78 p-3 shadow-[0_14px_34px_rgba(91,72,72,0.10),0_0_0_1px_rgba(255,255,255,0.82)] backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-black text-[#a38189]">背景</span>
              <div className="grid flex-1 grid-cols-6 gap-1.5">
                {BG_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    aria-label={color.label}
                    onClick={() => setBgColor(color.value)}
                    className={cn('h-9 rounded-[13px] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]', bgColor === color.value && 'shadow-[0_0_0_2px_rgba(118,80,111,0.82)]', pressClass)}
                    style={color.value === 'transparent' ? checkerboard : { backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>

            {(message || images.length > 0) && (
              <div className="mt-3 border-t border-[#eadfda] pt-3">
                {message && (
                  <div className={`mb-3 flex gap-2 rounded-[18px] px-3 py-2 text-xs font-bold leading-5 text-pretty ${state === 'error' ? 'bg-red-50 text-red-700' : 'bg-[#f7efe9] text-[#7d6965]'}`}>
                    {state === 'error' ? <AlertCircle className="mt-0.5 shrink-0" size={16} /> : <Check className="mt-0.5 shrink-0" size={16} />}
                    <p>{message}</p>
                  </div>
                )}

                {images.length > 0 && (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-black text-[#a38189]">图片队列</p>
                      <button type="button" onClick={resetAll} className={cn('inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-xs font-black text-[#b45f5f]', pressClass)}>
                        <RotateCcw size={13} />
                        清空
                      </button>
                    </div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto">
                      {images.map(image => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setActiveId(image.id)}
                          className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-[15px] outline outline-1 -outline-offset-1 outline-black/10 transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.96]', activeImage?.id === image.id && 'shadow-[0_0_0_2px_rgba(118,80,111,0.82)]')}
                        >
                          <img src={image.url} alt={image.name} className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10" />
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
                            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/58 text-white"
                          >
                            <X size={12} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </footer>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={event => addFiles(event.target.files)} />
    </main>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-10 min-w-0 items-center justify-center gap-2 rounded-[15px] text-sm font-black shadow-[0_8px_18px_rgba(91,72,72,0.08)] transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]',
        active ? 'bg-[#6f536b] text-white' : 'bg-[#f7efe9] text-[#8b7471]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IconActionButton({ disabled, icon, label, onClick, tone }: { disabled: boolean; icon: ReactNode; label: string; onClick: () => void; tone: 'green' | 'blue' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-[16px] bg-[#f7efe9] shadow-[0_8px_18px_rgba(91,72,72,0.08)] transition-[scale,opacity] duration-150 ease-out active:scale-[0.96] disabled:opacity-40',
        tone === 'green' ? 'text-[#5f775b]' : 'text-[#4f6b7a]',
      )}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function ImagePreview({ originalUrl, resultUrl, bgColor }: { originalUrl: string; resultUrl: string | null; bgColor: string }) {
  return (
    <div className="relative flex h-full min-h-[250px] items-center justify-center overflow-hidden rounded-[22px]" style={bgColor === 'transparent' ? checkerboard : { backgroundColor: bgColor }}>
      <img src={resultUrl || originalUrl} alt={resultUrl ? '处理结果' : '原图预览'} className="max-h-full w-full object-contain outline outline-1 -outline-offset-1 outline-black/10" />
      {resultUrl && (
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
          已去背景
        </div>
      )}
    </div>
  );
}
