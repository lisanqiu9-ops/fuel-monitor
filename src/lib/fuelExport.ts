import { createExportPayload, normalizeFuelRecords } from '../data';
import type { FuelRecord } from '../types';

const downloadTextFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const fmt = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '' : value.toFixed(digits);

export const createFuelCsv = (records: FuelRecord[]) => {
  const headers = [
    '日期',
    '油品',
    '加油方式',
    '行驶里程(km)',
    '加油量(L)',
    '实付金额(元)',
    '当日油价(元/L)',
    '实际油耗(L/100km)',
    '每公里成本(元/km)',
    '表显油耗(L/100km)',
    '表显续航(km)',
    '总里程ODO(km)',
  ];

  const rows = normalizeFuelRecords(records).map(record => [
    record.date,
    record.fuelType ?? '',
    record.fillType === 'partial' ? '固定金额/未加满' : '加满跳枪',
    fmt(record.drivenKm, 2),
    fmt(record.fuelLiters, 2),
    fmt(record.totalCost, 2),
    fmt(record.pricePerLiter, 2),
    fmt(record.actualFuelPer100, 2),
    fmt(record.costPerKm, 2),
    fmt(record.dashboardFuelPer100, 1),
    fmt(record.dashboardRange, 0),
    fmt(record.dashboardOdo, 0),
  ]);

  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`;
};

export const downloadFuelCsv = (records: FuelRecord[]) => {
  downloadTextFile(createFuelCsv(records), `fuel-records-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
};

export const downloadFuelJsonBackup = (records: FuelRecord[]) => {
  const payload = createExportPayload(records);
  downloadTextFile(
    JSON.stringify(payload, null, 2),
    `fuel-records-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json;charset=utf-8',
  );
  return payload.records.length;
};

export const downloadMarkdownReport = (markdown: string, filenamePrefix = 'fuel-report') => {
  downloadTextFile(
    markdown,
    `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.md`,
    'text/markdown;charset=utf-8',
  );
};

export const createRecordNotesSummary = (record: FuelRecord) => {
  const actual = record.actualFuelPer100;
  const cost = record.costPerKm;
  const dash = record.dashboardFuelPer100;
  const diff = actual !== null && dash !== null ? dash - actual : null;
  const diffText = diff === null
    ? '暂无表显误差数据'
    : `表显 ${dash!.toFixed(1)} L/100km，较实际${diff < 0 ? '偏低' : '偏高'} ${Math.abs(diff).toFixed(2)} L/100km`;

  return [
    `车辆油耗记录｜${record.date}`,
    '',
    `实际百公里油耗：${actual !== null ? actual.toFixed(2) : '--'} L/100km`,
    `每公里综合成本：${cost !== null ? cost.toFixed(2) : '--'} 元`,
    `表显误差：${diffText}`,
    '',
    '基础数据：',
    `行驶里程：${record.drivenKm !== null ? record.drivenKm.toFixed(0) : '--'} km`,
    `加油方式：${record.fillType === 'partial' ? '固定金额/未加满' : '加满跳枪'}`,
    `加油量：${record.fuelLiters.toFixed(2)} L`,
    `实付金额：${record.totalCost.toFixed(2)} 元`,
    `当日油价：${record.pricePerLiter.toFixed(2)} 元/L`,
    `表显续航：${record.dashboardRange !== null ? `剩余 ${record.dashboardRange.toFixed(0)} km` : '--'}`,
  ].join('\n');
};

export const shareText = async (title: string, text: string) => {
  if (navigator.share) {
    await navigator.share({ title, text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
};
