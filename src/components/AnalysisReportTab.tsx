import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileText, Info, Share2, X } from 'lucide-react';
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
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(now));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => now.getFullYear());
  const [message, setMessage] = useState('');
  const reportAnchor = useMemo(
    () => period === 'month' && !isSameMonth(selectedMonth, now) ? endOfMonth(selectedMonth) : now,
    [now, period, selectedMonth],
  );
  const report = useMemo(() => generateFuelAnalysisReport(records, period, reportAnchor), [records, period, reportAnchor]);
  const previousMonth = useMemo(() => subMonths(selectedMonth, 1), [selectedMonth]);
  const previousReport = useMemo(
    () => generateFuelAnalysisReport(records, 'month', endOfMonth(previousMonth)),
    [previousMonth, records],
  );
  const monthlyCostPoints = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(selectedMonth, 5 - index);
    const anchor = isSameMonth(month, now) ? now : endOfMonth(month);
    const monthReport = generateFuelAnalysisReport(records, 'month', anchor);
    return {
      label: format(month, 'M月'),
      cost: monthReport.stats.totalCost,
      selected: isSameMonth(month, selectedMonth),
    };
  }), [now, records, selectedMonth]);
  const recordMetric = (record: FuelRecord | null, field: 'actualFuelPer100' | 'costPerKm', unit: string) =>
    record && record[field] !== null ? `${record.date} · ${record[field]!.toFixed(2)} ${unit}` : '--';

  const monthLabel = format(selectedMonth, 'yyyy年M月');
  const currentMonthValue = format(now, 'yyyy-MM');
  const selectedMonthValue = format(selectedMonth, 'yyyy-MM');
  const fuelDiff = report.stats.avgFuelPer100 !== null && previousReport.stats.avgFuelPer100 !== null
    ? Number((report.stats.avgFuelPer100 - previousReport.stats.avgFuelPer100).toFixed(2))
    : null;
  const comparisonText = fuelDiff === null
    ? '暂无上月可比油耗数据'
    : Math.abs(fuelDiff) <= 0.2
      ? `较${format(previousMonth, 'M月')}变化 ${Math.abs(fuelDiff).toFixed(2)} L/100km，表现稳定`
      : fuelDiff < 0
        ? `较${format(previousMonth, 'M月')}下降 ${Math.abs(fuelDiff).toFixed(2)} L/100km，油耗改善`
        : `较${format(previousMonth, 'M月')}上升 ${fuelDiff.toFixed(2)} L/100km，建议关注`;
  const toolbarLabel = period === 'month' ? monthLabel : report.periodLabel;
  const scopeLabel = period === 'month' ? '按月统计' : '区间统计';
  const earliestYear = useMemo(() => Math.min(
    now.getFullYear(),
    ...records.map(record => Number(record.date.slice(0, 4))).filter(Number.isFinite),
  ), [now, records]);
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const changeMonth = (offset: number) => {
    const next = startOfMonth(subMonths(selectedMonth, -offset));
    if (next.getTime() > startOfMonth(now).getTime()) return;
    setSelectedMonth(next);
    setPeriod('month');
  };

  const choosePeriod = (nextPeriod: ReportPeriod) => {
    setPeriod(nextPeriod);
    setPickerOpen(false);
  };

  const openPicker = () => {
    setPickerYear(selectedMonth.getFullYear());
    setPickerOpen(true);
  };

  const chooseMonth = (monthIndex: number) => {
    const nextMonth = new Date(pickerYear, monthIndex, 1);
    if (nextMonth.getTime() > startOfMonth(now).getTime()) return;
    setSelectedMonth(nextMonth);
    setPeriod('month');
    setPickerOpen(false);
  };

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
      <section className="report-range-toolbar" aria-label="报告时间范围">
        <button type="button" className="report-range-title" onClick={openPicker}>
          <span>{toolbarLabel}</span>
          <ChevronDown size={19} aria-hidden="true" />
        </button>
        <span className="report-scope-badge">{scopeLabel}<Info size={13} aria-hidden="true" /></span>
        {period === 'month' && (
          <div className="report-month-arrows">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月"><ChevronLeft size={22} /></button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="下个月"
              disabled={selectedMonthValue >= currentMonthValue}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        )}
      </section>

      <section className={`report-month-summary report-tone-${report.tone}`}>
        <strong>
          {period === 'month'
            ? report.stats.count > 0
              ? `本月${report.stats.count}次加油，平均油耗${report.stats.avgFuelPer100?.toFixed(2) ?? '--'} L/100km`
              : `${monthLabel}暂无加油记录`
            : report.headline}
        </strong>
        <p>{period === 'month' ? comparisonText : report.dataNote}</p>
        <div className="report-summary-metrics">
          <div><span>累计油费</span><b>¥{report.stats.totalCost.toFixed(2)}</b></div>
          <div><span>累计里程</span><b>{report.stats.totalKm.toFixed(0)}km</b></div>
          <div><span>每公里成本</span><b>{report.stats.avgCostPerKm?.toFixed(2) ?? '--'}元/km</b></div>
          <div><span>百公里油费</span><b>{report.stats.costPer100Km?.toFixed(2) ?? '--'}元</b></div>
        </div>
      </section>

      {period === 'month' && (
        <section className="report-chart-card report-monthly-cost-card">
          <div className="chart-head">
            <span>月度油费</span>
            <small>按加油日期统计</small>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCostPoints} margin={{ top: 26, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--app-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--app-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="cost" name="油费（元）" radius={[7, 7, 0, 0]} maxBarSize={34}>
                  {monthlyCostPoints.map(point => (
                    <Cell key={point.label} fill={point.selected ? 'var(--app-accent)' : 'color-mix(in srgb, var(--app-accent) 42%, var(--app-surface))'} />
                  ))}
                  <LabelList
                    dataKey="cost"
                    position="top"
                    fill="var(--app-muted)"
                    fontSize={9}
                    formatter={(value: unknown) => typeof value === 'number' && value > 0 ? value.toFixed(0) : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="report-chart-note">图表展示截至当前选择月份的近 6 个月数据</p>
        </section>
      )}

      {pickerOpen && (
        <div className="report-picker-layer" role="presentation">
          <button type="button" className="report-picker-backdrop" aria-label="关闭时间范围选择" onClick={() => setPickerOpen(false)} />
          <section className="report-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="report-picker-title">
            <div className="report-picker-head">
              <div>
                <strong id="report-picker-title">选择报告范围</strong>
                <span>按自然月查看，或选择快捷区间</span>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="关闭"><X size={20} /></button>
            </div>
            <div className="report-year-nav" aria-label="选择年份">
              <button
                type="button"
                onClick={() => setPickerYear(year => year - 1)}
                disabled={pickerYear <= earliestYear}
                aria-label="上一年"
              >
                <ChevronLeft size={20} />
              </button>
              <strong>{pickerYear}年</strong>
              <button
                type="button"
                onClick={() => setPickerYear(year => year + 1)}
                disabled={pickerYear >= now.getFullYear()}
                aria-label="下一年"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="report-month-grid" aria-label={`${pickerYear}年月份`}>
              {monthNames.map((name, monthIndex) => {
                const isFuture = new Date(pickerYear, monthIndex, 1).getTime() > startOfMonth(now).getTime();
                const isSelected = period === 'month'
                  && selectedMonth.getFullYear() === pickerYear
                  && selectedMonth.getMonth() === monthIndex;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => chooseMonth(monthIndex)}
                    disabled={isFuture}
                    className={isSelected ? 'is-active' : ''}
                    aria-current={isSelected ? 'date' : undefined}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="report-quick-ranges">
              {reportPeriodOptions.filter(option => option.id !== 'month').map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choosePeriod(option.id)}
                  className={period === option.id ? 'is-active' : ''}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p>月度数据按加油日期归属；跨月油耗周期会计入加油记录所在月份。</p>
          </section>
        </div>
      )}

      <section className="report-detail-heading">
        <span>详细数据</span>
        <small>{report.periodLabel}</small>
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
