import { useEffect, useMemo, useState, type ComponentType, type Key } from 'react';
import { Baby, BookOpenCheck, Car, ChevronRight, Images, Search, Sparkles, WalletCards } from 'lucide-react';
import FuelApp from './apps/fuel/FuelApp';
import BabyStoryApp from './apps/babyStory/BabyStoryApp';
import LedgerApp from './apps/ledger/LedgerApp';
import GuidesApp from './apps/guides/GuidesApp';
import ImageRemoverApp from './apps/imageRemover/ImageRemoverApp';
import { cn } from './lib/utils';

type RoutePath = '/' | '/fuel' | '/baby-story' | '/ledger' | '/guides' | '/image-remover';
type ToolCategory = '记录' | '创作' | '知识' | '图片';

type ToolboxTool = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  icon: ComponentType<{ size?: number; className?: string }>;
  path: RoutePath;
  tone: string;
};

const basePath = (() => {
  const base = import.meta.env.BASE_URL || '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
})();

const stripBasePath = (pathname: string) => (basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname);
const normalizePath = (pathname: string): RoutePath => {
  const path = stripBasePath(pathname);
  if (path.startsWith('/fuel')) return '/fuel';
  if (path.startsWith('/baby-story')) return '/baby-story';
  if (path.startsWith('/ledger')) return '/ledger';
  if (path.startsWith('/guides')) return '/guides';
  if (path.startsWith('/image-remover')) return '/image-remover';
  return '/';
};
const toBrowserPath = (path: RoutePath) => `${basePath}${path === '/' ? '/' : path}`;
const navigateTo = (path: RoutePath) => {
  const next = toBrowserPath(path);
  if (window.location.pathname !== next) {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

export default function App() {
  const [route, setRoute] = useState<RoutePath>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route === '/fuel') return <FuelApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/baby-story') return <BabyStoryApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/ledger') return <LedgerApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/guides') return <GuidesApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/image-remover') return <ImageRemoverApp onBackToToolbox={() => navigateTo('/')} />;
  return <ToolboxHome />;
}

