import { FuelFillType, FuelRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'fuellog_records';

export const normalizeFuelType = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/98/.test(text)) return '98#';
  if (/95/.test(text)) return '95#';
  if (/92/.test(text)) return '92#';
  if (/0\s*#?|柴油|柴/.test(text)) return '0#';
  return text;
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseOptionalNonNegativeNumber = (value: unknown): number | null => {
  const num = parseOptionalNumber(value);
  return num !== null && num >= 0 ? num : null;
};

const parseRequiredPositiveNumber = (value: unknown): number | null => {
  const num = parseOptionalNumber(value);
  return num !== null && num > 0 ? num : null;
};

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
};

const parseFillType = (value: unknown): FuelFillType => (
  value === 'partial' ? 'partial' : 'full'
);

const normalizeRecord = (raw: unknown): FuelRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<FuelRecord>;

  if (!isValidDate(value.date)) return null;

  const fuelLiters = parseRequiredPositiveNumber(value.fuelLiters);
  const pricePerLiter = parseRequiredPositiveNumber(value.pricePerLiter);
  const totalCost = parseRequiredPositiveNumber(value.totalCost);
  if (fuelLiters === null || pricePerLiter === null || totalCost === null) return null;

  return {
    id: typeof value.id === 'string' && value.id ? value.id : uuidv4(),
    date: value.date,
    fillType: parseFillType(value.fillType),
    fuelLiters,
    pricePerLiter,
    totalCost,
    fuelType: normalizeFuelType(value.fuelType),
    drivenKm: parseOptionalNonNegativeNumber(value.drivenKm),
    actualFuelPer100: null,
    costPerKm: null,
    dashboardOdo: parseOptionalNonNegativeNumber(value.dashboardOdo),
    dashboardAvgSpeed: parseOptionalNonNegativeNumber(value.dashboardAvgSpeed),
    dashboardDriveHours:
      typeof value.dashboardDriveHours === 'string' && value.dashboardDriveHours.trim()
        ? value.dashboardDriveHours.trim()
        : null,
    dashboardFuelPer100: parseOptionalNonNegativeNumber(value.dashboardFuelPer100),
    dashboardRange: parseOptionalNonNegativeNumber(value.dashboardRange),
  };
};

const recalculateFuelCycles = (records: FuelRecord[]): FuelRecord[] => {
  const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return sorted.map((record, index) => {
    if (record.fillType === 'partial') {
      return { ...record, actualFuelPer100: null, costPerKm: null };
    }

    let previousFullIndex = -1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (sorted[i].fillType === 'full') {
        previousFullIndex = i;
        break;
      }
    }

    const segment = previousFullIndex >= 0
      ? sorted.slice(previousFullIndex + 1, index + 1)
      : sorted.slice(0, index + 1);
    const hasOpenPartialBeforeFirstFull = previousFullIndex < 0 && segment.slice(0, -1).some(item => item.fillType === 'partial');
    if (hasOpenPartialBeforeFirstFull) {
      return { ...record, actualFuelPer100: null, costPerKm: null };
    }

    const totalKm = segment.reduce((sum, item) => sum + (item.drivenKm ?? 0), 0);
    if (totalKm <= 0) {
      return { ...record, actualFuelPer100: null, costPerKm: null };
    }

    const totalLiters = segment.reduce((sum, item) => sum + item.fuelLiters, 0);
    const totalCost = segment.reduce((sum, item) => sum + item.totalCost, 0);
    return {
      ...record,
      actualFuelPer100: Number(((totalLiters / totalKm) * 100).toFixed(2)),
      costPerKm: Number((totalCost / totalKm).toFixed(3)),
    };
  });
};

export const normalizeFuelRecords = (input: unknown): FuelRecord[] => {
  const rawRecords =
    Array.isArray(input)
      ? input
      : input && typeof input === 'object' && Array.isArray((input as { records?: unknown }).records)
        ? (input as { records: unknown[] }).records
        : [];

  const records = rawRecords
    .map(normalizeRecord)
    .filter((record): record is FuelRecord => record !== null);

  return recalculateFuelCycles(records);
};

export const loadInitialData = (): FuelRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return normalizeFuelRecords(JSON.parse(stored));
  } catch (e) {
    console.error('Failed to parse stored records', e);
    return [];
  }
};

export const saveRecords = (records: FuelRecord[]) => {
  const sorted = normalizeFuelRecords(records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
};

export const createExportPayload = (records: FuelRecord[]) => ({
  app: 'fuel-consumption-monitor',
  version: 1,
  exportedAt: new Date().toISOString(),
  records: normalizeFuelRecords(records),
});
