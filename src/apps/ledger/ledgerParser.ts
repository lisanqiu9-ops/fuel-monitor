import Papa from 'papaparse';
import { LEDGER_FIELDS, type LedgerField, type LedgerRecord, type ParsedLedger, type RawLedgerRow } from './ledgerTypes';

const field = (row: RawLedgerRow, name: LedgerField) => String(row[name] ?? '').trim();
const parseAmount = (raw: string) => {
  const normalized = raw.replace(/[¥￥,\s]/g, '');
  const amount = Number(normalized);
  return { amount, valid: normalized.length > 0 && Number.isFinite(amount) };
};
const toRecord = (row: RawLedgerRow, sourceRow: number): LedgerRecord => {
  const amountRaw = field(row, 'amount');
  const parsedAmount = parseAmount(amountRaw);
  return {
    id: field(row, 'id'), date: field(row, 'date'), time: field(row, 'time'), type: field(row, 'type'),
    amount: parsedAmount.amount, amountRaw, amountValid: parsedAmount.valid,
    category1: field(row, 'category1'), category2: field(row, 'category2'), merchant: field(row, 'merchant'),
    account: field(row, 'account'), payMethod: field(row, 'pay_method'), person: field(row, 'person'), tags: field(row, 'tags'),
    note: field(row, 'note'), orderNo: field(row, 'order_no'), source: field(row, 'source'),
    rawTextPreview: field(row, 'raw_text_preview'), confirmed: field(row, 'confirmed'), createdAt: field(row, 'created_at'),
    sourceRow, rawRow: LEDGER_FIELDS.map(name => field(row, name)).join(' | '), parseIssues: [],
  };
};
export async function parseLedgerFile(file: File): Promise<ParsedLedger> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  return new Promise((resolve, reject) => Papa.parse<RawLedgerRow>(text, {
    header: true, delimiter: '', skipEmptyLines: 'greedy',
    transformHeader: header => header.replace(/^\uFEFF/, '').trim(),
    complete: result => {
      const headers = (result.meta.fields ?? []).map(header => header.replace(/^\uFEFF/, '').trim());
      const missingFields = LEDGER_FIELDS.filter(name => !headers.includes(name));
      const parserIssues = result.errors.map(error => ({ row: error.row + 2, code: error.code, message: error.message }));
      const records = result.data.filter(row => Object.values(row).some(value => String(value ?? '').trim())).map((row, index) => {
        const record = toRecord(row, index + 2);
        record.parseIssues = parserIssues.filter(issue => issue.row === record.sourceRow).map(issue => issue.message);
        return record;
      });
      resolve({ records, parserIssues, delimiter: result.meta.delimiter || ',', missingFields });
    },
    error: error => reject(new Error(error.message || 'CSV 读取失败，请重新选择文件。')),
  }));
}
export const cacheKey = 'sanqiu-ledger-cache';