function ToolboxHome() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ToolCategory | '全部'>('全部');

  const fuelStatus = useMemo(() => {
    try {
      const raw = localStorage.getItem('fuellog_records');
      const parsed = raw ? JSON.parse(raw) : [];
      const count = Array.isArray(parsed) ? parsed.length : Array.isArray(parsed?.records) ? parsed.records.length : 0;
      const cloudReady = Boolean(localStorage.getItem('sanqiu-fuel-access-key')?.trim());
      return `${count} 条记录 · 云端${cloudReady ? '已连接' : '未连接'}`;
    } catch {
      return '本地记录 · 云端待检查';
    }
  }, []);

  const babyStoryStatus = useMemo(() => {
    try {
      const stories = JSON.parse(localStorage.getItem('babyStory:stories:v1') || '[]');
      const config = JSON.parse(localStorage.getItem('babyStory:voiceRuntime:v1') || '{}');
      const latest = Array.isArray(stories) ? stories[0] : null;
      const isToday = latest?.createdAt ? new Date(latest.createdAt).toDateString() === new Date().toDateString() : false;
      const voice = config.realVoiceEnabled ? '真实朗读' : '本地兜底';
      return `${isToday ? '今日已生成' : '今日未生成'} · ${voice}`;
    } catch {
      return '故事本地保存 · 朗读待检查';
    }
  }, []);

  const ledgerStatus = useMemo(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('sanqiu-ledger-cache') || 'null');
      if (!cache?.records?.length) return '未导入 ledger.csv';
      const issueCount = Number(cache.parserIssues?.length || 0) + Number(cache.missingFields?.length || 0);
      return `${cache.records.length} 条流水 · ${issueCount ? `${issueCount} 项待检查` : '字段正常'}`;
    } catch {
      return '本地 CSV · 状态待检查';
    }
  }, []);

  const imageRemoverStatus = useMemo(() => {
    const cloudReady = Boolean(import.meta.env.VITE_REMOVE_BG_KEY);
    return `本地优先 · 云端${cloudReady ? '可用' : '未配置'}`;
  }, []);

  const tools = useMemo<ToolboxTool[]>(
    () => [
      {
        id: 'fuel',
        title: '油耗监控',
        subtitle: '加油记录与费用趋势',
        status: fuelStatus,
        description: '记录每次加油，查看油耗变化和用车成本。',
        category: '记录',
        keywords: ['油耗', '加油', '车辆', '费用', 'OCR'],
        icon: Car,
        path: '/fuel',
        tone: 'bg-[#e8eadf] text-[#5f6d58]',
      },
      {
        id: 'baby-story',
        title: '胎教故事助手',
        subtitle: '故事生成与合成朗读',
        status: babyStoryStatus,
        description: '每天为宝宝生成一篇小故事，并用选择的声音朗读。',
        category: '创作',
        keywords: ['胎教', '故事', '朗读', 'AI', '宝宝'],
        icon: Baby,
        path: '/baby-story',
        tone: 'bg-[#ead7ea] text-[#76506f]',
      },
      {
        id: 'ledger',
        title: '本地记账',
        subtitle: 'CSV 导入与消费看板',
        status: ledgerStatus,
        description: '导入 ledger.csv，查看月度支出、分类和异常数据。',
        category: '记录',
        keywords: ['记账', 'CSV', '流水', '消费', '支出'],
        icon: WalletCards,
        path: '/ledger',
        tone: 'bg-[#dfece0] text-[#5f775b]',
      },
      {
        id: 'guides',
        title: '海外服务指南',
        subtitle: 'Google / Apple ID 教程',
        status: '5 篇教程 · 风险提示优先',
        description: '整理海外数字服务注册、订阅支付和账号安全排查。',
        category: '知识',
        keywords: ['Google', 'Apple ID', 'ChatGPT', 'Gemini', '教程', '安全'],
        icon: BookOpenCheck,
        path: '/guides',
        tone: 'bg-[#dfe8ee] text-[#4f6b7a]',
      },
      {
        id: 'image-remover',
        title: 'AI 抠图去背景',
        subtitle: '透明底与换底色下载',
        status: imageRemoverStatus,
        description: '上传图片后在浏览器内移除背景，支持透明 PNG、白底 JPG 和多图队列。',
        category: '图片',
        keywords: ['抠图', '去背景', '图片', '透明', 'PNG', 'JPG', 'AI'],
        icon: Images,
        path: '/image-remover',
        tone: 'bg-[#ead7ea] text-[#76506f]',
      },
    ],
    [babyStoryStatus, fuelStatus, imageRemoverStatus, ledgerStatus],
  );

  const categories = useMemo(() => ['全部', '记录', '创作', '知识', '图片'] as const, []);
  const filteredTools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tools.filter(tool => {
      const matchesCategory = category === '全部' || tool.category === category;
      if (!matchesCategory) return false;
      if (!needle) return true;
      return [tool.title, tool.subtitle, tool.description, tool.status, tool.category, ...tool.keywords].join(' ').toLowerCase().includes(needle);
    });
  }, [category, query, tools]);

  return (
    <main className="h-dvh overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_52%,#f8f1ea_100%)] text-[#403632] antialiased">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        <header className="shrink-0 px-5 pb-3 pt-[calc(18px+env(safe-area-inset-top,0px))]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex h-8 items-center gap-2 rounded-full bg-white/72 px-3 text-xs font-black text-[#8d7470] shadow-[0_8px_20px_rgba(91,72,72,0.08),0_0_0_1px_rgba(255,255,255,0.78)]">
                <Sparkles size={14} />
                个人工具箱 PWA
              </div>
              <h1 className="mt-3 text-2xl font-black leading-8 tracking-normal text-balance">三秋工具箱</h1>
            </div>
            <div className="rounded-[20px] bg-white/70 px-3 py-2 text-right shadow-[0_8px_20px_rgba(91,72,72,0.08),0_0_0_1px_rgba(255,255,255,0.78)]">
              <p className="text-[10px] font-black text-[#a38189]">已接入</p>
              <p className="mt-0.5 text-lg font-black leading-5 tabular-nums">{tools.length}</p>
            </div>
          </div>

          <label className="mt-4 flex h-11 items-center gap-3 rounded-[20px] bg-white/76 px-3 text-[#8b7471] shadow-[0_12px_28px_rgba(91,72,72,0.09),0_0_0_1px_rgba(255,255,255,0.82)]">
            <Search size={18} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索工具、场景或服务"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#403632] outline-none placeholder:text-[#ad9691]"
            />
          </label>

          <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="工具分类">
            {categories.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  'h-10 shrink-0 rounded-[18px] px-4 text-xs font-black transition-[transform,background-color,color,box-shadow] active:scale-[0.96]',
                  category === item ? 'bg-[#6f536b] text-white shadow-[0_8px_18px_rgba(111,83,107,0.22)]' : 'bg-white/70 text-[#8b7471] shadow-[0_0_0_1px_rgba(255,255,255,0.74)]',
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        </header>

        <section className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(26px+env(safe-area-inset-bottom,0px))]">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-[#403632]">工具入口</h2>
            <span className="text-xs font-black text-[#a38189] tabular-nums">{filteredTools.length} / {tools.length}</span>
          </div>

          {filteredTools.length ? (
            <section className="grid grid-cols-2 gap-3">
              {filteredTools.map(tool => <ToolLauncher key={tool.id} tool={tool} onOpen={() => navigateTo(tool.path)} />)}
            </section>
          ) : (
            <section className="rounded-[24px] bg-white/76 p-5 text-center shadow-[0_14px_34px_rgba(91,72,72,0.09),0_0_0_1px_rgba(255,255,255,0.82)]">
              <Search className="mx-auto text-[#a38189]" size={24} />
              <h2 className="mt-3 text-base font-black text-balance">没有找到匹配工具</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#8b7471] text-pretty">换个关键词，或切回“全部”分类查看所有入口。</p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function ToolLauncher({ tool, onOpen }: { tool: ToolboxTool; onOpen: () => void; key?: Key }) {
  const Icon = tool.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[150px] flex-col rounded-[24px] bg-white/80 p-3 text-left shadow-[0_14px_34px_rgba(91,72,72,0.10),0_0_0_1px_rgba(255,255,255,0.82)] backdrop-blur transition-[transform,box-shadow] active:scale-[0.96]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[17px]', tool.tone)}>
          <Icon size={22} />
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f5ede8] text-[#8b7471] transition-transform group-active:translate-x-0.5">
          <ChevronRight size={17} />
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <h2 className="text-[15px] font-black leading-5 text-balance">{tool.title}</h2>
        <p className="mt-1 line-clamp-1 text-[11px] font-black leading-4 text-[#a38189] text-pretty">{tool.subtitle}</p>
      </div>
      <div className="mt-auto pt-3">
        <p className="truncate rounded-[16px] bg-[#f7efe9] px-3 py-2 text-[11px] font-black text-[#7d6965]">{tool.status}</p>
      </div>
    </button>
  );
}
