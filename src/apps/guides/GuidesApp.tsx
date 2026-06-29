import { useEffect, useMemo, useState, type Key, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Filter,
  Info,
  PackageOpen,
  Search,
  ShieldAlert,
  Star,
  Tags,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { guideArticles, type GuideArticle, type GuideImage } from './guidesData';

const basePath = (() => {
  const base = import.meta.env.BASE_URL || '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
})();

const stripBasePath = (pathname: string) => (basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname);
const articlePath = (id: string) => `${basePath}/guides/?article=${encodeURIComponent(id)}`;
const guidesPath = () => `${basePath}/guides/`;
const assetUrl = (src?: string) => {
  if (!src) return `${basePath}/guides-assets/placeholder.svg`;
  if (/^https?:\/\//.test(src)) return src;
  return `${basePath}/guides-assets/${src.replace(/^assets\//, '')}`;
};

function readArticleId() {
  const query = new URLSearchParams(window.location.search).get('article');
  if (query) return query;
  const match = stripBasePath(window.location.pathname).match(/^\/guides\/([^/]+)\/?$/);
  return match?.[1] || '';
}

function pushUrl(url: string) {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function riskTone(risk?: string) {
  if (risk === '高') return 'bg-[#fee8df] text-[#ad4f3b]';
  if (risk === '中') return 'bg-[#fff1d5] text-[#8d6420]';
  return 'bg-[#e8f0df] text-[#5f6d58]';
}

export default function GuidesApp({ onBackToToolbox }: { onBackToToolbox: () => void }) {
  const [selectedId, setSelectedId] = useState(() => readArticleId());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');

  useEffect(() => {
    const onPopState = () => setSelectedId(readArticleId());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const categories = useMemo(() => ['全部', ...Array.from(new Set(guideArticles.map(article => article.category || '其他')))], []);
  const selectedArticle = useMemo(() => guideArticles.find(article => article.id === selectedId), [selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guideArticles
      .filter(article => category === '全部' || article.category === category)
      .filter(article => {
        if (!needle) return true;
        const haystack = [article.title, article.description, article.summary, article.category, ...(article.tags || []), ...(article.keywords || [])].join(' ').toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.recommended) - Number(a.recommended) || (a.order || 99) - (b.order || 99));
  }, [category, query]);

  if (selectedArticle) {
    return <ArticleView article={selectedArticle} onBack={() => pushUrl(guidesPath())} onBackToToolbox={onBackToToolbox} />;
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-[#f8f1ea] text-[#403632]">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_56%,#f8f1ea_100%)] shadow-2xl">
        <header className="shrink-0 px-5 pb-3 pt-[calc(18px+env(safe-area-inset-top,0px))]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-black text-[#8d7470] shadow-sm ring-1 ring-white/80">
                <BookOpenCheck size={15} />
                公开教程知识库
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-normal [text-wrap:balance]">海外服务指南</h1>
            </div>
            <button
              type="button"
              onClick={onBackToToolbox}
              title="返回三秋工具箱"
              aria-label="返回三秋工具箱"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/75 text-[#403632] shadow-[0_10px_22px_rgba(42,39,35,0.08)] ring-1 ring-white/80 transition-transform active:scale-[0.96]"
            >
              <PackageOpen size={19} />
            </button>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-[#8b7471] [text-wrap:pretty]">整理 Google、Apple ID、ChatGPT、Gemini 等海外数字服务的注册、地区设置、订阅支付和账号安全排查。</p>
        </header>

        <section className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
          <div className="sticky top-0 z-10 -mx-5 bg-gradient-to-b from-[#fffaf2] via-[#fffaf2]/95 to-[#fffaf2]/0 px-5 pb-3 pt-1">
            <div className="rounded-[28px] bg-white/78 p-3 shadow-[0_16px_36px_rgba(91,72,72,0.11)] ring-1 ring-white/80 backdrop-blur">
              <label className="flex h-11 items-center gap-3 rounded-[20px] bg-[#f4ece6] px-3 text-[#8b7471]">
                <Search size={18} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="搜索 Google、Apple ID、订阅、安全"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#403632] outline-none placeholder:text-[#ad9691]"
                />
              </label>
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="教程分类">
                {categories.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={cn(
                      'h-10 shrink-0 rounded-[18px] px-4 text-xs font-black transition-[transform,background-color,color,box-shadow] active:scale-[0.96]',
                      category === item ? 'bg-[#6f536b] text-white shadow-[0_8px_18px_rgba(111,83,107,0.22)]' : 'bg-[#fbf6f1] text-[#8b7471]',
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between px-1 text-xs font-black text-[#a38189]">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Filter size={14} />
              {filtered.length} 篇教程
            </span>
            <span>风险提示优先</span>
          </div>

          <section className="space-y-3">
            {filtered.map(article => <ArticleCard key={article.id} article={article} onOpen={() => pushUrl(articlePath(article.id))} />)}
          </section>
        </section>
      </div>
    </main>
  );
}

function ArticleCard({ article, onOpen }: { article: GuideArticle; onOpen: () => void; key?: Key }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-[28px] bg-white/80 text-left shadow-[0_16px_36px_rgba(91,72,72,0.10)] ring-1 ring-white/80 backdrop-blur transition-transform active:scale-[0.96]"
    >
      <div className="aspect-[16/8.5] w-full overflow-hidden bg-[#efe5dd] outline outline-1 outline-black/10">
        <img src={assetUrl(article.cover || article.coverFallback)} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>{article.category || '教程'}</Badge>
              <span className={cn('rounded-full px-2 py-1 text-[11px] font-black', riskTone(article.riskLevel))}>{article.riskLevel || '低'}风险</span>
              {article.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#efe6fb] px-2 py-1 text-[11px] font-black text-[#76506f]">
                  <Star size={12} />
                  推荐
                </span>
              )}
            </div>
            <h2 className="text-lg font-black leading-6 text-[#403632] [text-wrap:balance]">{article.title}</h2>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f5ede8] text-[#8b7471] transition-transform group-active:translate-x-0.5">
            <ChevronRight size={18} />
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#7d6965] [text-wrap:pretty]">{article.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-[#9a817e]">
          <span className="rounded-full bg-[#f7efe9] px-2 py-1 tabular-nums">{article.updatedAt || '持续更新'}</span>
          <span className="rounded-full bg-[#f7efe9] px-2 py-1">{article.duration || '快速阅读'}</span>
          <span className="rounded-full bg-[#f7efe9] px-2 py-1">{article.difficulty || '简单'}</span>
        </div>
      </div>
    </button>
  );
}

function ArticleView({ article, onBack, onBackToToolbox }: { article: GuideArticle; onBack: () => void; onBackToToolbox: () => void }) {
  return (
    <main className="h-[100svh] overflow-hidden bg-[#f8f1ea] text-[#403632]">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_56%,#f8f1ea_100%)] shadow-2xl">
        <header className="shrink-0 px-5 pb-3 pt-[calc(18px+env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              title="返回指南列表"
              aria-label="返回指南列表"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/75 text-[#403632] shadow-[0_10px_22px_rgba(42,39,35,0.08)] ring-1 ring-white/80 transition-transform active:scale-[0.96]"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-xs font-black text-[#9a817e]">{article.category || '教程'}</p>
              <h1 className="mt-1 truncate text-base font-black">海外服务指南</h1>
            </div>
            <button
              type="button"
              onClick={onBackToToolbox}
              title="返回三秋工具箱"
              aria-label="返回三秋工具箱"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/75 text-[#403632] shadow-[0_10px_22px_rgba(42,39,35,0.08)] ring-1 ring-white/80 transition-transform active:scale-[0.96]"
            >
              <PackageOpen size={19} />
            </button>
          </div>
        </header>

        <article className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))]">
          <header className="overflow-hidden rounded-[28px] bg-white/80 shadow-[0_16px_38px_rgba(91,72,72,0.10)] ring-1 ring-white/80">
            <img src={assetUrl(article.cover || article.coverFallback)} alt="" className="h-48 w-full object-cover outline outline-1 outline-black/10" />
            <div className="p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>{article.category || '教程'}</Badge>
                <span className={cn('rounded-full px-2 py-1 text-[11px] font-black', riskTone(article.riskLevel))}>{article.riskLevel || '低'}风险</span>
              </div>
              <h2 className="text-2xl font-black leading-8 [text-wrap:balance]">{article.title}</h2>
              <p className="mt-3 text-sm font-bold leading-6 text-[#7d6965] [text-wrap:pretty]">{article.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-[#9a817e]">
                <span className="rounded-full bg-[#f7efe9] px-2 py-1 tabular-nums">更新：{article.updatedAt || '持续更新'}</span>
                <span className="rounded-full bg-[#f7efe9] px-2 py-1">{article.duration || '快速阅读'}</span>
              </div>
            </div>
          </header>

          {article.summary && (
            <Panel title="摘要" icon={<Info size={17} />}>
              <p>{article.summary}</p>
            </Panel>
          )}
          {article.topSections?.map(section => (
            <Panel key={section.title} title={section.title || '说明'} icon={<Info size={17} />}>
              <p>{section.description}</p>
              {section.items && <Bullets items={section.items} />}
            </Panel>
          ))}
          {article.notices?.length ? (
            <Panel title="重要提示" icon={<ShieldAlert size={17} />}>
              <div className="space-y-2">
                {article.notices.map((notice, index) => (
                  <p key={index} className="rounded-2xl bg-[#fff7ed] px-3 py-2 text-sm font-bold leading-6 text-[#805d3a] [text-wrap:pretty]">
                    {notice.text}
                  </p>
                ))}
              </div>
            </Panel>
          ) : null}
          {article.extraSections?.map(section => (
            <Panel key={section.title} title={section.title || '补充说明'} icon={<Info size={17} />}>
              <p>{section.description}</p>
              {section.items && <Bullets items={section.items} />}
            </Panel>
          ))}

          <section className="mt-5 space-y-4">
            <h2 className="px-1 text-lg font-black">操作步骤</h2>
            {article.steps?.map((step, index) => <StepCard key={step.id || step.title} step={step} index={index} />)}
          </section>

          {article.quickChecklist?.items?.length ? (
            <Panel title={article.quickChecklist.title || '快速检查清单'} icon={<CheckCircle2 size={17} />}>
              <p>{article.quickChecklist.description}</p>
              <Bullets items={article.quickChecklist.items} />
            </Panel>
          ) : null}
          {article.faq?.length ? (
            <Panel title="常见问题" icon={<BookOpenCheck size={17} />}>
              <div className="space-y-3">
                {article.faq.map(item => (
                  <div key={item.question} className="rounded-2xl bg-[#f8f1ea] p-3">
                    <h3 className="text-sm font-black [text-wrap:balance]">{item.question}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#7d6965] [text-wrap:pretty]">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
          {article.links?.length ? (
            <Panel title="官方链接" icon={<ExternalLink size={17} />}>
              <div className="space-y-2">
                {article.links.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-10 items-center justify-between gap-3 rounded-2xl bg-[#f8f1ea] px-3 py-3 text-sm font-black text-[#6f536b] transition-transform active:scale-[0.96]"
                  >
                    <span className="min-w-0 truncate">{link.title}</span>
                    <ExternalLink size={15} className="shrink-0" />
                  </a>
                ))}
              </div>
            </Panel>
          ) : null}
        </article>
      </div>
    </main>
  );
}

function StepCard({ step, index }: { step: NonNullable<GuideArticle['steps']>[number]; index: number; key?: Key }) {
  const images: GuideImage[] = step.images?.length ? step.images : step.image ? [{ src: step.image, fallback: step.imageFallback, alt: step.imageAlt, caption: step.imageCaption }] : [];

  return (
    <section className="rounded-[26px] bg-white/78 p-4 shadow-[0_14px_34px_rgba(91,72,72,0.09)] ring-1 ring-white/80">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#6f536b] text-sm font-black text-white tabular-nums">{step.number || String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0">
          <h3 className="text-base font-black leading-6 [text-wrap:balance]">{step.title}</h3>
          {step.description && <p className="mt-2 text-sm font-semibold leading-6 text-[#7d6965] [text-wrap:pretty]">{step.description}</p>}
        </div>
      </div>
      {images.length ? (
        <div className="space-y-3">
          {images.map((image, imageIndex) => (
            <figure key={`${image.src}-${imageIndex}`} className="overflow-hidden rounded-2xl bg-[#f8f1ea] outline outline-1 outline-black/10">
              <img src={assetUrl(image.src || image.fallback)} alt={image.alt || step.title} loading="lazy" className="w-full object-contain" />
              {image.caption && <figcaption className="px-3 py-2 text-xs font-bold leading-5 text-[#8b7471] [text-wrap:pretty]">{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : null}
      {step.tips?.length ? (
        <div className="mt-3 rounded-2xl bg-[#f7efe9] p-3">
          <strong className="text-xs font-black text-[#8b7471]">注意事项</strong>
          <Bullets items={step.tips} />
        </div>
      ) : null}
    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode; key?: Key }) {
  return (
    <section className="mt-5 rounded-[26px] bg-white/78 p-4 shadow-[0_14px_34px_rgba(91,72,72,0.09)] ring-1 ring-white/80">
      <h2 className="mb-3 flex items-center gap-2 text-base font-black text-[#403632] [text-wrap:balance]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-[#f1e3f0] text-[#76506f]">{icon}</span>
        {title}
      </h2>
      <div className="text-sm font-semibold leading-6 text-[#7d6965] [text-wrap:pretty]">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map(item => (
        <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-[#7d6965] [text-wrap:pretty]">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a38189]" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1e3f0] px-2 py-1 text-[11px] font-black text-[#76506f]">
      <Tags size={12} />
      {children}
    </span>
  );
}
