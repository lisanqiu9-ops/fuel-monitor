import { FuelRecord } from '../types';
import { cn } from '../lib/utils';

interface Props {
  records: FuelRecord[];
  onRecordClick: (record: FuelRecord) => void;
}

export function OverviewTab({ records, onRecordClick }: Props) {
  if (records.length === 0) return <div className="p-4">无数据</div>;

  const validFuelRecords = records.filter(r => r.actualFuelPer100 !== null);
  const latestFuel = validFuelRecords.length > 0 ? validFuelRecords[validFuelRecords.length - 1].actualFuelPer100 : null;
  const latestRange = records[records.length - 1].dashboardRange;
  const latestDate = records[records.length - 1].date;

  const getFuelColorClass = (fuel: number | null) => {
    if (fuel === null) return 'text-[#e8ecf4]';
    if (fuel <= 6.0) return 'text-green-400 text-glow';
    if (fuel <= 7.0) return 'text-[#f5a623] text-glow-brand';
    return 'text-[#ff4757] text-glow-danger';
  };

  const totalCount = records.length;
  const totalLiters = records.reduce((sum, r) => sum + r.fuelLiters, 0);
  const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
  
  const recentRecords = [...records].reverse().slice(0, 5);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Hero Card */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden">
        <div className="flex justify-between items-center z-10">
          <div className="text-[#6b7a99] text-xs font-semibold uppercase tracking-wider">最近加油 ({latestDate})</div>
          {latestRange !== null && latestRange <= 100 && (
            <div className="bg-[#ff4757]/10 text-[#ff4757] text-xs px-2 py-1 rounded-full border border-[#ff4757]/20 flex items-center gap-1 font-semibold">
              ⚠️ 续航 {latestRange}km
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-2 z-10">
          <span className={cn("text-6xl font-display font-bold tracking-tight", getFuelColorClass(latestFuel))}>
            {latestFuel !== null ? latestFuel.toFixed(2) : '--'}
          </span>
          <span className="text-[#6b7a99] text-[16px]">L/100km</span>
        </div>
        
        <div className="flex gap-6 mt-1 pt-4 border-t border-white/5 z-10">
          <div>
            <div className="text-[#6b7a99] text-[10px] uppercase font-semibold mb-1">表显油耗</div>
            <div className="text-xl font-display">{records[records.length - 1].dashboardFuelPer100 || '--'}</div>
          </div>
          <div>
            <div className="text-[#6b7a99] text-[10px] uppercase font-semibold mb-1">剩余续航</div>
            <div className={cn("text-xl font-display", (latestRange !== null && latestRange <= 100) ? 'text-[#ff4757]' : '')}>
              {latestRange || '--'} <span className="text-[10px] text-[#6b7a99]">km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <div className="text-[#6b7a99] text-xs font-normal mb-1">加油次数</div>
          <div className="font-display text-3xl font-medium">{totalCount} <span className="text-xs font-sans font-normal text-[#6b7a99]">次</span></div>
        </div>
        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <div className="text-[#6b7a99] text-xs font-normal mb-1">累计加油</div>
          <div className="font-display text-3xl font-medium">{totalLiters.toFixed(1)} <span className="text-xs font-sans font-normal text-[#6b7a99]">L</span></div>
        </div>
        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <div className="text-[#6b7a99] text-xs font-normal mb-1">累计总花费</div>
          <div className="font-display text-3xl font-medium">{totalCost.toFixed(0)} <span className="text-xs font-sans font-normal text-[#6b7a99]">元</span></div>
        </div>
      </div>

      {/* Recent List */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="font-medium text-[#e8ecf4] text-sm">近 5 次记录</h2>
        </div>
        <div className="flex flex-col">
          {recentRecords.map((r, i) => (
            <div 
              key={r.id} 
              onClick={() => onRecordClick(r)}
              className={cn("px-5 py-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors", i !== recentRecords.length - 1 ? "border-b border-white/5" : "")}
            >
              <div className="flex flex-col gap-1">
                <div className="text-sm font-light text-[#e8ecf4]">{r.date}</div>
                <div className="text-[#6b7a99] text-xs flex gap-2">
                  <span className="font-display tracking-wide">{r.fuelLiters} L</span>
                  <span>•</span>
                  <span className="font-display tracking-wide">¥{r.totalCost}</span>
                  {r.drivenKm && (
                    <>
                      <span>•</span>
                      <span className="font-display tracking-wide">{r.drivenKm} km</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                {r.actualFuelPer100 !== null ? (
                  <div className={cn("flex items-baseline gap-1 px-3 py-1.5 rounded-full",
                    r.actualFuelPer100 <= 6.0 ? "bg-green-500/15 text-green-400" :
                    r.actualFuelPer100 <= 7.0 ? "bg-yellow-500/15 text-[#f5a623]" :
                    "bg-red-500/15 text-[#ff4757]"
                  )}>
                    <span className="font-display text-base tracking-wide font-medium">{r.actualFuelPer100.toFixed(2)}</span>
                    <span className="text-[10px] opacity-80 font-sans tracking-wider">L/100km</span>
                  </div>
                ) : (
                  <span className="text-[#6b7a99] text-sm px-3">-</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

