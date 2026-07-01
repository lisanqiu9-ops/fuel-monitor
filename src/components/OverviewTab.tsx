import { FuelRecord } from '../types';
import { cn } from '../lib/utils';
import { Camera, ChevronRight, Clock, Fuel, Gauge, Route } from 'lucide-react';

interface Props {
  records: FuelRecord[];
  onRecordClick: (record: FuelRecord) => void;
  onGoRecognize: () => void;
  onGoTrend: () => void;
  onOpenHistory: () => void;
}

export function OverviewTab({ records, onRecordClick, onGoRecognize, onGoTrend, onOpenHistory }: Props) {
  const totalCount = records.length;
  const totalLiters = records.reduce((sum, r) => sum + r.fuelLiters, 0);
  const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
  const validFuelRecords = records.filter(r => r.actualFuelPer100 !== null);
  const latest = records[records.length - 1] ?? null;
  const latestFuel = validFuelRecords.length > 0 ? validFuelRecords[validFuelRecords.length - 1].actualFuelPer100 : null;
  const latestRange = latest?.dashboardRange ?? null;
  const recentRecords = [...records].reverse().slice(0, 5);

  const avgActualFuel = validFuelRecords.length > 0
    ? validFuelRecords.reduce((sum, r) => sum + (r.actualFuelPer100 ?? 0), 0) / validFuelRecords.length
    : null;

  const getFuelBadgeClass = (fuel: number | null) => {
    if (fuel === null) return 'soft-badge';
    if (fuel <= 6.0) return 'soft-badge soft-badge-good';
    if (fuel <= 7.0) return 'soft-badge soft-badge-warn';
    return 'soft-badge soft-badge-danger';
  };

  return (
    <div className="overview-soft flex flex-col gap-4 p-4 pb-24">
      <section className="overview-hero text-center">
        <div className="text-xs font-medium text-[#6b7a99]">累计油费</div>
        <div className="mt-1 flex items-baseline justify-center">
          <span className="text-[42px] leading-none font-semibold tracking-tight text-[#e8ecf4]">
            ¥{totalCost.toFixed(0)}
          </span>
          <span className="ml-1 text-sm text-[#6b7a99]">.{Math.round((totalCost % 1) * 100).toString().padStart(2, '0')}</span>
        </div>
        <div className="mt-2 text-xs text-[#6b7a99]">
          {totalCount > 0 ? `${totalCount} 次记录 · ${totalLiters.toFixed(1)} L` : '还没有加油记录'}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/80 bg-white/74 p-3 shadow-[0_14px_30px_rgba(91,72,72,0.08)] backdrop-blur">
        <button type="button" onClick={onGoRecognize} className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-[22px] bg-[#fffaf4] px-4 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.82)] active:scale-[0.99]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#6f536b] text-white shadow-[0_10px_22px_rgba(111,83,107,0.20)]"><Camera size={20} /></span>
            <span className="min-w-0">
              <strong className="block text-base font-black text-[#403632]">拍照识别</strong>
              <span className="mt-1 block text-xs font-bold leading-5 text-[#8b7471]">识别小票和仪表盘，确认后自动生成记录</span>
            </span>
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1e8e3] text-[#7d6965] transition group-active:translate-x-0.5"><ChevronRight size={17} /></span>
        </button>
      </section>

      <button type="button" onClick={onGoTrend} className="balance-strip w-full text-left">
        <div className="flex items-center gap-2">
          <span>油耗概况</span>
          {latestRange !== null && latestRange <= 100 && (
            <span className="range-dot">低续航</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[#6b7a99]">
          <span>历史分析</span>
          <ChevronRight size={14} />
        </div>
      </button>

      <section className="grid grid-cols-2 gap-3">
        <div className="metric-card">
          <div className="metric-icon"><Gauge size={16} /></div>
          <span className="metric-label">最近油耗</span>
          <strong>{latestFuel !== null ? latestFuel.toFixed(2) : '--'}</strong>
          <small>L/100km</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><Fuel size={16} /></div>
          <span className="metric-label">表显油耗</span>
          <strong>{latest?.dashboardFuelPer100 ?? '--'}</strong>
          <small>L/100km</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><Route size={16} /></div>
          <span className="metric-label">剩余续航</span>
          <strong>{latestRange ?? '--'}</strong>
          <small>km</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><Clock size={16} /></div>
          <span className="metric-label">平均油耗</span>
          <strong>{avgActualFuel !== null ? avgActualFuel.toFixed(2) : '--'}</strong>
          <small>L/100km</small>
        </div>
      </section>

      <section className="activity-card">
        <div className="activity-head">
          <span>最近记录</span>
          <button type="button" onClick={onOpenHistory}>
            全部 <ChevronRight size={14} />
          </button>
        </div>

        {recentRecords.length === 0 ? (
          <div className="empty-soft">
            <div>暂无记录</div>
            <p className="mt-1 text-[11px] text-[#6b7a99]">建议先拍照识别小票；需要手动录入时可使用底部“记录”。</p>
            <button type="button" onClick={onGoRecognize} className="mt-3 rounded-lg bg-[#f5a623] px-4 py-2 text-xs font-black text-black">拍照识别</button>
          </div>
        ) : (
          <div className="activity-list">
            {recentRecords.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => onRecordClick(r)}
                className="activity-row"
              >
                <div className="activity-avatar">
                  <Fuel size={15} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold text-[#e8ecf4]">{r.fuelType || '加油记录'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6b7a99]">
                    <span>{r.date} · {r.fuelLiters} L · ¥{r.pricePerLiter.toFixed(2)}/L</span>
                    <span className={cn('fill-type-pill', r.fillType === 'partial' && 'is-partial')}>
                      {r.fillType === 'partial' ? '未加满' : '跳枪'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#e8ecf4]">¥{r.totalCost.toFixed(2)}</div>
                  <div className={cn(getFuelBadgeClass(r.actualFuelPer100), 'mt-1')}>
                    {r.actualFuelPer100 !== null ? `${r.actualFuelPer100.toFixed(2)}` : r.fillType === 'partial' ? '待闭合' : '--'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
