import { AlertTriangle, Landmark, ReceiptText, Tags, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LedgerRecord, QualityItem } from './ledgerTypes';
import { buildStats, ledgerMonths, money, recordDateTime, type LedgerScope } from './ledgerStats';
import { LedgerTransactionCard } from './LedgerTransactionCard';

interface Props {
  stats: ReturnType<typeof buildStats>;
  records: LedgerRecord[];
  quality: QualityItem[];
  onOpenQuality: () => void;
  onOpenTransactions: () => void;
}

function SummaryCard({ title, value, note, icon: Icon, tone }: { title: string; value: string; note: string; icon: typeof TrendingUp; tone: string }) {
  return <article className="rounded-2xl border border-white/80 bg-white/76 p-3.5 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
    <div className="flex items-center gap-2">
      <span className={'grid h-8 w-8 place-items-center rounded-xl ' + tone}><Icon size={15} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-[#9a817e]">{title}</p>
        <strong className="mt-0.5 block truncate text-base font-black text-[#403632]" title={value}>{value}</strong>
      </div>
    </div>
    <p className="mt-2 truncate text-[11px] font-bold text-[#8b7471]" title={note}>{note}</p>
  </article>;
}

const scopeOptions: { value: LedgerScope; label: string }[] = [
  { value: 'latestMonth', label: '最近月份' },
  { value: 'currentMonth', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'currentYear', label: '今年' },
  { value: 'all', label: '全部' },
];

export function LedgerOverviewPage({ stats, records, quality, onOpenQuality, onOpenTransactions }: Props) {
  const [scope, setScope] = useState<LedgerScope>(stats.scope);
  const [selectedMonth, setSelectedMonth] = useState(stats.latestMonthKey);
  const months = useMemo(() => ledgerMonths(records), [records]);
  const scopedStats = useMemo(() => buildStats(records, scope, selectedMonth), [records, scope, selectedMonth]);
  const recordCreatedTime = (record: LedgerRecord) => {
    const timestamp = Date.parse(record.createdAt.replace(/-/g, '/'));
    return Number.isFinite(timestamp) ? timestamp : recordDateTime(record);
  };
  const latest = [...records].sort((a, b) => recordCreatedTime(b) - recordCreatedTime(a)).slice(0, 10);
  const count = (item: QualityItem) => item.count ?? item.records.length;
  const critical = quality.reduce((total, item) => total + (item.severity === 'critical' ? count(item) : 0), 0);
  const qualityValue = critical + ' 条异常';
  const qualityNote = '优先处理重复、金额或错列问题';

  return <div className="space-y-4">
    <section className="rounded-3xl border border-white/80 bg-[#6f536b] p-4 text-white shadow-[0_16px_34px_rgba(111,83,107,0.20)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-white/72">{scopedStats.scopeTitle}</p>
          <strong className="mt-2 block truncate text-4xl font-black tracking-normal" title={money(scopedStats.currentTotal)}>{money(scopedStats.currentTotal)}</strong>
          <p className="mt-1 text-xs font-bold text-white/72">{scopedStats.scopeNote} · {scopedStats.currentCount} 笔有效支出</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1 rounded-2xl bg-white/10 p-1">
        {scopeOptions.map(option => {
          const active = scope === option.value;
          return <button key={option.value} type="button" onClick={() => setScope(option.value)} className={'min-h-8 rounded-xl px-1 text-[10px] font-black transition active:scale-[0.98] ' + (active ? 'bg-white text-[#6f536b]' : 'text-white/72')}>
            {option.label}
          </button>;
        })}
      </div>
      <label className="mt-2 flex h-9 items-center gap-2 rounded-2xl bg-white/10 px-3 text-[11px] font-black text-white/72">
        <span className="shrink-0">月份</span>
        <select value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setScope('selectedMonth'); }} className="min-w-0 flex-1 bg-transparent text-xs font-black text-white outline-none">
          {months.map(month => <option key={month} value={month} className="text-[#403632]">{month}</option>)}
        </select>
      </label>
      <p className="mt-2 text-[11px] font-bold text-white/68">仅统计有效支出，不含收入和转账</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">范围笔数</p><strong className="mt-1 block text-sm font-black">{scopedStats.currentCount} 笔</strong></div>
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">日均支出</p><strong className="mt-1 block truncate text-sm font-black">{money(scopedStats.dailyAverage)}</strong></div>
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">最大单笔</p><strong className="mt-1 block truncate text-sm font-black">{money(scopedStats.largest)}</strong></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3">
      <SummaryCard title="Top 分类" value={scopedStats.topCategory?.name || '-'} note={scopedStats.topCategory ? money(scopedStats.topCategory.amount) : '暂无支出'} icon={Tags} tone="bg-[#eee5f2] text-[#76506f]" />
      <SummaryCard title="Top 商户" value={scopedStats.topMerchant?.name || '-'} note={scopedStats.topMerchant ? money(scopedStats.topMerchant.amount) : '当前范围暂无商户'} icon={Landmark} tone="bg-[#e8f0e4] text-[#61775a]" />
      {critical > 0 && <button type="button" onClick={onOpenQuality} className="col-span-2 rounded-2xl border border-white/80 bg-white/76 p-3.5 text-left shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff0ee] text-[#bd564b]"><AlertTriangle size={15} /></span>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-black text-[#9a817e]">数据异常</p><strong className="mt-0.5 block truncate text-base font-black text-[#403632]">{qualityValue}</strong></div>
          <span className="shrink-0 text-[11px] font-black text-[#76506f]">查看详情</span>
        </div>
        <p className="mt-2 text-[11px] font-bold leading-5 text-[#8b7471]">{qualityNote}</p>
      </button>}
    </section>

    <section>
      <div className="mb-2 flex items-end justify-between">
        <div><h2 className="text-base font-black">最近记账</h2><p className="mt-1 text-xs font-bold text-[#8b7471]">最近 10 笔，按记账时间排序</p></div>
        <button type="button" onClick={onOpenTransactions} className="inline-flex h-8 items-center gap-1 rounded-lg px-1 text-xs font-black text-[#76506f]"><span>查看全部</span><ReceiptText size={16} /></button>
      </div>
      <div className="space-y-2.5">{latest.map(record => <div key={record.id + '-' + record.sourceRow}><LedgerTransactionCard record={record} /></div>)}</div>
    </section>
  </div>;
}
