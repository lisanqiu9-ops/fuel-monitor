import { FuelRecord } from '../types';
import { calculateEnergyMetrics, getPreviousRecord, type EnergyMetrics } from './metrics';

export type ReportTone = 'good' | 'warn' | 'danger' | 'neutral';

export interface FuelReport {
  title: string;
  tone: ReportTone;
  summary: string;
  points: string[];
  nextActions: string[];
}

type OcrFields = {
  date?: string | null;
  fuelLiters?: number | null;
  unitPrice?: number | null;
  totalCost?: number | null;
  fuelType?: string | null;
  drivenKm?: number | null;
  dashboardFuelPer100?: number | null;
  dashboardAvgSpeed?: number | null;
  dashboardDriveHours?: string | null;
  dashboardRange?: number | null;
  dashboardOdo?: number | null;
};

const formatSigned = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

const average = (values: number[]) => (
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
);

const getValidFuelRecords = (records: FuelRecord[]) => records.filter(record => record.actualFuelPer100 !== null);

const getFuelLevelText = (fuel: number) => {
  if (fuel <= 6) return '偏省';
  if (fuel <= 7.5) return '正常';
  return '偏高';
};

const describeDisplayError = (error: number) => {
  const abs = Math.abs(error);
  if (abs <= 0.25) return '表显油耗和实测结果基本一致，仪表盘参考价值较高。';
  if (error < 0) return `表显比实测低 ${abs.toFixed(2)} L/100km，仪表盘略偏乐观。`;
  return `表显比实测高 ${abs.toFixed(2)} L/100km，仪表盘略偏保守。`;
};

const getDataConfidenceText = (metrics: EnergyMetrics) => {
  if (metrics.odoStatus === 'high') return '里程闭环正常，本次数据可信度较高。';
  if (metrics.odoStatus === 'warn') return 'ODO 与小计里程有偏差，本次结论建议作为参考。';
  if (metrics.odoStatus === 'invalid') return 'ODO 与小计里程差异过大，本次实际油耗可能失真。';
  return '缺少连续 ODO 数据，暂时无法验证里程闭环。';
};

