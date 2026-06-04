import { useState, useEffect } from 'react';
import { loadInitialData, saveRecords } from './data';
import { FuelRecord } from './types';
import { OverviewTab } from './components/OverviewTab';
import { TrendTab } from './components/TrendTab';
import { AddRecordTab } from './components/AddRecordTab';
import { HistoryModal } from './components/HistoryModal';
import { RecordDetailModal } from './components/RecordDetailModal';
import { SettingsTab } from './components/SettingsTab';
import { Droplet, BarChart2, PlusCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

const tabMeta = {
  overview: { title: '概览', subtitle: '油耗监控' },
  trend: { title: '趋势', subtitle: '油耗监控' },
  add: { title: '记录加油', subtitle: '油耗监控' },
  settings: { title: '设置', subtitle: '油耗监控' },
} as const;

export default function App() {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'add' | 'settings'>('overview');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FuelRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRecords(loadInitialData());
    setIsLoaded(true);
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

  const currentTab = tabMeta[activeTab];

  if (!isLoaded) return <div className="app-loading-shell bg-[#1a1a18]" />;

  return (
    <div className="app-shell w-full flex flex-col bg-[#1a1a18] overflow-hidden max-w-md mx-auto relative shadow-2xl">
      
      {/* Header */}
      <div className="app-header shrink-0 px-5">
        <div className="text-xs font-medium text-[#6b7a99]">{currentTab.subtitle}</div>
        <h1 className="mt-1 text-2xl font-medium text-[#e8ecf4] tracking-normal">
          {currentTab.title}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="app-scroll flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <OverviewTab records={records} onRecordClick={setSelectedRecord} />
            </motion.div>
          )}
          {activeTab === 'trend' && (
            <motion.div key="trend" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <TrendTab records={records} />
            </motion.div>
          )}
          {activeTab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <AddRecordTab onSave={handleSave} onOpenHistory={() => setShowHistory(true)} onGoSettings={() => setActiveTab('settings')} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <SettingsTab records={records} onRecordsChange={handleReplaceRecords} />
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
      
    </div>
  );
}
