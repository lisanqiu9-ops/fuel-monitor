import { useEffect, useMemo, useState } from 'react';
import { Baby, Car, ChevronRight, Sparkles, WalletCards, Wrench } from 'lucide-react';
import FuelApp from './apps/fuel/FuelApp';
import BabyStoryApp from './apps/babyStory/BabyStoryApp';
import LedgerApp from './apps/ledger/LedgerApp';
import { cn } from './lib/utils';

type RoutePath = '/' | '/fuel' | '/baby-story' | '/ledger';
const basePath = (() => { const base = import.meta.env.BASE_URL || '/'; return base === '/' ? '' : base.replace(/\/$/, ''); })();
const stripBasePath = (pathname: string) => basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname;
const normalizePath = (pathname: string): RoutePath => { const path = stripBasePath(pathname); if (path.startsWith('/fuel')) return '/fuel'; if (path.startsWith('/baby-story')) return '/baby-story'; if (path.startsWith('/ledger')) return '/ledger'; return '/'; };
const toBrowserPath = (path: RoutePath) => `${basePath}${path === '/' ? '/' : path}`;
const navigateTo = (path: RoutePath) => { const next = toBrowserPath(path); if (window.location.pathname !== next) { window.history.pushState({}, '', next); window.dispatchEvent(new PopStateEvent('popstate')); } };

export default function App() {
  const [route, setRoute] = useState<RoutePath>(() => normalizePath(window.location.pathname));
  useEffect(() => { const onPopState = () => setRoute(normalizePath(window.location.pathname)); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  if (route === '/fuel') return <FuelApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/baby-story') return <BabyStoryApp onBackToToolbox={() => navigateTo('/')} />;
  if (route === '/ledger') return <LedgerApp onBackToToolbox={() => navigateTo('/')} />;
  return <ToolboxHome />;
}

function ToolboxHome() {
  const fuelStatus = useMemo(() => {
    try {
      const raw = localStorage.getItem('fuellog_records');
      const parsed = raw ? JSON.parse(raw) : [];
      const count = Array.isArray(parsed) ? parsed.length : Array.isArray(parsed?.records) ? parsed.records.length : 0;
      const ocrReady = Boolean(localStorage.getItem('cf_worker_url')?.trim());
      return `${count} 条记录 · OCR ${ocrReady ? '已配置' : '未配置'}`;
    } catch {
      return '本地记录 · OCR 待检查';
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

  const tools = useMemo(() => [
    { id: 'fuel', title: '油耗监控', subtitle: '记录加油、油耗趋势、费用分析', status: fuelStatus, description: '管理每次加油记录，查看油耗变化和用车成本。', icon: Car, path: '/fuel' as RoutePath, tone: 'bg-[#e8eadf] text-[#5f6d58]' },
    { id: 'baby-story', title: '胎教故事助手', subtitle: '生成胎教故事、选择音色、合成朗读', status: babyStoryStatus, description: '每天为宝宝写一篇柔软小故事，并用选择的声音朗读。', icon: Baby, path: '/baby-story' as RoutePath, tone: 'bg-[#ead7ea] text-[#76506f]' },
    { id: 'ledger', title: '本地记账', subtitle: 'CSV导入、消费看板、数据质量检查', status: ledgerStatus, description: '导入快捷指令生成的 ledger.csv，查看月度支出、分类占比、商户排行和异常数据。', icon: WalletCards, path: '/ledger' as RoutePath, tone: 'bg-[#dfece0] text-[#5f775b]' },
  ], [babyStoryStatus, fuelStatus, ledgerStatus]);

  return <main className="soft-scrollbar h-dvh overflow-y-auto bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_52%,#f8f1ea_100%)] px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-[calc(28px+env(safe-area-inset-top,0px))] text-[#403632]"><div className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-md flex-col"><header className="mb-7"><div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/70 px-3 py-2 text-xs font-black text-[#8d7470] shadow-sm"><Sparkles size={15} />个人工具箱 PWA</div><h1 className="mt-4 text-3xl font-black tracking-normal">三秋工具箱</h1><p className="mt-3 max-w-sm text-sm font-bold leading-6 text-[#8b7471]">一个入口放下日常小工具：本地数据保存在当前设备，云端服务仅用于 OCR、AI 生成或朗读。</p></header><section className="space-y-4">{tools.map(tool => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={() => navigateTo(tool.path)} className="group w-full rounded-[28px] border border-white/80 bg-white/78 p-4 text-left shadow-[0_16px_36px_rgba(91,72,72,0.10)] backdrop-blur transition active:scale-[0.99]"><div className="flex items-start gap-4"><div className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-3xl', tool.tone)}><Icon size={28} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">{tool.title}</h2><p className="mt-1 text-xs font-black text-[#a38189]">{tool.subtitle}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5ede8] text-[#8b7471] transition group-active:translate-x-0.5"><ChevronRight size={18} /></span></div><p className="mt-3 rounded-2xl bg-[#f7efe9] px-3 py-2 text-xs font-black text-[#7d6965]">{tool.status}</p><p className="mt-3 text-sm font-semibold leading-6 text-[#7d6965]">{tool.description}</p><span className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#6f536b] px-4 text-sm font-black text-white">进入{tool.title}</span></div></div></button>; })}</section><footer className="mt-auto pt-8 text-center text-xs font-bold leading-6 text-[#aa918e]"><div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-2"><Wrench size={14} />本地优先，备份迁移由你掌握</div></footer></div></main>;
}
