import type { LedgerRecord, QualityItem } from './ledgerTypes';

export type LedgerScope = 'latestMonth' | 'selectedMonth' | 'currentMonth' | 'lastMonth' | 'currentYear' | 'all';

export const displayValue = (value: string) => value.trim() || '-';
export const isPending = (value: string) => !value.trim() || value.trim() === '待确认';
export const isUnconfirmed = (record: LedgerRecord) => record.confirmed.trim().toLowerCase() !== 'true';
export const expenseRecords = (records: LedgerRecord[]) => records.filter(record => record.type === '支出' && record.amountValid && record.amount > 0);
export const money = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(amount);
export const recordDateTime = (record: LedgerRecord) => {
  const timestamp = Date.parse(`${record.date}${record.time ? ` ${record.time}` : ''}`.replace(/-/g, '/'));
  return Number.isFinite(timestamp) ? timestamp : 0;
};
export const ledgerMonths = (records: LedgerRecord[]) => {
  return [...new Set(records.map(record => record.date.slice(0, 7)).filter(Boolean))].sort().reverse();
};

const dateKey = (record: LedgerRecord) => /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : '';
const formatMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const previousMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() - 1, 1);
const rank = (items: LedgerRecord[], getKey: (record: LedgerRecord) => string, limit = 10) => {
  const buckets = new Map<string, number>();
  items.forEach(record => {
    const key = displayValue(getKey(record));
    buckets.set(key, (buckets.get(key) ?? 0) + record.amount);
  });
  return [...buckets.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, limit);
};
const chooseLatestMonth = (records: LedgerRecord[], fallback: string) => {
  return ledgerMonths(records)[0] ?? fallback;
};
const scopeTitle = (scope: LedgerScope, monthKey: string) => {
  if (scope === 'latestMonth' || scope === 'selectedMonth') return `${monthKey} 支出`;
  if (scope === 'currentMonth') return '本月支出';
  if (scope === 'lastMonth') return '上月支出';
  if (scope === 'currentYear') return '今年支出';
  return '全部支出';
};
const scopeNote = (scope: LedgerScope, monthKey: string, yearKey: string) => {
  if (scope === 'currentYear') return yearKey;
  if (scope === 'all') return '全部有效支出';
  return monthKey;
};

export const buildStats = (records: LedgerRecord[], scope: LedgerScope = 'latestMonth', selectedMonth?: string) => {
  const expenses = expenseRecords(records);
  const now = new Date();
  const currentMonthKey = formatMonth(now);
  const latestMonthKey = chooseLatestMonth(expenses, currentMonthKey);
  const monthKey = scope === 'selectedMonth' && selectedMonth
    ? selectedMonth
    : scope === 'currentMonth'
      ? currentMonthKey
      : scope === 'lastMonth'
        ? formatMonth(previousMonth(now))
        : latestMonthKey;
  const yearKey = String(now.getFullYear());
  const scopedExpenses = scope === 'all'
    ? expenses
    : scope === 'currentYear'
      ? expenses.filter(record => record.date.startsWith(yearKey))
      : expenses.filter(record => record.date.startsWith(monthKey));
  const sum = (items: LedgerRecord[]) => items.reduce((total, record) => total + record.amount, 0);
  const largest = scopedExpenses.reduce<LedgerRecord | undefined>((best, record) => !best || record.amount > best.amount ? record : best, undefined);
  const activeDays = new Set(scopedExpenses.map(dateKey).filter(Boolean)).size;
  const latest = [...records].sort((a, b) => recordDateTime(b) - recordDateTime(a))[0];
  const monthly = rank(expenses, record => record.date.slice(0, 7), 120).sort((a, b) => a.name.localeCompare(b.name));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const dailyMap = new Map<string, number>();
  expenses.forEach(record => {
    const date = dateKey(record);
    if (date && new Date(`${date}T00:00:00`) >= start) dailyMap.set(date, (dailyMap.get(date) ?? 0) + record.amount);
  });
  const daily = Array.from({ length: 30 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { name: key.slice(5), amount: dailyMap.get(key) ?? 0 };
  });
  return {
    scope,
    scopeTitle: scopeTitle(scope, monthKey),
    scopeNote: scopeNote(scope, monthKey, yearKey),
    monthKey,
    currentMonthKey,
    latestMonthKey,
    currentTotal: sum(scopedExpenses),
    currentCount: scopedExpenses.length,
    dailyAverage: activeDays ? sum(scopedExpenses) / activeDays : 0,
    largest: largest?.amount ?? 0,
    topCategory: rank(scopedExpenses, record => record.category1, 1)[0],
    topMerchant: rank(scopedExpenses, record => record.merchant, 1)[0],
    allTotal: sum(expenses),
    allCount: expenses.length,
    latest,
    monthly,
    daily,
    categories: rank(expenses, record => record.category1),
    merchants: rank(expenses, record => record.merchant),
    accounts: rank(expenses, record => record.account),
    payMethods: rank(expenses, record => record.payMethod),
  };
};

export const buildQuality = (records: LedgerRecord[], parserIssueCount: number, missingFields: string[]): QualityItem[] => {
  const invalidAmount = records.filter(record => !record.amountValid || record.amount <= 0);
  const largeAmount = records.filter(record => record.amountValid && record.amount > 10000);
  const byOrder = new Map<string, LedgerRecord[]>();
  records.filter(record => record.orderNo.trim()).forEach(record => byOrder.set(record.orderNo, [...(byOrder.get(record.orderNo) ?? []), record]));
  const duplicateRecords = [...byOrder.values()].filter(group => group.length > 1).flat();
  const items: QualityItem[] = [
    { key: 'confirmed', title: '记录待确认', severity: 'notice', description: 'confirmed 不为 true，建议人工核对提取结果', records: records.filter(isUnconfirmed) },
    { key: 'merchant', title: '商户待确认', severity: 'notice', description: 'merchant 为空或标为“待确认”', records: records.filter(record => isPending(record.merchant)) },
    { key: 'account', title: '账户待确认', severity: 'notice', description: 'account 为空或标为“待确认”', records: records.filter(record => isPending(record.account)) },
    { key: 'order', title: '订单号为空', severity: 'notice', description: 'order_no 为空，无法用于精确去重', records: records.filter(record => !record.orderNo.trim()) },
    { key: 'largeAmount', title: '大额记录', severity: 'notice', description: '金额大于 ¥10,000，建议确认是否为收入、房租、医疗或大额采购', records: largeAmount },
    { key: 'duplicate', title: '重复订单号', severity: 'critical', description: '相同的非空 order_no 出现多次', records: duplicateRecords },
    { key: 'amount', title: '金额异常', severity: 'critical', description: '金额无效或小于等于 0', records: invalidAmount },
    { key: 'id', title: '可疑记录 ID', severity: 'critical', description: '第一列不是 txn_ 开头，建议核对原始行', records: records.filter(record => !record.id.startsWith('txn_')) },
    { key: 'required', title: '必要字段缺失', severity: 'critical', description: '缺少 id、date、type 或 category1 的记录', records: records.filter(record => !record.id || !record.date || !record.type || !record.category1) },
  ];
  if (parserIssueCount || missingFields.length) {
    const parseRecords = records.filter(record => record.parseIssues.length > 0);
    items.push({ key: 'parse', title: '解析或字段异常', severity: 'critical', description: `解析异常 ${parserIssueCount} 条；缺少表头：${missingFields.join('、') || '无'}`, records: parseRecords, count: Math.max(parseRecords.length, parserIssueCount, missingFields.length) });
  }
  return items;
};
