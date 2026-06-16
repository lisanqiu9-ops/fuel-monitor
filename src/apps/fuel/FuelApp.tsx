import { useState, useEffect } from 'react';
import { loadInitialData, saveRecords } from '../../data';
import { FuelRecord } from '../../types';
import { OverviewTab } from '../../components/OverviewTab';
import { TrendTab } from '../../components/TrendTab';
import { AddRecordTab } from '../../components/AddRecordTab';
import { HistoryModal } from '../../components/HistoryModal';
import { RecordDetailModal } from '../../components/RecordDetailModal';
import { SettingsTab } from '../../components/SettingsTab';
import { Droplet, BarChart2, PlusCircle, Settings, Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { checkOcrConfig } from '../../lib/ocr';

const tabMeta = {
  overview: { title: '概览', subtitle: '油耗监控' },
  trend: { title: '趋势', subtitle: '油耗监控' },
  add: { title: '记录加油', subtitle: '油耗监控' },
  settings: { title: '我的', subtitle: '油耗监控' },
} as const;

const themeOptions = [
  { id: 'collectui', name: '柔雾' },
  { id: 'classic', name: '经典暗色' },
] as const;

type ThemeId = typeof themeOptions[number]['id'];

interface FuelAppProps {
  onBackToToolbox?: () => void;
}

export default function App({ onBackToToolbox }: FuelAppProps) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'add' | 'settings'>('overview');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FuelRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('collectui');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [ocrLaunchRequest, setOcrLaunchRequest] = useState(0);
  const [ocrPrefillRequest, setOcrPrefillRequest] = useState(0);
  const [ocrPrefillData, setOcrPrefillData] = useState<any>(null);

  useEffect(() => {
    setRecords(loadInitialData());
    const savedTheme = localStorage.getItem('fuel_monitor_theme') as ThemeId | null;
    if (savedTheme && themeOptions.some(option => option.id === savedTheme)) {
      setTheme(savedTheme);
    }
    setIsLoaded(true);
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

  const handleSave = (newRecord: FuelRecord) => {
    const newRecords = [...records, newRecord];
    setRecords(saveRecords(newRecords));
    setActiveTab('overview');
  };

  const handleDelete = (id: string) => {
    const newRecords = records.filter(r => r.id !== id);
    setRecords(saveRecords(newRecords));
  };

  const handleReplaceRecords = (nextRecords: FuelRecord[]) => {
    setRecords(saveRecords(nextRecords));
  };

  const handleGoRecognize = async () => {
    const hasConfig = await checkOcrConfig();
    if (!hasConfig) {
      setActiveTab('settings');
      return;
    }
    setActiveTab('add');
    setOcrLaunchRequest(prev => prev + 1);
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThemePicker(prev => !prev)}
            className="theme-trigger mt-1 grid place-items-center rounded-full border border-white/10 bg-[#0d0f14] text-[#e8ecf4] active:bg-white/5"
            aria-label="切换主题"
          >
            <Palette size={18} />
          </button>
          <AnimatePresence>
            {showThemePicker && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="theme-menu absolute right-0 top-12 z-50 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#1a1e2a] shadow-2xl"
              >
                {themeOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setTheme(option.id);
                      setShowThemePicker(false);
                    }}
                    className="theme-menu-item flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-[#e8ecf4] active:bg-white/5"
                  >
                    <span>{option.name}</span>
                    {theme === option.id && <Check size={15} className="text-[#f5a623]" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <OverviewTab records={records} onRecordClick={setSelectedRecord} onGoAdd={() => setActiveTab('add')} onGoRecognize={handleGoRecognize} onGoTrend={() => setActiveTab('trend')} onOpenHistory={() => setShowHistory(true)} />
            </motion.div>
          )}
          {activeTab === 'trend' && (
            <motion.div key="trend" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <TrendTab records={records} />
            </motion.div>
          )}
          {activeTab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <AddRecordTab onSave={handleSave} onOpenHistory={() => setShowHistory(true)} onGoSettings={() => setActiveTab('settings')} ocrLaunchRequest={ocrLaunchRequest} ocrPrefillData={ocrPrefillData} ocrPrefillRequest={ocrPrefillRequest} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <SettingsTab records={records} onRecordsChange={handleReplaceRecords} onBackToToolbox={onBackToToolbox} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab Bar */}
      <div className="app-bottom-nav fixed bottom-0 left-1/2 bg-[#1a1a18]/95 backdrop-blur-xl border-t border-white/5 flex items-start justify-around z-40 pb-safe">
        <button 
          onClick={() => setActiveTab('overview')}
          className={cn("app-nav-item flex flex-col items-center justify-start w-full h-full relative transition-colors", activeTab === 'overview' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Droplet size={23} />
          <span className="text-[11px] mt-0.5 font-medium">概览</span>
        </button>
        <button 
          onClick={() => setActiveTab('trend')}
          className={cn("app-nav-item flex flex-col items-center justify-start w-full h-full relative transition-colors", activeTab === 'trend' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <BarChart2 size={23} />
          <span className="text-[11px] mt-0.5 font-medium">趋势</span>
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={cn("app-nav-item flex flex-col items-center justify-start w-full h-full relative transition-colors", activeTab === 'add' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <PlusCircle size={25} />
          <span className="text-[11px] mt-0.5 font-medium">记录</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn("app-nav-item flex flex-col items-center justify-start w-full h-full relative transition-colors", activeTab === 'settings' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Settings size={23} />
          <span className="text-[11px] mt-0.5 font-medium">我的</span>
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

    </div>
  );
}
