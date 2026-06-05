import { FuelRecord } from '../types';

export type OdoValidationStatus = 'missing' | 'high' | 'warn' | 'invalid';

export interface EnergyMetrics {
  actualFuelPer100: number | null;
  costPerKm: number | null;
  fuelPerKm: number | null;
  displayError: number | null;
  odoDelta: number | null;
  odoDiff: number | null;
  odoStatus: OdoValidationStatus;
  odoMessage: string;
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function calculateEnergyMetrics(record: FuelRecord, previous?: FuelRecord | null): EnergyMetrics {
  const hasDistance = record.drivenKm !== null && record.drivenKm > 0;
  const actualFuelPer100 = hasDistance ? round((record.fuelLiters / record.drivenKm!) * 100, 2) : null;
  const costPerKm = hasDistance ? round(record.totalCost / record.drivenKm!, 3) : null;
  const fuelPerKm = hasDistance ? round(record.fuelLiters / record.drivenKm!, 4) : null;
  const displayError = actualFuelPer100 !== null && record.dashboardFuelPer100 !== null
    ? round(record.dashboardFuelPer100 - actualFuelPer100, 2)
    : null;

  let odoDelta: number | null = null;
  let odoDiff: number | null = null;
  let odoStatus: OdoValidationStatus = 'missing';
  let odoMessage = '缺少连续 ODO 数据，无法校验里程闭环';

  if (record.dashboardOdo !== null && previous && previous.dashboardOdo !== null && hasDistance) {
    odoDelta = round(record.dashboardOdo - previous.dashboardOdo, 1);
    odoDiff = round(odoDelta - record.drivenKm!, 1);
    const absDiff = Math.abs(odoDiff);

    if (absDiff <= 3) {
      odoStatus = 'high';
      odoMessage = 'ODO 与小计里程闭环一致，数据置信度高';
    } else if (absDiff > 50) {
      odoStatus = 'invalid';
      odoMessage = 'ODO 与小计里程差异过大，可能遗漏记录、未加满或小计里程未重置';
    } else {
      odoStatus = 'warn';
      odoMessage = 'ODO 与小计里程存在偏差，请人工复核';
    }
  }

  return {
    actualFuelPer100,
    costPerKm,
    fuelPerKm,
    displayError,
    odoDelta,
    odoDiff,
    odoStatus,
    odoMessage,
  };
}

export function getPreviousRecord(records: FuelRecord[], record: FuelRecord) {
  const index = records.findIndex(item => item.id === record.id);
  if (index <= 0) return null;
  return records[index - 1];
}
