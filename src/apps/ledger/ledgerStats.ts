import type { LedgerRecord, QualityItem } from './ledgerTypes';
export const displayValue = (value: string) => value.trim() || '-';
export const isPending = (value: string) => !value.trim() || value.trim() === '待确认';
export const expenseRecords = (records: LedgerRecord[]) => records.filter(record => record.type === '支出' && record.amountValid && record.amount > 0);
export const money = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(amount);
export const recordDateTime = (record: LedgerRecord) => {
  const timestamp = Date.parse(`${record.date}${record.time ? ` ${record.time}` : ''}`.replace(/-/g, '/'));
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const dateKey = (record: LedgerRecord) => /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : '';
const rank = (items: LedgerRecord[], getKey: (record: LedgerRecord) => string, limit = 10) => {
  const buckets = new Map<string, number>();
  items.forEach(record => { const key = displayValue(getKey(record)); buckets.set(key, (buckets.get(key) ?? 0) + record.amount); });
  return [...buckets.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, limit);
};
export const buildStats = (records: LedgerRecord[]) => {
  const expenses = expenseRecords(records);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentExpenses = expenses.filter(record => record.date.startsWith(monthKey));
  const sum = (items: LedgerRecord[]) => items.reduce((total, record) => total + record.amount, 0);
  const largest = currentExpenses.reduce<LedgerRecord | undefined>((best, record) => !best || record.amount > best.amount ? record : best, undefined);
  const activeDays = new Set(currentExpenses.map(dateKey).filter(Boolean)).size;
  const latest = [...records].sort((a, b) => recordDateTime(b) - recordDateTime(a))[0];
  const monthly = rank(expenses, record => record.date.slice(0, 7), 120).sort((a, b) => a.name.localeCompare(b.name));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const dailyMap = new Map<string, number>();
  expenses.forEach(record => { const date = dateKey(record); if (date && new Date(`${date}T00:00:00`) >= start) dailyMap.set(date, (dailyMap.get(date) ?? 0) + record.amount); });
  const daily = Array.from({ length: 30 }, (_, offset) => {
    const date = new Date(start); date.setDate(start.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { name: key.slice(5), amount: dailyMap.get(key) ?? 0 };
  });
  return { monthKey, currentTotal: sum(currentExpenses), currentCount: currentExpenses.length, dailyAverage: activeDays ? sum(currentExpenses) / activeDays : 0, /* 口径：本月有消费记录的自然日。 */ largest: largest?.amount ?? 0, topCategory: rank(currentExpenses, record => record.category1, 1)[0], topMerchant: rank(currentExpenses, record => record.merchant, 1)[0], allTotal: sum(expenses), allCount: expenses.length, latest, monthly, daily, categories: rank(expenses, record => record.category1), merchants: rank(expenses, record => record.merchant), accounts: rank(expenses, record => record.account), payMethods: rank(expenses, record => record.payMethod) };
};
export const buildQuality = (records: LedgerRecord[], parserIssueCount: number, missingFields: string[]): QualityItem[] => {
  const invalidAmount = records.filter(record => !record.amountValid || record.amount <= 0 || record.amount > 10000);
  const byOrder = new Map<string, LedgerRecord[]>();
  records.filter(record => record.orderNo.trim()).forEach(record => byOrder.set(record.orderNo, [...(byOrder.get(record.orderNo) ?? []), record]));
  const duplicateRecords = [...byOrder.values()].filter(group => group.length > 1).flat();
  const items: QualityItem[] = [
    { key: 'merchant', title: '商户待确认', severity: 'notice', description: 'merchant 为空或标为“待确认”', records: records.filter(record => isPending(record.merchant)) },
    { key: 'account', title: '账户待确认', severity: 'notice', description: 'account 为空或标为“待确认”', records: records.filter(record => isPending(record.account)) },
    { key: 'order', title: '订单号为空', severity: 'notice', description: 'order_no 为空，无法用于精确去重', records: records.filter(record => !record.orderNo.trim()) },
    { key: 'duplicate', title: '重复订单号', severity: 'critical', description: '相同的非空 order_no 出现多次', records: duplicateRecords },
    { key: 'amount', title: '金额异常', severity: 'critical', description: '金额无效、≤ 0 或大于 ¥10,000', records: invalidAmount },
    { key: 'id', title: '可疑记录 ID', severity: 'critical', description: '第一列不是 txn_ 开头，建议核对原始行', records: records.filter(record => !record.id.startsWith('txn_')) },
    { key: 'required', title: '必要字段缺失', severity: 'critical', description: '缺少 id、date、type 或 category1 的记录', records: records.filter(record => !record.id || !record.date || !record.type || !record.category1) },
  ];
  if (parserIssueCount || missingFields.length) { const parseRecords = records.filter(record => record.parseIssues.length > 0); items.push({ key: 'parse', title: '解析或字段异常', severity: 'critical', description: `解析异常 ${parserIssueCount} 条；缺少表头：${missingFields.join('、') || '无'}`, records: parseRecords, count: Math.max(parseRecords.length, parserIssueCount, missingFields.length) }); }
  return items;
};

