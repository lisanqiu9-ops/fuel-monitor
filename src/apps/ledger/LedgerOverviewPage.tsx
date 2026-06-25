import { AlertTriangle, Landmark, ReceiptText, Tags, TrendingUp } from 'lucide-react';
import type { LedgerRecord, QualityItem } from './ledgerTypes';
import { money, recordDateTime } from './ledgerStats';
import { LedgerTransactionCard } from './LedgerTransactionCard';

interface Props {
  stats: ReturnType<typeof import('./ledgerStats').buildStats>;
  records: LedgerRecord[];
  quality: QualityItem[];
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

export function LedgerOverviewPage({ stats, records, quality }: Props) {
  const latest = [...records].sort((a, b) => recordDateTime(b) - recordDateTime(a)).slice(0, 5);
  const count = (item: QualityItem) => item.count ?? item.records.length;
  const critical = quality.reduce((total, item) => total + (item.severity === 'critical' ? count(item) : 0), 0);
  const notices = quality.reduce((total, item) => total + (item.severity === 'notice' ? count(item) : 0), 0);
  const qualityValue = critical ? critical + ' 条异常' : notices ? notices + ' 条待确认' : '整体正常';
  const qualityNote = critical ? '优先处理重复、金额或错列问题' : notices ? '提醒项不影响统计' : '暂未发现明显问题';

  return <div className="space-y-4">
    <section className="rounded-3xl border border-white/80 bg-[#6f536b] p-4 text-white shadow-[0_16px_34px_rgba(111,83,107,0.20)]">
      <p className="text-xs font-black text-white/72">本月支出</p>
      <strong className="mt-2 block truncate text-4xl font-black tracking-normal" title={money(stats.currentTotal)}>{money(stats.currentTotal)}</strong>
      <p className="mt-1 text-xs font-bold text-white/72">{stats.monthKey} · {stats.currentCount} 笔有效支出</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">本月笔数</p><strong className="mt-1 block text-sm font-black">{stats.currentCount} 笔</strong></div>
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">日均支出</p><strong className="mt-1 block truncate text-sm font-black">{money(stats.dailyAverage)}</strong></div>
        <div className="rounded-2xl bg-white/12 p-2.5"><p className="text-[10px] font-black text-white/65">最大单笔</p><strong className="mt-1 block truncate text-sm font-black">{money(stats.largest)}</strong></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3">
      <SummaryCard title="Top 分类" value={stats.topCategory?.name || '-'} note={stats.topCategory ? money(stats.topCategory.amount) : '暂无支出'} icon={Tags} tone="bg-[#eee5f2] text-[#76506f]" />
      <SummaryCard title="Top 商户" value={stats.topMerchant?.name || '-'} note={stats.topMerchant ? money(stats.topMerchant.amount) : '导入后自动计算'} icon={Landmark} tone="bg-[#e8f0e4] text-[#61775a]" />
      <article className="col-span-2 rounded-2xl border border-white/80 bg-white/76 p-3.5 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={'grid h-8 w-8 place-items-center rounded-xl ' + (critical ? 'bg-[#fff0ee] text-[#bd564b]' : notices ? 'bg-[#fff7e9] text-[#a4772c]' : 'bg-[#eaf4e8] text-[#5c8a55]')}><AlertTriangle size={15} /></span>
            <div className="min-w-0"><p className="text-[11px] font-black text-[#9a817e]">数据质量</p><strong className="mt-0.5 block truncate text-base font-black text-[#403632]">{qualityValue}</strong></div>
          </div>
          <span className="shrink-0 rounded-full bg-[#f6f0ec] px-2 py-1 text-[10px] font-black text-[#8b7471]">{records.length} 条</span>
        </div>
        <p className="mt-2 text-[11px] font-bold leading-5 text-[#8b7471]">{qualityNote}</p>
      </article>
    </section>

    <section>
      <div className="mb-2 flex items-end justify-between">
        <div><h2 className="text-base font-black">最近流水</h2><p className="mt-1 text-xs font-bold text-[#8b7471]">最近 5 笔，按账单时间排序</p></div>
        <ReceiptText size={18} className="text-[#9a817e]" />
      </div>
      <div className="space-y-2.5">{latest.map(record => <LedgerTransactionCard key={record.id + '-' + record.sourceRow} record={record} />)}</div>
    </section>
  </div>;
}
