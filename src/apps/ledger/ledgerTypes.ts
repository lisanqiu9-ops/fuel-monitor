export const LEDGER_FIELDS = [
  'id', 'date', 'time', 'type', 'amount', 'category1', 'category2', 'merchant',
  'account', 'pay_method', 'person', 'tags', 'note', 'order_no', 'source',
  'raw_text_preview', 'confirmed', 'created_at',
] as const;
export type LedgerField = (typeof LEDGER_FIELDS)[number];
export type RawLedgerRow = Partial<Record<LedgerField, string>>;
export interface LedgerRecord {
  id: string; date: string; time: string; type: string;
  amount: number; amountRaw: string; amountValid: boolean;
  category1: string; category2: string; merchant: string; account: string; payMethod: string;
  person: string; tags: string; note: string; orderNo: string; source: string;
  rawTextPreview: string; confirmed: string; createdAt: string;
  sourceRow: number; rawRow: string; parseIssues: string[];
}
export interface ParserIssue { row: number; message: string; code?: string; }
export interface ParsedLedger { records: LedgerRecord[]; parserIssues: ParserIssue[]; delimiter: string; missingFields: LedgerField[]; }
export interface LedgerCache extends ParsedLedger { version: 1; fileName: string; importedAt: string; }
export type QualitySeverity = 'normal' | 'notice' | 'critical';
export interface QualityItem { key: string; title: string; severity: QualitySeverity; description: string; records: LedgerRecord[]; count?: number; }

