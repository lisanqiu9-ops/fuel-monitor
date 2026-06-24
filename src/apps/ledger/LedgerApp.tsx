import { BookOpenCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LedgerAnalysisPage } from './LedgerAnalysisPage';
import { LedgerBottomNav, type LedgerTab } from './LedgerBottomNav';
import { LedgerImportPage } from './LedgerImportPage';
import { LedgerLayout } from './LedgerLayout';
import { LedgerOverviewPage } from './LedgerOverviewPage';
import { LedgerQualityPage } from './LedgerQualityPage';
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
    const stored = loadCache();
    setCache(stored);
    setActiveTab(stored ? 'overview' : 'import');
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
    setActiveTab('import');
  };

  if (!ready) return <div className="h-dvh bg-[#fffaf2]" />;

  const importPage = <LedgerImportPage cache={cache} isImporting={isImporting} error={error} onImport={handleImport} onClear={clearCache} />;
  const emptyPage = <section className="rounded-3xl border border-dashed border-[#d9c9d6] bg-white/55 px-6 py-12 text-center"><BookOpenCheck size={30} className="mx-auto text-[#a7829d]" /><h2 className="mt-4 text-lg font-black">先导入一份 ledger.csv</h2><p className="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-[#8b7471]">导入后即可查看本月支出、流水明细、图表排行和数据质量。</p><button type="button" onClick={() => setActiveTab('import')} className="mt-5 h-10 rounded-2xl bg-[#6f536b] px-4 text-sm font-black text-white">去导入</button></section>;

  let page = emptyPage;
  if (activeTab === 'import') page = importPage;
  if (cache && stats) {
    if (activeTab === 'overview') page = <LedgerOverviewPage stats={stats} records={cache.records} quality={quality} />;
    if (activeTab === 'analysis') page = <LedgerAnalysisPage stats={stats} />;
    if (activeTab === 'transactions') page = <LedgerTransactionsPage records={cache.records} />;
    if (activeTab === 'quality') page = <LedgerQualityPage items={quality} />;
  }

  return <><LedgerLayout activeTab={activeTab} onTabChange={setActiveTab} onBackToToolbox={onBackToToolbox}>{page}</LedgerLayout><LedgerBottomNav activeTab={activeTab} onChange={setActiveTab} /></>;
}
