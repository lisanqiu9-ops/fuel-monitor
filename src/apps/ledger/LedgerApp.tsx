import { BookOpenCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LedgerAnalysisPage } from './LedgerAnalysisPage';
import { LedgerBottomNav, type LedgerTab } from './LedgerBottomNav';
import { LedgerLayout } from './LedgerLayout';
import { LedgerOverviewPage } from './LedgerOverviewPage';
import { LedgerQualityPage } from './LedgerQualityPage';
import { LedgerSettingsPage } from './LedgerSettingsPage';
import { LedgerTransactionsPage } from './LedgerTransactionsPage';
import { cacheKey, parseLedgerFile } from './ledgerParser';
import { buildQuality, buildStats } from './ledgerStats';
import type { LedgerCache } from './ledgerTypes';

interface Props { onBackToToolbox: () => void; }

const loadCache = (): LedgerCache | null => {
  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as LedgerCache;
    return parsed?.version === 1 && Array.isArray(parsed.records) ? parsed : null;
  } catch {
    return null;
  }
};

export default function LedgerApp({ onBackToToolbox }: Props) {
  const [cache, setCache] = useState<LedgerCache | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<LedgerTab>('overview');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCache(loadCache());
    setReady(true);
  }, []);

  const stats = useMemo(() => cache ? buildStats(cache.records) : null, [cache]);
  const quality = useMemo(() => cache ? buildQuality(cache.records, cache.parserIssues.length, cache.missingFields) : [], [cache]);

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setError(null);
    try {
      const parsed = await parseLedgerFile(file);
      if (!parsed.records.length) throw new Error('没有读到有效记录。请确认文件包含表头和账目数据。');
      const next: LedgerCache = { version: 1, fileName: file.name, importedAt: new Date().toISOString(), ...parsed };
      localStorage.setItem(cacheKey, JSON.stringify(next));
      setCache(next);
      setActiveTab('overview');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败，请检查文件格式后重试。');
    } finally {
      setIsImporting(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(cacheKey);
    setCache(null);
    setError(null);
    setActiveTab('overview');
  };

  if (!ready) return <div className="h-dvh bg-[#fffaf2]" />;

  const emptyPage = <section className="rounded-2xl border border-dashed border-[#d9c9d6] bg-white/55 px-5 py-8 text-center"><BookOpenCheck size={26} className="mx-auto text-[#a7829d]" /><h2 className="mt-3 text-base font-black">还没有本地账本</h2><p className="mx-auto mt-2 max-w-xs text-xs font-bold leading-5 text-[#8b7471]">前往设置选择 ledger.csv，导入后即可查看消费概览和数据质量。</p><button type="button" onClick={() => setActiveTab('settings')} className="mt-4 h-9 rounded-xl bg-[#6f536b] px-4 text-xs font-black text-white">前往设置</button></section>;

  let page = emptyPage;
  if (activeTab === 'settings') page = <LedgerSettingsPage cache={cache} isImporting={isImporting} error={error} onImport={handleImport} onClear={clearCache} onBackToToolbox={onBackToToolbox} />;
  if (cache && stats) {
    if (activeTab === 'overview') page = <LedgerOverviewPage stats={stats} records={cache.records} quality={quality} />;
    if (activeTab === 'analysis') page = <LedgerAnalysisPage stats={stats} />;
    if (activeTab === 'transactions') page = <LedgerTransactionsPage records={cache.records} />;
    if (activeTab === 'quality') page = <LedgerQualityPage items={quality} />;
  }

  return <><LedgerLayout>{page}</LedgerLayout><LedgerBottomNav activeTab={activeTab} onChange={setActiveTab} /></>;
}
