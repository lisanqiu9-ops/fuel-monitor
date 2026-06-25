import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LedgerRecord } from './ledgerTypes';
import { isPending, recordDateTime } from './ledgerStats';
import { LedgerTransactionCard } from './LedgerTransactionCard';

export function LedgerTransactionsPage({ records }: { records: LedgerRecord[] }) {
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('all');
  const [category, setCategory] = useState('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const months = useMemo(() => [...new Set(records.map(record => record.date.slice(0, 7)).filter(Boolean))].sort().reverse(), [records]);
  const categories = useMemo(() => [...new Set(records.map(record => record.category1).filter(Boolean))].sort(), [records]);
  const filtered = useMemo(() => records.filter(record => {
    const search = (record.merchant + ' ' + record.account + ' ' + record.payMethod + ' ' + record.orderNo + ' ' + record.category1).toLowerCase();
    const pending = [record.category1, record.merchant, record.account].some(isPending);
    return (month === 'all' || record.date.startsWith(month)) && (category === 'all' || record.category1 === category) && (!pendingOnly || pending) && (!query.trim() || search.includes(query.trim().toLowerCase()));
  }).sort((a, b) => recordDateTime(b) - recordDateTime(a)), [records, month, category, pendingOnly, query]);
  return <div className="space-y-4">
    <div><h2 className="text-lg font-black">流水明细</h2><p className="mt-1 text-xs font-bold text-[#8b7471]">搜索、筛选并核对每一笔记录</p></div>
    <section className="rounded-2xl border border-white/80 bg-white/76 p-3 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
      <label className="flex h-10 items-center gap-2 rounded-xl bg-[#f6f0ec] px-3 text-[#9a817e]"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索商户、账户或订单号" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#403632] outline-none placeholder:text-[#b49e98]" /></label>
      <div className="mt-2 grid grid-cols-2 gap-2"><select value={month} onChange={event => setMonth(event.target.value)} className="h-10 min-w-0 rounded-xl bg-[#f6f0ec] px-2 text-xs font-black text-[#5f4d49] outline-none"><option value="all">全部月份</option>{months.map(value => <option key={value} value={value}>{value}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)} className="h-10 min-w-0 rounded-xl bg-[#f6f0ec] px-2 text-xs font-black text-[#5f4d49] outline-none"><option value="all">全部分类</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      <button type="button" onClick={() => setPendingOnly(value => !value)} className={'mt-2 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-black ' + (pendingOnly ? 'bg-[#fff0db] text-[#a4772c]' : 'bg-[#f6f0ec] text-[#8b7471]')}><SlidersHorizontal size={14} />仅看待确认</button>
    </section>
    <div className="flex items-center justify-between"><p className="text-xs font-black text-[#8b7471]">筛选结果</p><strong className="text-sm font-black text-[#76506f]">{filtered.length} 条</strong></div>
    <div className="space-y-2.5">{filtered.slice(0, 120).map(record => <LedgerTransactionCard key={record.id + '-' + record.sourceRow} record={record} />)}{!filtered.length && <p className="rounded-2xl bg-white/60 p-6 text-center text-sm font-bold text-[#8b7471]">没有符合条件的流水。</p>}{filtered.length > 120 && <p className="rounded-2xl bg-white/55 px-4 py-3 text-center text-xs font-bold text-[#8b7471]">已展示最近 120 条，请用搜索或筛选缩小范围。</p>}</div>
  </div>;
}
