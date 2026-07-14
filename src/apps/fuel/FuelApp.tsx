import { useState, useEffect, useRef } from 'react';
import { loadInitialData, saveRecords } from '../../data';
import { FuelRecord } from '../../types';
import { OverviewTab } from '../../components/OverviewTab';
import { TrendTab } from '../../components/TrendTab';
import { AddRecordTab } from '../../components/AddRecordTab';
import { HistoryModal } from '../../components/HistoryModal';
import { RecordDetailModal } from '../../components/RecordDetailModal';
import { SettingsTab } from '../../components/SettingsTab';
import { AnalysisReportTab } from '../../components/AnalysisReportTab';
import { OcrCaptureModal } from '../../components/OcrCaptureModal';
import { Droplet, BarChart2, PlusCircle, Settings, ClipboardList, PackageOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { checkOcrConfig } from '../../lib/ocr';
import {
  clearFuelCloudKey,
  configureFuelCloudFromUrl,
  configureFuelCloudKey,
  getFuelCloudKey,
  hasFuelCloudKey,
  loadCloudFuelRecords,
  saveCloudFuelRecords,
} from '../../lib/fuelCloud';

const tabMeta = {
  overview: { title: '概览', subtitle: '油耗监控' },
  analysis: { title: '分析', subtitle: '油耗监控' },
  add: { title: '记录加油', subtitle: '油耗监控' },
  settings: { title: '设置', subtitle: '油耗监控' },
} as const;

const themeOptions = [
  { id: 'collectui', name: '柔雾' },
  { id: 'classic', name: '经典暗色' },
] as const;

type ThemeId = typeof themeOptions[number]['id'];
type CloudState = { type: 'idle' | 'syncing' | 'success' | 'error'; msg: string };
type ActiveTab = keyof typeof tabMeta;
type AnalysisMode = 'trend' | 'report';

interface FuelAppProps {
  onBackToToolbox?: () => void;
}

export default function App({ onBackToToolbox }: FuelAppProps) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('trend');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FuelRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('collectui');
  const [showOcrCapture, setShowOcrCapture] = useState(false);
  const [ocrLaunchRequest, setOcrLaunchRequest] = useState(0);
  const [ocrPrefillRequest, setOcrPrefillRequest] = useState(0);
  const [ocrPrefillData, setOcrPrefillData] = useState<any>(null);
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [cloudState, setCloudState] = useState<CloudState>({ type: 'idle', msg: '尚未连接云端' });
  const cloudSyncQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    const localRecords = saveRecords(loadInitialData());
    setRecords(localRecords);
    const savedTheme = localStorage.getItem('fuel_monitor_theme') as ThemeId | null;
    if (savedTheme && themeOptions.some(option => option.id === savedTheme)) {
      setTheme(savedTheme);
    }

    const cloudReady = configureFuelCloudFromUrl();
    setCloudConfigured(cloudReady);
    if (!cloudReady) {
      setIsLoaded(true);
      return () => { active = false; };
    }

    setCloudState({ type: 'syncing', msg: '正在读取云端记录' });
    loadCloudFuelRecords()
      .then(async cloudRecords => {
        if (cloudRecords === null) {
          await saveCloudFuelRecords(localRecords);
          if (active) setCloudState({ type: 'success', msg: `已迁移 ${localRecords.length} 条本地记录到云端` });
          return;
        }
        const nextRecords = saveRecords(cloudRecords as FuelRecord[]);
        if (active) {
          setRecords(nextRecords);
          setCloudState({ type: 'success', msg: `已同步 ${nextRecords.length} 条云端记录` });
        }
      })
      .catch(error => {
        console.error('Failed to initialize fuel cloud data', error);
        if (active) setCloudState({ type: 'error', msg: error instanceof Error ? error.message : '云端同步失败' });
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem('fuel_monitor_theme', theme);
  }, [theme]);

  useEffect(() => {
    let hideTimer: number | undefined;

    const handleScroll = () => {
      const shell = document.querySelector('.app-shell');
      if (!shell) return;

      shell.classList.add('is-scrolling');
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        shell.classList.remove('is-scrolling');
      }, 900);
    };

    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const syncRecordsToCloud = (nextRecords: FuelRecord[]) => {
    if (!hasFuelCloudKey()) return;
    setCloudState({ type: 'syncing', msg: '正在同步云端记录' });
    cloudSyncQueue.current = cloudSyncQueue.current
      .catch(() => undefined)
      .then(() => saveCloudFuelRecords(nextRecords))
      .then(() => setCloudState({ type: 'success', msg: `已同步 ${nextRecords.length} 条记录` }))
      .catch(error => {
        console.error('Failed to sync fuel records', error);
        setCloudState({ type: 'error', msg: error instanceof Error ? error.message : '云端同步失败' });
      });
  };

  const persistRecords = (nextRecords: FuelRecord[]) => {
    const savedRecords = saveRecords(nextRecords);
    setRecords(savedRecords);
    syncRecordsToCloud(savedRecords);
    return savedRecords;
  };

  const handleSave = (newRecord: FuelRecord) => {
    persistRecords([...records, newRecord]);
    setActiveTab('overview');
  };

  const handleDelete = (id: string) => {
    persistRecords(records.filter(record => record.id !== id));
    setSelectedRecord(prevRecord => prevRecord?.id === id ? null : prevRecord);
  };

  const handleReplaceRecords = (nextRecords: FuelRecord[]) => {
    persistRecords(nextRecords);
  };

  const connectCloud = async (key: string) => {
    const previousKey = getFuelCloudKey();
    configureFuelCloudKey(key);
    setCloudConfigured(true);
    setCloudState({ type: 'syncing', msg: '正在连接油耗云端服务' });
    try {
      const cloudRecords = await loadCloudFuelRecords();
      if (cloudRecords === null) {
        await saveCloudFuelRecords(records);
        setCloudState({ type: 'success', msg: `已迁移 ${records.length} 条本地记录到云端` });
        return;
      }
      const nextRecords = saveRecords(cloudRecords as FuelRecord[]);
      setRecords(nextRecords);
      setCloudState({ type: 'success', msg: `已同步 ${nextRecords.length} 条云端记录` });
    } catch (error) {
      console.error('Failed to connect fuel cloud service', error);
      if (previousKey) configureFuelCloudKey(previousKey);
      else clearFuelCloudKey();
      setCloudConfigured(Boolean(previousKey));
      setCloudState({ type: 'error', msg: error instanceof Error ? error.message : '云端连接失败' });
      throw error;
    }
  };

  const handleGoRecognize = async () => {
    const hasConfig = await checkOcrConfig();
    if (!hasConfig) {
      setActiveTab('settings');
      return;
    }
    setShowOcrCapture(true);
  };

  const handleOcrNeedManualReview = (data: any) => {
    setOcrPrefillData(data);
    setOcrPrefillRequest(prev => prev + 1);
    setShowOcrCapture(false);
    setActiveTab('add');
  };

  const openTrendAnalysis = () => {
    setAnalysisMode('trend');
    setActiveTab('analysis');
  };

  const currentTab = tabMeta[activeTab];

  if (!isLoaded) return <div className="app-loading-shell bg-[#1a1a18]" />;

  return (
    <div data-theme={theme} className="app-shell w-full flex flex-col bg-[#1a1a18] overflow-hidden max-w-md mx-auto relative shadow-2xl">
      
      {/* Header */}
      <div className="app-header shrink-0 px-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[#6b7a99]">{currentTab.subtitle}</div>
          <h1 className="mt-1 text-2xl font-medium text-[#e8ecf4] tracking-normal">
            {currentTab.title}
          </h1>
        </div>
        {onBackToToolbox && (
          <button
            type="button"
            onClick={onBackToToolbox}
            className="theme-trigger mt-1 grid shrink-0 place-items-center rounded-full border border-white/10 bg-[#0d0f14] text-[#e8ecf4] active:bg-white/5"
            aria-label="返回三秋工具箱"
            title="返回三秋工具箱"
          >
            <PackageOpen size={18} />
          </button>
        )}
      </div>

      <div className="app-scroll flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <OverviewTab records={records} onRecordClick={setSelectedRecord} onGoRecognize={handleGoRecognize} onGoTrend={openTrendAnalysis} onOpenHistory={() => setShowHistory(true)} />
            </motion.div>
          )}
          {activeTab === 'analysis' && (
            <motion.div key="analysis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div className="px-4 pt-1">
                <div role="tablist" aria-label="分析内容" className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#0d0f14] p-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={analysisMode === 'trend'}
                    onClick={() => setAnalysisMode('trend')}
                    className={cn('flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors', analysisMode === 'trend' ? 'bg-[#f5a623] text-black' : 'text-[#6b7a99]')}
                  >
                    <BarChart2 size={17} />
                    趋势
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={analysisMode === 'report'}
                    onClick={() => setAnalysisMode('report')}
                    className={cn('flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors', analysisMode === 'report' ? 'bg-[#f5a623] text-black' : 'text-[#6b7a99]')}
                  >
                    <ClipboardList size={17} />
                    周期报告
                  </button>
                </div>
              </div>
              {analysisMode === 'trend' ? <TrendTab records={records} /> : <AnalysisReportTab records={records} />}
            </motion.div>
          )}
          {activeTab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <AddRecordTab onSave={handleSave} onOpenHistory={() => setShowHistory(true)} onGoSettings={() => setActiveTab('settings')} ocrLaunchRequest={ocrLaunchRequest} ocrPrefillData={ocrPrefillData} ocrPrefillRequest={ocrPrefillRequest} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <SettingsTab records={records} onRecordsChange={handleReplaceRecords} onBackToToolbox={onBackToToolbox} theme={theme} themeOptions={themeOptions} onThemeChange={setTheme} cloudConfigured={cloudConfigured} cloudState={cloudState} onConnectCloud={connectCloud} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab Bar */}
      <div
        className="app-bottom-nav fixed bottom-0 left-1/2 z-40 grid grid-cols-4 items-stretch border-t border-white/5 bg-[#1a1a18]/95 backdrop-blur-xl"
        style={{
          bottom: 0,
          width: 'min(100vw, 28rem)',
          height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          borderRadius: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <button 
          onClick={() => setActiveTab('overview')}
          className={cn("app-nav-item relative m-1 flex min-h-14 flex-col items-center justify-start rounded-2xl transition-colors", activeTab === 'overview' ? 'bg-[#f5a623]/10 text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Droplet size={23} />
          <span className="text-[11px] mt-0.5 font-medium">概览</span>
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={cn("app-nav-item relative m-1 flex min-h-14 flex-col items-center justify-start rounded-2xl transition-colors", activeTab === 'add' ? 'bg-[#f5a623]/10 text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <PlusCircle size={23} />
          <span className="text-[11px] mt-0.5 font-medium">记录</span>
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn("app-nav-item relative m-1 flex min-h-14 flex-col items-center justify-start rounded-2xl transition-colors", activeTab === 'analysis' ? 'bg-[#f5a623]/10 text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <BarChart2 size={23} />
          <span className="text-[11px] mt-0.5 font-medium">分析</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn("app-nav-item relative m-1 flex min-h-14 flex-col items-center justify-start rounded-2xl transition-colors", activeTab === 'settings' ? 'bg-[#f5a623]/10 text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Settings size={23} />
          <span className="text-[11px] mt-0.5 font-medium">设置</span>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showHistory && (
          <HistoryModal records={records} onClose={() => setShowHistory(false)} onDelete={handleDelete} onRecordClick={setSelectedRecord} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRecord && (
          <RecordDetailModal 
            record={selectedRecord} 
            allRecords={records} 
            onClose={() => setSelectedRecord(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOcrCapture && (
          <OcrCaptureModal
            onClose={() => setShowOcrCapture(false)}
            onSave={handleSave}
            onNeedManualReview={handleOcrNeedManualReview}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
