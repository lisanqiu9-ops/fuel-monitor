import { FuelRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'fuellog_records';

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

const normalizeRecord = (raw: unknown): FuelRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<FuelRecord>;

  if (!isValidDate(value.date)) return null;

  const fuelLiters = parseRequiredPositiveNumber(value.fuelLiters);
  const pricePerLiter = parseRequiredPositiveNumber(value.pricePerLiter);
  const totalCost = parseRequiredPositiveNumber(value.totalCost);
  if (fuelLiters === null || pricePerLiter === null || totalCost === null) return null;

  const drivenKm = parseOptionalNonNegativeNumber(value.drivenKm);
  const safeDrivenKm = drivenKm !== null && drivenKm > 0 ? drivenKm : null;
  const actualFuelPer100 = safeDrivenKm
    ? Number(((fuelLiters / safeDrivenKm) * 100).toFixed(2))
    : null;
  const costPerKm = safeDrivenKm ? Number((totalCost / safeDrivenKm).toFixed(3)) : null;

  return {
    id: typeof value.id === 'string' && value.id ? value.id : uuidv4(),
    date: value.date,
    fuelLiters,
    pricePerLiter,
    totalCost,
    fuelType: typeof value.fuelType === 'string' && value.fuelType.trim() ? value.fuelType.trim() : null,
    drivenKm: safeDrivenKm,
    actualFuelPer100,
    costPerKm,
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

export const normalizeFuelRecords = (input: unknown): FuelRecord[] => {
  const rawRecords =
    Array.isArray(input)
      ? input
      : input && typeof input === 'object' && Array.isArray((input as { records?: unknown }).records)
        ? (input as { records: unknown[] }).records
        : [];

  return rawRecords
    .map(normalizeRecord)
    .filter((record): record is FuelRecord => record !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
