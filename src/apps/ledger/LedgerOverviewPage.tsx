import { AlertTriangle, CalendarDays, CreditCard, Landmark, ReceiptText, Tags, TrendingUp } from 'lucide-react';
import type { LedgerRecord, QualityItem } from './ledgerTypes';
import { money, recordDateTime } from './ledgerStats';
import { LedgerTransactionCard } from './LedgerTransactionCard';

interface Props {
  stats: ReturnType<typeof import('./ledgerStats').buildStats>;
  records: LedgerRecord[];
  quality: QualityItem[];
}

function Metric({ title, value, note, icon: Icon, tone, featured = false, className = '' }: { title: string; value: string; note: string; icon: typeof TrendingUp; tone: string; featured?: boolean; className?: string }) {
  const cardClass = 'border border-white/80 bg-white/76 shadow-[0_10px_24px_rgba(91,72,72,0.07)] ' + (featured ? 'rounded-3xl p-4 sm:p-5' : 'rounded-2xl p-3.5') + ' ' + className;
  return <article className={cardClass}>
    <div className={'grid h-8 w-8 place-items-center rounded-xl ' + tone}><Icon size={16} /></div>
    <p className="mt-2 text-[11px] font-black text-[#9a817e]">{title}</p>
    <strong className={'mt-1 block truncate font-black text-[#403632] ' + (featured ? 'text-3xl' : 'text-lg')} title={value}>{value}</strong>
    <p className="mt-1 truncate text-[10px] font-bold text-[#8b7471]" title={note}>{note}</p>
  </article>;
}

export function LedgerOverviewPage({ stats, records, quality }: Props) {
  const latest = [...records].sort((a, b) => recordDateTime(b) - recordDateTime(a)).slice(0, 5);
  const count = (item: QualityItem) => item.count ?? item.records.length;
  const critical = quality.reduce((total, item) => total + (item.severity === 'critical' ? count(item) : 0), 0);
  const notices = quality.reduce((total, item) => total + (item.severity === 'notice' ? count(item) : 0), 0);
  const qualityClass = 'rounded-2xl border p-4 shadow-[0_10px_24px_rgba(91,72,72,0.07)] ' + (critical ? 'border-[#f2c8c3] bg-[#fff4f2]' : notices ? 'border-[#f3dfb6] bg-[#fffaf0]' : 'border-[#d7e6d4] bg-[#f5fbf3]');
  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric featured className="col-span-2" title="本月支出" value={money(stats.currentTotal)} note={stats.monthKey + ' · ' + stats.currentCount + ' 笔有效支出'} icon={TrendingUp} tone="bg-[#eee5f2] text-[#76506f]" />
      <Metric title="本月笔数" value={stats.currentCount + ' 笔'} note="有效支出记录" icon={ReceiptText} tone="bg-[#f8ebdc] text-[#a87743]" />
      <Metric title="日均支出" value={money(stats.dailyAverage)} note="按消费日计算" icon={CalendarDays} tone="bg-[#e8f0e4] text-[#61775a]" />
      <Metric title="最大单笔" value={money(stats.largest)} note="本月最高支出" icon={CreditCard} tone="bg-[#e5eff4] text-[#557a8d]" />
      <Metric title="Top 分类" value={stats.topCategory?.name || '-'} note={stats.topCategory ? money(stats.topCategory.amount) : '暂无支出'} icon={Tags} tone="bg-[#f3e8e4] text-[#98685e]" />
    </section>
    <section className="grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border border-white/80 bg-white/76 p-4 shadow-[0_10px_24px_rgba(91,72,72,0.07)]"><div className="flex items-center gap-2"><Landmark size={17} className="text-[#76506f]" /><h2 className="text-sm font-black">Top 商户</h2></div><strong className="mt-3 block truncate text-xl font-black text-[#403632]">{stats.topMerchant?.name || '-'}</strong><p className="mt-1 text-xs font-bold text-[#8b7471]">{stats.topMerchant ? money(stats.topMerchant.amount) : '导入后自动计算'}</p></article>
      <article className={qualityClass}><div className="flex items-center gap-2"><AlertTriangle size={17} className={critical ? 'text-[#bd564b]' : notices ? 'text-[#a4772c]' : 'text-[#5c8a55]'} /><h2 className="text-sm font-black">数据质量</h2></div><p className="mt-3 text-sm font-black text-[#403632]">{critical ? critical + ' 条高优先级异常' : notices ? '待确认 ' + notices + ' 条' : '整体正常'}</p><p className="mt-1 text-xs font-bold text-[#8b7471]">待确认是提醒，不会影响统计结果。</p></article>
    </section>
    <section><div className="mb-2 flex items-end justify-between"><div><h2 className="text-base font-black">最近流水</h2><p className="mt-1 text-xs font-bold text-[#8b7471]">最近 5 笔，按账单时间排序</p></div><span className="text-xs font-black text-[#76506f]">{records.length} 条</span></div><div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{latest.map(record => <div key={record.id + '-' + record.sourceRow}><LedgerTransactionCard record={record} /></div>)}</div></section>
  </div>;
}