export function generateRecordReport(record: FuelRecord, allRecords: FuelRecord[]): FuelReport {
  const metrics = calculateEnergyMetrics(record, getPreviousRecord(allRecords, record));
  const validFuel = getValidFuelRecords(allRecords);
  const avgFuel = average(validFuel.map(item => item.actualFuelPer100!));
  const previousValid = validFuel.filter(item => item.id !== record.id);
  const previousAvgFuel = average(previousValid.map(item => item.actualFuelPer100!));
  const points: string[] = [];
  const nextActions: string[] = [];

  let title = '本次记录需要更多里程数据';
  let tone: ReportTone = 'neutral';
  let summary = '已保存加油金额和油量，但缺少本周期行驶里程，暂时不能计算真实百公里油耗。';

  if (metrics.actualFuelPer100 !== null) {
    const actual = metrics.actualFuelPer100;
    const levelText = getFuelLevelText(actual);
    title = `本次实际油耗 ${levelText}`;
    tone = actual <= 6 ? 'good' : actual <= 7.5 ? 'neutral' : 'warn';
    summary = `本次实际油耗为 ${actual.toFixed(2)} L/100km，每公里花费约 ${metrics.costPerKm?.toFixed(3) ?? '--'} 元。`;

    if (previousAvgFuel !== null) {
      const diff = actual - previousAvgFuel;
      const rate = Math.abs(diff / previousAvgFuel) * 100;
      if (rate < 3) {
        points.push(`与历史平均 ${previousAvgFuel.toFixed(2)} L/100km 基本持平，属于正常波动。`);
      } else if (diff > 0) {
        points.push(`比历史平均高 ${diff.toFixed(2)} L/100km，约上升 ${rate.toFixed(1)}%。`);
        tone = rate > 12 ? 'danger' : 'warn';
      } else {
        points.push(`比历史平均低 ${Math.abs(diff).toFixed(2)} L/100km，约下降 ${rate.toFixed(1)}%。`);
        tone = 'good';
      }
    } else if (avgFuel !== null) {
      points.push(`当前全周期平均油耗为 ${avgFuel.toFixed(2)} L/100km，后续记录越多，判断会越稳定。`);
    }
  } else {
    nextActions.push('补充“上次加油后行驶里程”，才能生成真实油耗结论。');
  }

  if (metrics.displayError !== null) {
    points.push(describeDisplayError(metrics.displayError));
  } else if (record.dashboardFuelPer100 !== null) {
    points.push('已有表显油耗，但缺少实测油耗或里程，暂时无法校准仪表盘误差。');
  }

  points.push(getDataConfidenceText(metrics));

  if (record.dashboardAvgSpeed !== null) {
    if (record.dashboardAvgSpeed < 25) {
      points.push(`本周期均速 ${record.dashboardAvgSpeed} km/h，偏低速/拥堵，油耗偏高通常可以解释。`);
    } else if (record.dashboardAvgSpeed > 55) {
      points.push(`本周期均速 ${record.dashboardAvgSpeed} km/h，更接近通畅或高速工况，油耗应相对稳定。`);
    }
  }

  if (record.dashboardRange !== null && record.dashboardRange <= 100) {
    points.push(`剩余续航 ${record.dashboardRange} km，已经接近低续航区间。`);
    nextActions.push('下次加油前优先确认剩余续航，避免低油量影响出行安排。');
  }

  if (metrics.actualFuelPer100 !== null && metrics.actualFuelPer100 > 7.5) {
    nextActions.push('连续 2-3 次偏高时，优先排查胎压、拥堵、空调、短途冷车和是否未加满。');
  }

  if (metrics.odoStatus !== 'high') {
    nextActions.push('每次加油后记录总里程 ODO，并确认小计里程已重置。');
  }

  if (nextActions.length === 0) {
    nextActions.push('继续按同一口径记录加油量、行驶里程和 ODO，观察长期趋势。');
  }

  return { title, tone, summary, points, nextActions };
}

export function generateTrendReport(records: FuelRecord[]): FuelReport {
  const enriched = records.map((record, index) => ({
    record,
    metrics: calculateEnergyMetrics(record, index > 0 ? records[index - 1] : null),
  }));
  const validFuel = enriched.filter(item => item.metrics.actualFuelPer100 !== null);
  const fuelValues = validFuel.map(item => item.metrics.actualFuelPer100!);
  const costValues = enriched
    .map(item => item.metrics.costPerKm)
    .filter((value): value is number => value !== null);
  const avgFuel = average(fuelValues);
  const avgCost = average(costValues);
  const recentFuel = fuelValues.slice(-3);
  const earlierFuel = fuelValues.slice(0, Math.max(0, fuelValues.length - recentFuel.length));
  const recentAvg = average(recentFuel);
  const earlierAvg = average(earlierFuel);
  const invalidCount = enriched.filter(item => item.metrics.odoStatus === 'invalid').length;
  const warnCount = enriched.filter(item => item.metrics.odoStatus === 'warn').length;
  const highCount = enriched.filter(item => item.metrics.odoStatus === 'high').length;
  const points: string[] = [];
  const nextActions: string[] = [];

  let title = '周期数据还在积累中';
  let tone: ReportTone = 'neutral';
  let summary = '当前记录数量较少，已经可以保存账本，但趋势判断还需要更多有效里程数据。';

  if (avgFuel !== null) {
    title = `长期平均油耗 ${avgFuel.toFixed(2)} L/100km`;
    summary = `当前共有 ${records.length} 次加油记录，其中 ${validFuel.length} 次可用于真实油耗分析。`;
    tone = avgFuel <= 6 ? 'good' : avgFuel <= 7.5 ? 'neutral' : 'warn';
    points.push(`平均每公里花费 ${avgCost !== null ? `${avgCost.toFixed(3)} 元` : '暂不可算'}，可作为后续用车成本基准。`);
  } else {
    nextActions.push('至少补齐一次“加油量 + 行驶里程”，趋势页才能计算真实油耗。');
  }

  if (recentAvg !== null && earlierAvg !== null) {
    const diff = recentAvg - earlierAvg;
    const rate = Math.abs(diff / earlierAvg) * 100;
    if (rate < 4) {
      points.push(`最近 ${recentFuel.length} 次油耗与前期基本持平，趋势稳定。`);
    } else if (diff > 0) {
      points.push(`最近 ${recentFuel.length} 次均值 ${recentAvg.toFixed(2)}，比前期高 ${diff.toFixed(2)} L/100km。`);
      tone = rate > 12 ? 'danger' : 'warn';
      nextActions.push('若路况没有明显变化，建议检查胎压、负载、保养周期和是否存在未加满记录。');
    } else {
      points.push(`最近 ${recentFuel.length} 次均值 ${recentAvg.toFixed(2)}，比前期低 ${Math.abs(diff).toFixed(2)} L/100km。`);
      tone = 'good';
    }
  }

  if (highCount > 0) {
    points.push(`${highCount} 个周期的 ODO 闭环可信，可作为主要判断依据。`);
  }
  if (invalidCount > 0 || warnCount > 0) {
    points.push(`${invalidCount + warnCount} 个周期需要复核里程，异常数据会拉偏平均油耗。`);
    nextActions.push('优先修正异常周期，再看长期均值和趋势。');
    if (invalidCount > 0) tone = 'warn';
  }

  if (records.length < 3) {
    nextActions.push('建议积累到 3 次以上完整加油记录后，再判断油耗是否真正升高或降低。');
  }

  if (nextActions.length === 0) {
    nextActions.push('保持同一加油口径，重点观察最近 3 次均值是否偏离长期平均。');
  }

  return { title, tone, summary, points, nextActions };
}

