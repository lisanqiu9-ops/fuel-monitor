import { FuelRecord } from '../types';
import { ChevronLeft, Fuel, Trash2 } from 'lucide-react';
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
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 18, opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="history-page absolute inset-0 z-50 flex flex-col"
    >
      <div className="history-header shrink-0 px-5 pt-safe">
        <button type="button" onClick={onClose} className="soft-back-button" aria-label="返回">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[11px] font-semibold text-[#9b978f]">油耗监控</div>
          <h2 className="mt-0.5 text-lg font-semibold text-[#191817]">全部记录</h2>
        </div>
        <div className="w-10" />
      </div>

      <div className="history-scroll flex-1 overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
        {sortedRecords.length === 0 ? (
          <div className="history-empty">暂无数据记录</div>
        ) : (
          <div className="space-y-3">
            {sortedRecords.map((record) => (
              <article key={record.id} className="history-record-card">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onRecordClick(record)}
                >
                  <div className="flex items-center gap-3">
                    <div className="history-record-icon">
                      <Fuel size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-base font-semibold text-[#191817]">加油记录</div>
                        <div className="shrink-0 text-lg font-semibold text-[#191817]">
                          ¥{record.totalCost.toFixed(0)}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#8d8981]">
                        <span>{format(parseISO(record.date), 'yyyy-MM-dd')}</span>
                        <span>·</span>
                        <span>{record.fuelLiters} L</span>
                        {record.fuelType && (
                          <>
                            <span>·</span>
                            <span>{record.fuelType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-3 flex items-center justify-between border-t border-[#ded9cf] pt-3">
                  <button
                    type="button"
                    className={cn(
                      'history-fuel-pill',
                      record.actualFuelPer100 === null && 'history-fuel-pill-empty'
                    )}
                    onClick={() => onRecordClick(record)}
                  >
                    {record.actualFuelPer100 !== null ? `${record.actualFuelPer100.toFixed(2)} L/100km` : '未解算'}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (confirm(`确定删除 ${record.date} 的记录吗？`)) {
                        onDelete(record.id);
                      }
                    }}
                    className="history-delete-button"
                    aria-label="删除记录"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
