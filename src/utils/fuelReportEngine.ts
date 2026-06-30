import { format, parseISO, subDays } from 'date-fns';
import type { FuelRecord } from '../types';

export type ReportPeriod = 'last3' | 'month' | 'last30' | 'last90' | 'year' | 'all';

export const reportPeriodOptions: { id: ReportPeriod; label: string }[] = [
  { id: 'last3', label: '近 3 次' },
  { id: 'month', label: '本月' },
  { id: 'last30', label: '近 30 天' },
  { id: 'last90', label: '近 90 天' },
  { id: 'year', label: '今年累计' },
  { id: 'all', label: '全部记录' },
];

export type ReportTone = 'good' | 'warn' | 'danger' | 'neutral';

export interface ReportRecordPoint {
  record: FuelRecord;
  fuel: number | null;
  cost: number | null;
  price: number;
  displayError: number | null;
  shortDate: string;
}

export interface ReportAnomaly {
  id: string;
  type: 'fuel' | 'cost' | 'display';
  title: string;
  detail: string;
  date: string;
}

export interface FuelReportStats {
  count: number;
  totalKm: number;
  totalLiters: number;
  totalCost: number;
  avgFuelPer100: number | null;
  avgCostPerKm: number | null;
  costPer100Km: number | null;
  weightedPrice: number | null;
  maxFuelRecord: FuelRecord | null;
  minFuelRecord: FuelRecord | null;
  maxCostRecord: FuelRecord | null;
  minCostRecord: FuelRecord | null;
  avgDisplayError: number | null;
  spanMonths: number;
}

