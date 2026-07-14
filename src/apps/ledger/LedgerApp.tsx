import { BookOpenCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LedgerAnalysisPage } from './LedgerAnalysisPage';
import { LedgerBottomNav, type LedgerTab } from './LedgerBottomNav';
import { LedgerLayout } from './LedgerLayout';
import { LedgerOverviewPage } from './LedgerOverviewPage';
import { LedgerQualityPage } from './LedgerQualityPage';
import { LedgerSettingsPage } from './LedgerSettingsPage';
import { LedgerTransactionsPage } from './LedgerTransactionsPage';
import { configureLedgerCloudFromUrl, configureLedgerCloudKey, loadCloudLedger } from './ledgerCloud';
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
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    setCache(loadCache());
    setCloudConfigured(configureLedgerCloudFromUrl());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !cloudConfigured || manualOverride) return undefined;

    let cancelled = false;
    const syncCloudLedger = async () => {
      try {
        const parsed = await loadCloudLedger();
        if (!parsed || cancelled) return;
        if (!parsed.records.length) throw new Error('云端账本没有有效记录');
        const next: LedgerCache = { version: 1, fileName: 'ledger.csv（云端）', importedAt: new Date().toISOString(), ...parsed };
        localStorage.setItem(cacheKey, JSON.stringify(next));
        setCache(next);
        setError(null);
      } catch (reason) {
        console.error('云端账本读取失败', reason);
        if (!cancelled) setError('云端账本读取失败，当前仍保留本地导入数据。');
      }
    };

    void syncCloudLedger();
    const timer = window.setInterval(() => void syncCloudLedger(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [ready, cloudConfigured, manualOverride]);

  const stats = useMemo(() => cache ? buildStats(cache.records) : null, [cache]);
  const quality = useMemo(() => cache ? buildQuality(cache.records, cache.parserIssues.length, cache.missingFields) : [], [cache]);

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setError(null);
    try {
      const parsed = await parseLedgerFile(file);
      if (!parsed.records.length) throw new Error('没有读到有效记录。原始文件不会被修改，请确认文件包含表头和账目数据。');
      const next: LedgerCache = { version: 1, fileName: file.name, importedAt: new Date().toISOString(), ...parsed };
      localStorage.setItem(cacheKey, JSON.stringify(next));
      setCache(next);
      setManualOverride(true);
      setActiveTab('overview');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败。原始 ledger.csv 不会被修改，请检查文件格式后重试。');
    } finally {
      setIsImporting(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(cacheKey);
    setCache(null);
    setError(null);
    setManualOverride(false);
    setActiveTab('overview');
  };

  const connectCloud = (key: string) => {
    configureLedgerCloudKey(key);
    setCloudConfigured(true);
    setManualOverride(false);
    setError(null);
  };

  if (!ready) return <div className="h-dvh bg-[#fffaf2]" />;

  const emptyPage = <section className="rounded-2xl border border-dashed border-[#d9c9d6] bg-white/55 px-5 py-8 text-center"><BookOpenCheck size={26} className="mx-auto text-[#a7829d]" /><h2 className="mt-3 text-base font-black">还没有本地账本</h2><p className="mx-auto mt-2 max-w-xs text-xs font-bold leading-5 text-[#8b7471]">选择 ledger.csv 导入后，即可查看消费概览和数据质量；原始文件不会上传。</p><button type="button" onClick={() => setActiveTab('settings')} className="mt-4 h-9 rounded-xl bg-[#6f536b] px-4 text-xs font-black text-white">导入 ledger.csv</button></section>;

  let page = emptyPage;
  if (activeTab === 'settings') page = <LedgerSettingsPage cache={cache} isImporting={isImporting} error={error} cloudConfigured={cloudConfigured} onImport={handleImport} onClear={clearCache} onConnectCloud={connectCloud} onBackToToolbox={onBackToToolbox} />;
  if (cache && stats) {
    if (activeTab === 'overview') page = <LedgerOverviewPage stats={stats} records={cache.records} quality={quality} onOpenQuality={() => setActiveTab('quality')} onOpenTransactions={() => setActiveTab('transactions')} />;
    if (activeTab === 'analysis') page = <LedgerAnalysisPage stats={stats} />;
    if (activeTab === 'transactions') page = <LedgerTransactionsPage records={cache.records} />;
    if (activeTab === 'quality') page = <LedgerQualityPage items={quality} />;
  }

  return <><LedgerLayout onBackToToolbox={onBackToToolbox}>{page}</LedgerLayout><LedgerBottomNav activeTab={activeTab} onChange={setActiveTab} /></>;
}
