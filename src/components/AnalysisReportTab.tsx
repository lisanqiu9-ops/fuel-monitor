import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Copy, Download, FileText, Share2, WalletCards, Gauge, Route, Fuel } from 'lucide-react';
import type { FuelRecord } from '../types';
import { downloadMarkdownReport, shareText } from '../lib/fuelExport';
import { generateFuelAnalysisReport, reportPeriodOptions, type ReportPeriod } from '../utils/fuelReportEngine';

interface Props {
  records: FuelRecord[];
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="report-tooltip">
      <p>{label}</p>
      {payload.map((entry: any) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </span>
      ))}
    </div>
  );
};

export function AnalysisReportTab({ records }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>('last30');
  const [message, setMessage] = useState('');
  const report = useMemo(() => generateFuelAnalysisReport(records, period), [records, period]);
  const recordMetric = (record: FuelRecord | null, field: 'actualFuelPer100' | 'costPerKm', unit: string) =>
    record && record[field] !== null ? `${record.date} · ${record[field]!.toFixed(2)} ${unit}` : '--';

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 1800);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.markdown);
    notify('报告已复制');
  };

  const handleShare = async () => {
    const result = await shareText('用车成本分析报告', report.markdown);
    notify(result === 'shared' ? '已打开系统分享' : '已复制报告文本');
  };

  const handleMarkdown = () => {
    downloadMarkdownReport(report.markdown, 'fuel-analysis-report');
    notify('Markdown 已导出');
  };

  if (records.length === 0) {
    return (
      <div className="analysis-report-page tab-content-panel p-4 pb-24">
        <section className="report-empty-card">
          <FileText size={28} />
          <strong>暂无可分析数据</strong>
          <p>先添加加油记录后，这里会生成本地用车成本报告。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="analysis-report-page tab-content-panel flex flex-col gap-4 p-4 pb-24">
      <section className={`report-head-card report-tone-${report.tone}`}>
        <span>{report.periodLabel}</span>
        <strong>{report.headline}</strong>
        <p>{report.dataNote}</p>
      </section>

      <section className="report-period-strip" aria-label="报告周期">
        {reportPeriodOptions.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPeriod(option.id)}
            className={period === option.id ? 'is-active' : ''}
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="report-metric-grid">
        <Metric icon={WalletCards} label="累计油费" value={`¥${report.stats.totalCost.toFixed(2)}`} />
        <Metric icon={Gauge} label="平均油耗" value={`${report.stats.avgFuelPer100?.toFixed(2) ?? '--'}`} unit="L/100km" />
        <Metric icon={Route} label="每公里成本" value={`${report.stats.avgCostPerKm?.toFixed(2) ?? '--'}`} unit="元/km" />
        <Metric icon={Fuel} label="百公里油费" value={`${report.stats.costPer100Km?.toFixed(2) ?? '--'}`} unit="元/100km" />
      </section>

      <section className="report-stats-card">
        <div><span>累计里程</span><strong>{report.stats.totalKm.toFixed(2)} km</strong></div>
        <div><span>累计加油量</span><strong>{report.stats.totalLiters.toFixed(2)} L</strong></div>
        <div><span>加权油价</span><strong>{report.stats.weightedPrice?.toFixed(2) ?? '--'} 元/L</strong></div>
        <div><span>表显平均偏差</span><strong>{report.stats.avgDisplayError !== null ? `${report.stats.avgDisplayError > 0 ? '+' : ''}${report.stats.avgDisplayError.toFixed(2)}` : '--'}</strong></div>
        <div><span>最高油耗记录</span><strong>{recordMetric(report.stats.maxFuelRecord, 'actualFuelPer100', 'L/100km')}</strong></div>
        <div><span>最低油耗记录</span><strong>{recordMetric(report.stats.minFuelRecord, 'actualFuelPer100', 'L/100km')}</strong></div>
        <div><span>最高成本记录</span><strong>{recordMetric(report.stats.maxCostRecord, 'costPerKm', '元/km')}</strong></div>
        <div><span>最低成本记录</span><strong>{recordMetric(report.stats.minCostRecord, 'costPerKm', '元/km')}</strong></div>
      </section>

      <section className="report-anomaly-card">
        <div className="report-section-title">
          <AlertTriangle size={17} />
          <span>异常提醒</span>
        </div>
        {report.anomalies.length === 0 ? (
          <p className="report-muted">当前周期未发现超过规则阈值的异常记录。</p>
        ) : (
          <div className="report-anomaly-list">
            {report.anomalies.map(item => (
              <div key={item.id}>
                <strong>{item.date} · {item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <TrendChart title="油耗趋势" dataKey="fuel" name="L/100km" data={report.points} color="var(--app-brand)" />
      <TrendChart title="每公里成本趋势" dataKey="cost" name="元/km" data={report.points} color="var(--app-accent)" />
      <TrendChart title="油价趋势" dataKey="price" name="元/L" data={report.points} color="#c58b31" lineOnly />

      <section className="report-text-card">
        <div className="report-text-head">
          <div className="report-section-title">
            <FileText size={17} />
            <span>完整报告</span>
          </div>
          <div className="report-actions">
            <button type="button" onClick={handleCopy}><Copy size={16} />复制</button>
            <button type="button" onClick={handleShare}><Share2 size={16} />分享</button>
            <button type="button" onClick={handleMarkdown}><Download size={16} />Markdown</button>
          </div>
        </div>
        <pre>{report.markdown}</pre>
      </section>

      {message && <div className="report-toast">{message}</div>}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="report-metric-card">
      <div><Icon size={16} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  );
}

function TrendChart({
  title,
  dataKey,
  name,
  data,
  color,
  lineOnly = false,
}: {
  title: string;
  dataKey: 'fuel' | 'cost' | 'price';
  name: string;
  data: any[];
  color: string;
  lineOnly?: boolean;
}) {
  const Chart = lineOnly ? LineChart : AreaChart;
  return (
    <section className="report-chart-card">
      <div className="chart-head">
        <span>{title}</span>
        <small>{name}</small>
      </div>
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.12)" vertical={false} />
            <XAxis dataKey="shortDate" stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            {lineOnly ? (
              <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.2} dot={false} connectNulls />
            ) : (
              <Area type="monotone" dataKey={dataKey} name={name} stroke={color} fill="var(--app-brand-soft)" strokeWidth={2.2} connectNulls={false} />
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
