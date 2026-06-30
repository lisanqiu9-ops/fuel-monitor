export type FuelFillType = 'full' | 'partial';

export interface FuelRecord {
  id: string;
  date: string; // YYYY-MM-DD
  fillType: FuelFillType;
  fuelLiters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType?: string | null;
  drivenKm: number | null;
  actualFuelPer100: number | null;
  dashboardOdo: number | null;
  dashboardAvgSpeed: number | null;
  dashboardDriveHours: string | null; // e.g. "24:23", changed to string because the previous code parses it that way '24:23h'
  dashboardFuelPer100: number | null;
  dashboardRange: number | null;
  costPerKm: number | null;
}
