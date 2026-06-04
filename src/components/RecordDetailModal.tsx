import { FuelRecord } from '../types';
import { ChevronLeft, Calendar, MapPin, Gauge, Clock, Activity, Navigation, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateEnergyMetrics, getPreviousRecord } from '../lib/metrics';

interface Props {
  record: FuelRecord;
  allRecords: FuelRecord[];
  onClose: () => void;
}

export function RecordDetailModal({ record, allRecords, onClose }: Props) {
  // calculate averages
  const validFuel = allRecords.filter(r => r.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0 ? validFuel.reduce((acc, r) => acc + r.actualFuelPer100!, 0) / validFuel.length : 0;
  
  const actual = record.actualFuelPer100 || 0;
  const dash = record.dashboardFuelPer100 || 0;
  const metrics = calculateEnergyMetrics(record, getPreviousRecord(allRecords, record));

  // Max scale for bars
  const maxScale = Math.max(actual, dash, avgFuel, 10);

  const getPercent = (val: number) => `${Math.min((val / maxScale) * 100, 100)}%`;

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
        <h2 className="text-[#e8ecf4] font-medium absolute left-1/2 -translate-x-1/2">加油详情</h2>
        <div className="w-[60px]" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-safe">
        <div className="p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-[#e8ecf4]">
            <Calendar className="text-[#6b7a99]" size={18} />
            <span className="font-medium text-sm">{record.date}</span>
          </div>
          
          {/* Main Visuals: Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d0f14] rounded-xl p-4 border border-white/5 flex flex-col">
              <span className="text-[#6b7a99] text-xs mb-1">加油量 (L)</span>
              <span className="font-display text-2xl text-[#e8ecf4] tracking-wide">{record.fuelLiters}</span>
            </div>
            <div className="bg-[#0d0f14] rounded-xl p-4 border border-white/5 flex flex-col">
              <span className="text-[#6b7a99] text-xs mb-1">总价 (元)</span>
              <span className="font-display text-2xl text-[#f5a623] tracking-wide">¥{record.totalCost}</span>
            </div>
            <div className="bg-[#0d0f14] rounded-xl p-4 border border-white/5 flex flex-col">
              <span className="text-[#6b7a99] text-xs mb-1">单价 (元/L)</span>
              <span className="font-display text-2xl text-[#e8ecf4] tracking-wide">¥{record.pricePerLiter}</span>
            </div>
            <div className="bg-[#0d0f14] rounded-xl p-4 border border-white/5 flex flex-col">
              <span className="text-[#6b7a99] text-xs mb-1">油号</span>
              <span className="font-display text-xl mt-1 text-[#e8ecf4] tracking-wide">{record.fuelType || '--'}</span>
            </div>
            <div className="bg-[#0d0f14] rounded-xl p-4 border border-white/5 flex flex-col col-span-2">
              <span className="text-[#6b7a99] text-xs mb-1">每公里花费</span>
              <span className="font-display text-2xl text-[#e8ecf4] tracking-wide">{record.costPerKm ? `¥${record.costPerKm}` : '--'}</span>
            </div>
          </div>

          <div className="bg-[#0d0f14] rounded-xl p-5 border border-white/5 flex flex-col gap-4">
            <h3 className="text-sm font-medium text-[#e8ecf4] flex items-center gap-2">
              <Activity size={16} className="text-[#4fc3f7]" />
              跳枪法闭环解算
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[#6b7a99] text-xs mb-1">实际百公里油耗</div>
                <div className="text-[#e8ecf4] font-display text-lg">{metrics.actualFuelPer100 !== null ? `${metrics.actualFuelPer100.toFixed(2)} L/100km` : '--'}</div>
              </div>
              <div>
                <div className="text-[#6b7a99] text-xs mb-1">每公里花费</div>
                <div className="text-[#e8ecf4] font-display text-lg">{metrics.costPerKm !== null ? `${metrics.costPerKm.toFixed(3)} 元/km` : '--'}</div>
              </div>
              <div>
                <div className="text-[#6b7a99] text-xs mb-1">每公里油耗</div>
                <div className="text-[#e8ecf4] font-display text-lg">{metrics.fuelPerKm !== null ? `${metrics.fuelPerKm.toFixed(4)} L/km` : '--'}</div>
              </div>
              <div>
                <div className="text-[#6b7a99] text-xs mb-1">表显误差</div>
                <div className="text-[#e8ecf4] font-display text-lg">{metrics.displayError !== null ? `${metrics.displayError > 0 ? '+' : ''}${metrics.displayError.toFixed(2)}` : '--'}</div>
              </div>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-xs text-[#6b7a99] leading-relaxed">
              {metrics.odoMessage}
              {metrics.odoDiff !== null && (
                <span className="block mt-1">ODO 差值：{metrics.odoDiff > 0 ? '+' : ''}{metrics.odoDiff} km</span>
              )}
            </div>
          </div>

          {/* Graphical Comparison */}
          {(actual > 0 || dash > 0) && (
            <div className="bg-[#0d0f14] rounded-xl p-5 border border-white/5 flex flex-col gap-5">
              <h3 className="text-sm font-medium text-[#e8ecf4] flex items-center gap-2 mb-1">
                <Activity size={16} className="text-[#4fc3f7]" />
                油耗对比分析
              </h3>
              
              {actual > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7a99]">实测油耗</span>
                    <span className="font-display text-[#e8ecf4] text-sm tracking-wide">{actual.toFixed(2)} <span className="text-[10px] font-sans text-[#6b7a99]">L/100km</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: getPercent(actual) }} transition={{ delay: 0.1, duration: 0.5 }} className="h-full bg-[#f5a623] rounded-full" />
                  </div>
                </div>
              )}
              
              {dash > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7a99]">表显油耗</span>
                    <span className="font-display text-[#e8ecf4] text-sm tracking-wide">{dash.toFixed(2)} <span className="text-[10px] font-sans text-[#6b7a99]">L/100km</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: getPercent(dash) }} transition={{ delay: 0.2, duration: 0.5 }} className="h-full bg-[#4fc3f7] rounded-full" />
                  </div>
                </div>
              )}

              {avgFuel > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 mt-1 border-t border-white/5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7a99]">全周期平均</span>
                    <span className="font-display text-[#e8ecf4] text-sm tracking-wide">{avgFuel.toFixed(2)} <span className="text-[10px] font-sans text-[#6b7a99]">L/100km</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: getPercent(avgFuel) }} transition={{ delay: 0.3, duration: 0.5 }} className="h-full bg-[#6b7a99] rounded-full" />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Detailed Dashboard Stats */}
          <div className="bg-[#0d0f14] rounded-xl p-5 border border-white/5 flex flex-col gap-4">
            <h3 className="text-sm font-medium text-[#e8ecf4] flex items-center gap-2 mb-2">
              <Gauge size={16} className="text-[#f5a623]" />
              仪表盘数据
            </h3>
            
            <div className="grid grid-cols-2 gap-y-5 gap-x-3">
              <div className="flex flex-col">
                <span className="text-xs text-[#6b7a99] mb-1 flex items-center gap-1"><MapPin size={12}/>行驶里程</span>
                <span className="font-display text-lg text-[#e8ecf4] tracking-wide">{record.drivenKm || '--'} <span className="text-[10px] font-sans text-[#6b7a99] ml-0.5">km</span></span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-xs text-[#6b7a99] mb-1 flex items-center gap-1"><Zap size={12}/>平均车速</span>
                <span className="font-display text-lg text-[#e8ecf4] tracking-wide">{record.dashboardAvgSpeed || '--'} <span className="text-[10px] font-sans text-[#6b7a99] ml-0.5">km/h</span></span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-[#6b7a99] mb-1 flex items-center gap-1"><Clock size={12}/>行驶时间</span>
                <span className="font-display text-lg text-[#e8ecf4] tracking-wide">{record.dashboardDriveHours || '--'} <span className="text-[10px] font-sans text-[#6b7a99] ml-0.5">h</span></span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-[#6b7a99] mb-1 flex items-center gap-1"><Navigation size={12}/>剩余续航</span>
                <span className="font-display text-lg text-[#e8ecf4] tracking-wide">{record.dashboardRange || '--'} <span className="text-[10px] font-sans text-[#6b7a99] ml-0.5">km</span></span>
              </div>

              {record.dashboardOdo && (
                <div className="flex flex-col col-span-2 mt-1 pt-4 border-t border-white/5">
                  <span className="text-xs text-[#6b7a99] mb-1 flex items-center gap-1"><Gauge size={12}/>总计里程 (ODO)</span>
                  <span className="font-display text-lg text-[#e8ecf4] tracking-wide">{record.dashboardOdo} <span className="text-[10px] font-sans text-[#6b7a99] ml-0.5">km</span></span>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </motion.div>
  );
}
