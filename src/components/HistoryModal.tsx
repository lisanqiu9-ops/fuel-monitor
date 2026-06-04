import { FuelRecord } from '../types';
import { Trash2, ChevronLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  records: FuelRecord[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onRecordClick: (record: FuelRecord) => void;
}

export function HistoryModal({ records, onClose, onDelete, onRecordClick }: Props) {
  const sortedRecords = [...records].reverse();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="absolute inset-0 bg-[#1a1a18] z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)]"
    >
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-3 border-b border-white/5 bg-[#1a1a18]/90 backdrop-blur-xl shrink-0 pt-safe z-10">
        <button onClick={onClose} className="flex items-center text-[#6b7a99] active:text-[#e8ecf4] transition-colors p-2 z-10 -ml-2">
          <ChevronLeft size={24} />
          <span className="text-sm font-medium">返回</span>
        </button>
        <h2 className="text-[#e8ecf4] font-medium absolute left-1/2 -translate-x-1/2">全部记录</h2>
        <div className="w-[60px]" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-safe">
        {sortedRecords.length === 0 ? (
          <div className="text-center text-[#6b7a99] text-sm p-10 font-light mt-10">暂无数据记录</div>
        ) : (
          <div className="flex flex-col">
            {sortedRecords.map((r, i) => (
              <div key={r.id} className={cn("px-5 py-4 flex items-center justify-between active:bg-white/5 transition-colors", i !== sortedRecords.length - 1 ? "border-b border-white/5" : "")}>
                <div className="flex flex-col gap-1 flex-1 cursor-pointer" onClick={() => onRecordClick(r)}>
                  <div className="text-sm font-light text-[#e8ecf4]">{format(parseISO(r.date), 'yyyy-MM-dd')}</div>
                  <div className="text-[#6b7a99] text-xs flex gap-2">
                    <span className="font-display tracking-wide">{r.fuelLiters} L</span>
                    <span>•</span>
                    <span className="font-display tracking-wide">¥{r.totalCost}</span>
                    {r.fuelType && (
                      <>
                        <span>•</span>
                        <span className="tracking-wide">{r.fuelType}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {r.actualFuelPer100 !== null ? (
                    <div className={cn("flex items-baseline gap-1 px-3 py-1.5 rounded-full cursor-pointer",
                      r.actualFuelPer100 <= 6.0 ? "bg-green-500/15 text-green-400" :
                      r.actualFuelPer100 <= 7.0 ? "bg-yellow-500/15 text-[#f5a623]" :
                      "bg-red-500/15 text-[#ff4757]"
                    )} onClick={() => onRecordClick(r)}>
                      <span className="font-display text-base tracking-wide font-medium">{r.actualFuelPer100.toFixed(2)}</span>
                      <span className="text-[10px] opacity-80 font-sans tracking-wider">L/100km</span>
                    </div>
                  ) : (
                    <span className="text-[#6b7a99] text-sm px-3 cursor-pointer" onClick={() => onRecordClick(r)}>-</span>
                  )}
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定要删除 ${r.date} 的记录吗？`)) {
                        onDelete(r.id);
                      }
                    }}
                    className="p-2 text-[#ff4757]/70 hover:text-[#ff4757] ml-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
