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

  if (!isLoaded) return <div className="h-screen w-screen bg-[#1a1a18]" />;

  return (
    <div className="h-screen w-full flex flex-col bg-[#1a1a18] overflow-hidden max-w-md mx-auto relative shadow-2xl">
      
      {/* Header */}
      <div className="pt-10 pb-4 px-5 shrink-0 flex items-center">
        <h1 className="text-2xl font-light text-[#e8ecf4] tracking-wider">
          油耗监控
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
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
      <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-[#1a1a18]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-40 pb-safe">
        <button 
          onClick={() => setActiveTab('overview')}
          className={cn("flex flex-col items-center justify-center w-full h-full relative transition-colors", activeTab === 'overview' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Droplet size={24} />
          <span className="text-[10px] mt-1 font-medium">概览</span>
        </button>
        <button 
          onClick={() => setActiveTab('trend')}
          className={cn("flex flex-col items-center justify-center w-full h-full relative transition-colors", activeTab === 'trend' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <BarChart2 size={24} />
          <span className="text-[10px] mt-1 font-medium">趋势</span>
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={cn("flex flex-col items-center justify-center w-full h-full relative transition-colors", activeTab === 'add' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <PlusCircle size={24} />
          <span className="text-[10px] mt-1 font-medium">记录</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn("flex flex-col items-center justify-center w-full h-full relative transition-colors", activeTab === 'settings' ? 'text-[#f5a623] tab-active' : 'text-[#6b7a99] hover:text-[#e8ecf4]')}
        >
          <Settings size={24} />
          <span className="text-[10px] mt-1 font-medium">设置</span>
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