export function generateOcrPreviewReport(data: OcrFields): FuelReport {
  const points: string[] = [];
  const nextActions: string[] = [];
  const hasFuelReceipt = Boolean(data.fuelLiters && data.unitPrice && data.totalCost);
  const hasDashboard = Boolean(data.drivenKm || data.dashboardFuelPer100 || data.dashboardOdo);
  let title = '识别结果待确认';
  let tone: ReportTone = 'neutral';
  let summary = '请核对识别字段，确认后会写入加油记录。';

  if (hasFuelReceipt) {
    const calc = data.fuelLiters! * data.unitPrice!;
    const diff = Math.abs(calc - data.totalCost!);
    title = diff <= 1 ? '小票金额校验通过' : '小票金额需要复核';
    tone = diff <= 1 ? 'good' : 'warn';
    summary = `识别到加油 ${data.fuelLiters} L，单价 ${data.unitPrice} 元/L，金额 ${data.totalCost} 元。`;
    points.push(diff <= 1
      ? '加油量、单价和总价可以相互印证，基础数据可信度较高。'
      : `加油量乘单价与总价相差 ${diff.toFixed(2)} 元，请优先核对金额或升数。`);
  }

  if (data.fuelLiters && data.drivenKm && data.drivenKm > 0) {
    const actual = (data.fuelLiters / data.drivenKm) * 100;
    points.push(`按当前里程估算，实际油耗约 ${actual.toFixed(2)} L/100km。`);
    if (data.dashboardFuelPer100) {
      const error = data.dashboardFuelPer100 - actual;
      points.push(`表显与估算值差 ${formatSigned(error)} L/100km，确认后可用于校准仪表盘。`);
    }
  } else if (hasFuelReceipt && !data.drivenKm) {
    nextActions.push('补充仪表盘“上次加油后行驶里程”，才能生成完整油耗结论。');
  }

  if (hasDashboard) {
    points.push('已识别到仪表盘数据，建议确认行驶里程、表显油耗和总里程是否属于同一加油周期。');
  } else {
    nextActions.push('可以继续补充仪表盘照片，让报告同时包含实际油耗和表显误差。');
  }

  if (nextActions.length === 0) {
    nextActions.push('确认无误后填入表单，保存后可在详情页查看完整解读。');
  }

  return { title, tone, summary, points, nextActions };
}