export interface FuelAnalysisReport {
  period: ReportPeriod;
  periodLabel: string;
  records: FuelRecord[];
  points: ReportRecordPoint[];
  stats: FuelReportStats;
  tone: ReportTone;
  headline: string;
  dataNote: string;
  anomalies: ReportAnomaly[];
  sections: {
    overview: string;
    fuel: string;
    cost: string;
    priceImpact: string;
    display: string;
    anomalies: string;
    advice: string;
  };
  markdown: string;
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const fmt = (value: number | null | undefined, digits = 2) => value === null || value === undefined ? '--' : value.toFixed(digits);

const average = (values: number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

const getTime = (date: string) => parseISO(date).getTime();

export const filterFuelRecordsByPeriod = (records: FuelRecord[], period: ReportPeriod, now = new Date()) => {
  const sorted = [...records].sort((a, b) => getTime(a.date) - getTime(b.date));
  if (period === 'last3') return sorted.slice(-3);
  if (period === 'all') return sorted;

  const year = now.getFullYear();
  const month = now.getMonth();
  const start = period === 'month'
    ? new Date(year, month, 1)
    : period === 'last30'
      ? subDays(now, 30)
      : period === 'last90'
        ? subDays(now, 90)
        : new Date(year, 0, 1);

  return sorted.filter(record => getTime(record.date) >= start.getTime() && getTime(record.date) <= now.getTime());
};

const spanMonths = (records: FuelRecord[]) => {
  if (records.length < 2) return 0;
  const first = parseISO(records[0].date);
  const last = parseISO(records[records.length - 1].date);
  return (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
};

const pickExtreme = (records: FuelRecord[], field: 'actualFuelPer100' | 'costPerKm', mode: 'max' | 'min') => {
  const valid = records.filter(record => record[field] !== null);
  if (valid.length === 0) return null;
  return valid.reduce((best, record) => {
    const value = record[field]!;
    const bestValue = best[field]!;
    return mode === 'max' ? value > bestValue ? record : best : value < bestValue ? record : best;
  }, valid[0]);
};

const buildStats = (records: FuelRecord[]): FuelReportStats => {
  const totalKm = records.reduce((sum, record) => sum + (record.drivenKm ?? 0), 0);
  const totalLiters = records.reduce((sum, record) => sum + record.fuelLiters, 0);
  const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
  const validFuelRecords = records.filter(record => record.actualFuelPer100 !== null);
  const fuelValues = validFuelRecords.map(record => record.actualFuelPer100!);
  const costValues = validFuelRecords
    .map(record => record.costPerKm)
    .filter((value): value is number => value !== null);
  const avgFuelPer100 = average(fuelValues);
  const avgCostPerKm = average(costValues);
  const displayErrors = records
    .filter(record => record.actualFuelPer100 !== null && record.dashboardFuelPer100 !== null)
    .map(record => record.dashboardFuelPer100! - record.actualFuelPer100!);

  return {
    count: records.length,
    totalKm: round(totalKm, 2),
    totalLiters: round(totalLiters, 2),
    totalCost: round(totalCost, 2),
    avgFuelPer100: avgFuelPer100 !== null ? round(avgFuelPer100, 2) : null,
    avgCostPerKm: avgCostPerKm !== null ? round(avgCostPerKm, 2) : null,
    costPer100Km: avgCostPerKm !== null ? round(avgCostPerKm * 100, 2) : null,
    weightedPrice: totalLiters > 0 ? round(totalCost / totalLiters, 2) : null,
    maxFuelRecord: pickExtreme(records, 'actualFuelPer100', 'max'),
    minFuelRecord: pickExtreme(records, 'actualFuelPer100', 'min'),
    maxCostRecord: pickExtreme(records, 'costPerKm', 'max'),
    minCostRecord: pickExtreme(records, 'costPerKm', 'min'),
    avgDisplayError: displayErrors.length > 0 ? round(average(displayErrors)!, 2) : null,
    spanMonths: spanMonths(records),
  };
};

const buildAnomalies = (records: FuelRecord[], stats: FuelReportStats): ReportAnomaly[] => {
  const anomalies: ReportAnomaly[] = [];
  records.forEach(record => {
    if (stats.avgFuelPer100 !== null && record.actualFuelPer100 !== null && record.actualFuelPer100 > stats.avgFuelPer100 + 0.3) {
      anomalies.push({
        id: `${record.id}-fuel`,
        type: 'fuel',
        title: '偏高记录',
        detail: `${record.actualFuelPer100.toFixed(2)} L/100km，高于周期平均 ${(record.actualFuelPer100 - stats.avgFuelPer100).toFixed(2)} L/100km`,
        date: record.date,
      });
    }
    if (stats.avgCostPerKm !== null && record.costPerKm !== null && record.costPerKm > stats.avgCostPerKm + 0.03) {
      anomalies.push({
        id: `${record.id}-cost`,
        type: 'cost',
        title: '成本偏高记录',
        detail: `${record.costPerKm.toFixed(2)} 元/km，高于周期平均 ${(record.costPerKm - stats.avgCostPerKm).toFixed(2)} 元/km`,
        date: record.date,
      });
    }
    if (record.actualFuelPer100 !== null && record.dashboardFuelPer100 !== null) {
      const diff = record.dashboardFuelPer100 - record.actualFuelPer100;
      if (Math.abs(diff) > 0.5) {
        anomalies.push({
          id: `${record.id}-display`,
          type: 'display',
          title: '表显偏差较大',
          detail: `表显较实际${diff < 0 ? '偏低' : '偏高'} ${Math.abs(diff).toFixed(2)} L/100km`,
          date: record.date,
        });
      }
    }
  });
  return anomalies;
};

const compareRecent = (records: FuelRecord[]) => {
  const values = records.filter(record => record.actualFuelPer100 !== null).map(record => record.actualFuelPer100!);
  if (values.length < 6) return null;
  const recent = values.slice(-3);
  const previous = values.slice(0, -3);
  const recentAvg = average(recent)!;
  const previousAvg = average(previous)!;
  return round(recentAvg - previousAvg, 2);
};

export const generateFuelAnalysisReport = (
  allRecords: FuelRecord[],
  period: ReportPeriod,
  now = new Date(),
): FuelAnalysisReport => {
  const periodLabel = reportPeriodOptions.find(option => option.id === period)?.label ?? '周期';
  const records = filterFuelRecordsByPeriod(allRecords, period, now);
  const stats = buildStats(records);
  const anomalies = buildAnomalies(records, stats);
  const trendDiff = stats.count >= 3 ? compareRecent(records) : null;
  const hasLongTrend = stats.count >= 3;
  const stageNote = stats.count < 3
    ? '少于 3 条：仅展示基础统计。数据量不足，暂不生成长期趋势结论。'
    : stats.count < 6
      ? '当前数据量较少，结论仅作为阶段参考。'
      : stats.count > 12
        ? '记录超过 12 条，可结合季度/年度趋势观察。'
        : '数据量可支持周期分析，长期判断仍建议持续记录。';

  const tone: ReportTone = anomalies.some(item => item.type === 'fuel' || item.type === 'cost')
    ? 'warn'
    : stats.avgFuelPer100 !== null && stats.avgFuelPer100 <= 6.5
      ? 'good'
      : 'neutral';

  const headline = records.length === 0
    ? '当前周期暂无可分析记录'
    : `本周期 ${records.length} 条记录，平均油耗 ${fmt(stats.avgFuelPer100)} L/100km，每公里成本 ${fmt(stats.avgCostPerKm)} 元`;

  const overview = records.length === 0
    ? '当前周期没有加油记录，请切换周期或先添加记录。'
    : `本周期累计行驶 ${fmt(stats.totalKm)} km，加油 ${fmt(stats.totalLiters)} L，实付 ${fmt(stats.totalCost)} 元。平均油耗 ${fmt(stats.avgFuelPer100)} L/100km，百公里油费 ${fmt(stats.costPer100Km)} 元。`;

  const fuelExtreme = `最高油耗记录为 ${stats.maxFuelRecord?.date ?? '--'}（${fmt(stats.maxFuelRecord?.actualFuelPer100)} L/100km），最低油耗记录为 ${stats.minFuelRecord?.date ?? '--'}（${fmt(stats.minFuelRecord?.actualFuelPer100)} L/100km）。`;
  const fuel = !hasLongTrend
    ? '数据量不足，暂不生成长期趋势结论。'
    : trendDiff === null
      ? `当前 ${stats.count} 条记录可做阶段分析，结论仅作为阶段参考，暂不生成长期趋势结论。`
      : Math.abs(trendDiff) <= 0.2
        ? `最近 3 次油耗与前期均值基本持平，波动约 ${Math.abs(trendDiff).toFixed(2)} L/100km。`
        : trendDiff > 0
          ? `最近 3 次平均油耗较前期高 ${trendDiff.toFixed(2)} L/100km，建议留意路况、胎压、空调和短途冷车比例。`
          : `最近 3 次平均油耗较前期低 ${Math.abs(trendDiff).toFixed(2)} L/100km，阶段表现有所改善。`;

  const cost = stats.avgCostPerKm === null
    ? '缺少有效里程，暂不能计算每公里成本。'
    : `平均每公里成本 ${stats.avgCostPerKm.toFixed(2)} 元，折合百公里油费 ${fmt(stats.costPer100Km)} 元。最高成本记录为 ${stats.maxCostRecord?.date ?? '--'}（${fmt(stats.maxCostRecord?.costPerKm)} 元/km），最低成本记录为 ${stats.minCostRecord?.date ?? '--'}（${fmt(stats.minCostRecord?.costPerKm)} 元/km）。`;

  const priceImpact = stats.weightedPrice === null
    ? '缺少有效加油金额或升数，暂不能分析油价影响。'
    : `加权平均油价 ${stats.weightedPrice.toFixed(2)} 元/L。油价变化会直接推高每公里成本；若油耗稳定但成本上升，主要压力通常来自油价。`;

  const display = stats.avgDisplayError === null
    ? '缺少表显油耗或实际油耗配对数据，暂不能评价表显准确性。'
    : `表显平均偏差 ${stats.avgDisplayError > 0 ? '+' : ''}${stats.avgDisplayError.toFixed(2)} L/100km，整体${stats.avgDisplayError < 0 ? '偏乐观' : stats.avgDisplayError > 0 ? '偏保守' : '接近实际'}。`;

  const anomalyText = anomalies.length === 0
    ? '当前周期未发现超过规则阈值的异常记录。'
    : anomalies.slice(0, 6).map(item => `${item.date} ${item.title}：${item.detail}`).join('\n');

  const adviceParts = [
    stats.count < 6 ? '当前数据量较少，结论仅作为阶段参考。' : '继续保持同一口径记录里程、升数、金额和表显油耗，后续趋势会更稳定。',
    anomalies.length > 0 ? '优先复核异常记录对应的路况、是否加满、胎压、拥堵和空调使用情况。' : '当前没有明显异常，建议继续积累记录用于季节对比。',
  ];
  if (stats.spanMonths >= 6) adviceParts.push('记录横跨 6 个月以上，可以观察季节变化对油耗和空调使用的影响。');
  if (stats.spanMonths >= 12) adviceParts.push('记录横跨 12 个月以上，增加年度成本分析：可以按年度估算总用车油费，并和保险、保养等费用合并复盘。');

  const sections = {
    overview,
    fuel: `${fuel}\n${fuelExtreme}`,
    cost,
    priceImpact,
    display,
    anomalies: anomalyText,
    advice: adviceParts.join('\n'),
  };

  const markdown = [
    `# 用车成本分析报告｜${periodLabel}`,
    '',
    `生成日期：${format(now, 'yyyy-MM-dd')}`,
    '',
    `## 总体结论`,
    overview,
    '',
    `## 油耗表现`,
    fuel,
    '',
    `## 成本变化`,
    cost,
    '',
    `## 油价与油耗影响`,
    priceImpact,
    '',
    `## 表显油耗准确性`,
    display,
    '',
    `## 异常记录提醒`,
    anomalyText,
    '',
    `## 后续建议`,
    sections.advice,
  ].join('\n');

  return {
    period,
    periodLabel,
    records,
    points: records.map(record => ({
      record,
      fuel: record.actualFuelPer100,
      cost: record.costPerKm,
      price: record.pricePerLiter,
      displayError: record.actualFuelPer100 !== null && record.dashboardFuelPer100 !== null
        ? round(record.dashboardFuelPer100 - record.actualFuelPer100, 2)
        : null,
      shortDate: format(parseISO(record.date), 'MM-dd'),
    })),
    stats,
    tone,
    headline,
    dataNote: stageNote,
    anomalies,
    sections,
    markdown,
  };
};
