import { useEffect, useMemo, useState } from 'react';
import { Baby, Car, ChevronRight, Sparkles, Wrench } from 'lucide-react';
import FuelApp from './apps/fuel/FuelApp';
import BabyStoryApp from './apps/babyStory/BabyStoryApp';
import { cn } from './lib/utils';

type RoutePath = '/' | '/fuel' | '/baby-story';

const basePath = (() => {
  const base = import.meta.env.BASE_URL || '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
})();

const stripBasePath = (pathname: string) => {
  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname;
};

const normalizePath = (pathname: string): RoutePath => {
  const appPath = stripBasePath(pathname);
  if (appPath.startsWith('/fuel')) return '/fuel';
  if (appPath.startsWith('/baby-story')) return '/baby-story';
  return '/';
};

const toBrowserPath = (path: RoutePath) => `${basePath}${path === '/' ? '/' : path}`;

const navigateTo = (path: RoutePath) => {
  const nextPath = toBrowserPath(path);
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

export default function App() {
  const [route, setRoute] = useState<RoutePath>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route === '/fuel') {
    return <FuelApp onBackToToolbox={() => navigateTo('/')} />;
  }

  if (route === '/baby-story') {
    return <BabyStoryApp onBackToToolbox={() => navigateTo('/')} />;
  }

  return <ToolboxHome />;
}

function ToolboxHome() {
  const tools = useMemo(
    () => [
      {
        id: 'fuel',
        title: '油耗监控',
        subtitle: '记录加油、油耗趋势、费用分析',
        description: '管理每次加油记录，查看油耗变化和用车成本。',
        icon: Car,
        path: '/fuel' as RoutePath,
        tone: 'bg-[#e8eadf] text-[#5f6d58]',
      },
      {
        id: 'baby-story',
        title: '胎教故事助手',
        subtitle: '生成胎教故事、选择音色、合成朗读',
        description: '每天为宝宝写一篇柔软小故事，并用选择的声音朗读。',
        icon: Baby,
        path: '/baby-story' as RoutePath,
        tone: 'bg-[#ead7ea] text-[#76506f]',
      },
    ],
    [],
  );

  return (
    <main className="soft-scrollbar h-dvh overflow-y-auto bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_52%,#f8f1ea_100%)] px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-[calc(28px+env(safe-area-inset-top,0px))] text-[#403632]">
      <div className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-md flex-col">
        <header className="mb-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/70 px-3 py-2 text-xs font-black text-[#8d7470] shadow-sm">
            <Sparkles size={15} />
            个人工具集 PWA
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-normal">三秋工具箱</h1>
          <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-[#8b7471]">
            一个入口放下日常小工具。当前包含油耗监控和胎教故事助手，后续新增工具只需要追加应用目录和首页卡片。
          </p>
        </header>

        <section className="space-y-4">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => navigateTo(tool.path)}
                className="group w-full rounded-[28px] border border-white/80 bg-white/78 p-4 text-left shadow-[0_16px_36px_rgba(91,72,72,0.10)] backdrop-blur transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-3xl', tool.tone)}>
                    <Icon size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black">{tool.title}</h2>
                        <p className="mt-1 text-xs font-black text-[#a38189]">{tool.subtitle}</p>
                      </div>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5ede8] text-[#8b7471] transition group-active:translate-x-0.5">
                        <ChevronRight size={18} />
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#7d6965]">{tool.description}</p>
                    <span className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#6f536b] px-4 text-sm font-black text-white">
                      进入{tool.title}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <footer className="mt-auto pt-8 text-center text-xs font-bold leading-6 text-[#aa918e]">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-2">
            <Wrench size={14} />
            本地优先，无账号，无云同步
          </div>
        </footer>
      </div>
    </main>
  );
}
