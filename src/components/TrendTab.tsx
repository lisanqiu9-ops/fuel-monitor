import { FuelRecord } from '../types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, ClipboardList, Gauge, Route, WalletCards, Zap } from 'lucide-react';
import { calculateEnergyMetrics } from '../lib/metrics';
import { cn } from '../lib/utils';
import { generateTrendReport } from '../lib/report';

interface Props {
  records: FuelRecord[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#1a1e2a] border border-white/10 p-3 rounded-xl shadow-lg">
      <p className="text-xs text-[#6b7a99] mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export function TrendTab({ records }: Props) {
  if (records.length === 0) {
    return <div className="p-4 text-[#6b7a99]">暂无数据</div>;
  }

  const enriched = records.map((record, index) => {
    const previous = index > 0 ? records[index - 1] : null;
    const metrics = calculateEnergyMetrics(record, previous);
    return {
      ...record,
      ...metrics,
      shortDate: format(parseISO(record.date), 'MM-dd'),
    };
  });

  const validFuel = enriched.filter(r => r.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0
    ? validFuel.reduce((sum, r) => sum + (r.actualFuelPer100 ?? 0), 0) / validFuel.length
    : null;
  const latestValidFuel = validFuel.length > 0 ? validFuel[validFuel.length - 1].actualFuelPer100 : null;
  const validCost = enriched.filter(r => r.costPerKm !== null);
  const avgCostPerKm = validCost.length > 0
    ? validCost.reduce((sum, r) => sum + (r.costPerKm ?? 0), 0) / validCost.length
    : null;
  const latest = enriched[enriched.length - 1];
  const invalidCount = enriched.filter(r => r.odoStatus === 'invalid').length;
  const highCount = enriched.filter(r => r.odoStatus === 'high').length;
  const avgDisplayError = enriched.filter(r => r.displayError !== null).length > 0
    ? enriched.filter(r => r.displayError !== null).reduce((sum, r) => sum + (r.displayError ?? 0), 0) / enriched.filter(r => r.displayError !== null).length
    : null;
  const partialCount = enriched.filter(r => r.fillType === 'partial').length;
  const report = generateTrendReport(records);

  const getCostColor = (value: number) => {
    if (value <= 0.45) return '#7a8775';
    if (value <= 0.65) return '#c58b31';
    return '#c44f42';
  };

  return (
    <div className="trend-soft flex flex-col gap-4 p-4 pb-24 overflow-x-hidden">
      <section className="grid grid-cols-2 gap-3">
        <div className="insight-card col-span-2">
          <div className="insight-icon"><Gauge size={18} /></div>
          <div>
            <span>平均实际油耗</span>
            <strong>{avgFuel !== null ? avgFuel.toFixed(2) : '--'} <small>L/100km</small></strong>
          </div>
        </div>
        <div className="insight-card">
          <div className="insight-icon"><WalletCards size={17} /></div>
          <div>
            <span>平均花费</span>
            <strong>{avgCostPerKm !== null ? avgCostPerKm.toFixed(3) : '--'} <small>元/km</small></strong>
          </div>
        </div>
        <div className="insight-card">
          <div className="insight-icon"><Zap size={17} /></div>
          <div>
            <span>最近实际油耗</span>
            <strong>{latestValidFuel !== null ? latestValidFuel.toFixed(2) : '--'} <small>L/100km</small></strong>
          </div>
        </div>
      </section>

      <section className="analysis-card">
        <div className="analysis-title">
          {invalidCount > 0 ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          <span>油耗核算</span>
        </div>
        <div className="analysis-grid">
          <div>
            <span>可信周期</span>
            <strong>{highCount}</strong>
          </div>
          <div>
            <span>异常周期</span>
            <strong className={invalidCount > 0 ? 'text-[#ff4757]' : ''}>{invalidCount}</strong>
          </div>
          <div>
            <span>最近 ODO 差值</span>
            <strong>{latest.odoDiff !== null ? `${latest.odoDiff > 0 ? '+' : ''}${latest.odoDiff} km` : '--'}</strong>
          </div>
          <div>
            <span>表显误差</span>
            <strong>{avgDisplayError !== null ? `${avgDisplayError > 0 ? '+' : ''}${avgDisplayError.toFixed(2)}` : '--'}</strong>
          </div>
        </div>
        <p>{partialCount > 0 ? `${partialCount} 条未加满记录已计入费用，等待后续加满后参与区间油耗计算。` : latest.odoMessage}</p>
      </section>

      <section className={`analysis-card trend-report-card report-tone-${report.tone}`}>
        <div className="analysis-title">
          <ClipboardList size={17} />
          <span>周期总结</span>
        </div>
        <div className="report-headline">
          <strong>{report.title}</strong>
          <p>{report.summary}</p>
        </div>
        <div className="report-list">
          {report.points.map((point) => (
            <div key={point}>{point}</div>
          ))}
        </div>
        <div className="report-next">
          <span>建议</span>
          {report.nextActions.map((action) => (
            <p key={action}>{action}</p>
          ))}
        </div>
      </section>

      <section className="chart-card">
        <div className="chart-head">
          <span>油耗校准</span>
          <small>实际 vs 表显</small>
        </div>
        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.12)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="actualFuelPer100" name="实际油耗" stroke="var(--app-brand)" fill="var(--app-brand-soft)" strokeWidth={2} connectNulls={false} />
              <Line type="monotone" dataKey="dashboardFuelPer100" name="表显油耗" stroke="var(--app-accent)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-card">
        <div className="chart-head">
          <span>经济成本</span>
          <small>每公里花费</small>
        </div>
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enriched} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.12)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(127,127,127,0.06)' }} />
              <Bar dataKey="costPerKm" name="元/km" radius={[8, 8, 2, 2]}>
                {enriched.map((entry, index) => (
                  <Cell key={`cost-${index}`} fill={getCostColor(entry.costPerKm ?? 0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="cycle-list">
        <div className="chart-head">
          <span>周期质量</span>
          <small>最近记录</small>
        </div>
        {enriched.slice().reverse().slice(0, 5).map(record => (
          <div key={record.id} className="cycle-row">
            <div className="cycle-icon"><Route size={15} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#e8ecf4]">{record.date}</div>
              <div className="text-[11px] text-[#6b7a99]">
                {record.drivenKm ?? '--'} km · {record.actualFuelPer100 !== null ? `${record.actualFuelPer100.toFixed(2)} L/100km` : record.fillType === 'partial' ? '等待加满闭合' : '缺少里程'}
              </div>
            </div>
            <div className={cn('quality-pill', `quality-${record.odoStatus}`)}>
              {record.fillType === 'partial' ? '未加满' : record.odoStatus === 'high' ? '高' : record.odoStatus === 'invalid' ? '异常' : record.odoStatus === 'warn' ? '复核' : '缺失'}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
