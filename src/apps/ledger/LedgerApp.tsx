import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LedgerCharts } from './LedgerCharts';
import { LedgerImport } from './LedgerImport';
import { LedgerOverviewCards } from './LedgerOverviewCards';
import { LedgerQualityPanel } from './LedgerQualityPanel';
import { LedgerTable } from './LedgerTable';
import { cacheKey, parseLedgerFile } from './ledgerParser';
import { buildQuality, buildStats } from './ledgerStats';
import type { LedgerCache } from './ledgerTypes';
interface Props { onBackToToolbox: () => void; }
const loadCache = (): LedgerCache | null => { try { const stored = localStorage.getItem(cacheKey); if (!stored) return null; const parsed = JSON.parse(stored) as LedgerCache; return parsed?.version === 1 && Array.isArray(parsed.records) ? parsed : null; } catch { return null; } };
export default function LedgerApp({ onBackToToolbox }: Props) {
  const [cache, setCache] = useState<LedgerCache | null>(null); const [ready, setReady] = useState(false); const [isImporting, setIsImporting] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { setCache(loadCache()); setReady(true); }, []);
  const stats = useMemo(() => cache ? buildStats(cache.records) : null, [cache]);
  const quality = useMemo(() => cache ? buildQuality(cache.records, cache.parserIssues.length, cache.missingFields) : [], [cache]);
  const handleImport = async (file: File) => { setIsImporting(true); setError(null); try { const parsed = await parseLedgerFile(file); if (!parsed.records.length) throw new Error('没有读到有效记录。请确认文件包含表头和账目数据。'); const next: LedgerCache = { version: 1, fileName: file.name, importedAt: new Date().toISOString(), ...parsed }; localStorage.setItem(cacheKey, JSON.stringify(next)); setCache(next); } catch (reason) { setError(reason instanceof Error ? reason.message : '导入失败，请检查文件格式后重试。'); } finally { setIsImporting(false); } };
  const clearCache = () => { localStorage.removeItem(cacheKey); setCache(null); setError(null); };
  if (!ready) return <div className="h-dvh bg-[#fffaf2]" />;
  return <main className="soft-scrollbar h-dvh overflow-y-auto bg-[linear-gradient(180deg,#fffaf2_0%,#f3edf6_52%,#f8f1ea_100%)] px-4 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-[calc(22px+env(safe-area-inset-top,0px))] text-[#403632] sm:px-6"><div className="mx-auto w-full max-w-6xl"><header className="mb-5 flex items-start justify-between gap-3"><div><button type="button" onClick={onBackToToolbox} className="mb-3 inline-flex items-center gap-1 text-xs font-black text-[#8b7471]"><ArrowLeft size={15} />三秋工具箱</button><h1 className="text-3xl font-black tracking-tight">本地记账</h1><p className="mt-2 text-sm font-bold text-[#8b7471]">导入本地 ledger.csv，查看消费结构与数据质量。</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-[#76506f] shadow-sm"><BookOpenCheck size={21} /></div></header><div className="space-y-4"><LedgerImport cache={cache} isImporting={isImporting} error={error} onImport={handleImport} onClear={clearCache} />{cache && stats ? <><LedgerOverviewCards stats={stats} /><LedgerCharts stats={stats} /><LedgerQualityPanel items={quality} /><LedgerTable records={cache.records} /></> : <section className="rounded-[28px] border border-dashed border-[#d9c9d6] bg-white/55 px-6 py-12 text-center"><BookOpenCheck size={30} className="mx-auto text-[#a7829d]" /><h2 className="mt-4 text-lg font-black">从一份 ledger.csv 开始</h2><p className="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-[#8b7471]">导入后会生成月度趋势、分类与商户排行，并自动检查待确认字段、重复订单号和异常金额。</p></section>}</div></div></main>;
}

