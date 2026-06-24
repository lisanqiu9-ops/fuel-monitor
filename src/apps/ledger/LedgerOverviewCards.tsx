import { CalendarDays, CreditCard, Landmark, ReceiptText, Tags, TrendingUp } from 'lucide-react';
import { money } from './ledgerStats';
interface Props { stats: ReturnType<typeof import('./ledgerStats').buildStats>; }
const label = (value?: string) => value?.trim() || '-';
export function LedgerOverviewCards({ stats }: Props) {
  const latestTime = stats.latest ? `${stats.latest.date || '-'} ${stats.latest.time || ''}`.trim() : '-';
  const cards = [
    { title: `${stats.monthKey} 支出`, value: money(stats.currentTotal), note: '只统计 type = 支出', icon: TrendingUp, tone: 'bg-[#eee5f2] text-[#76506f]' },
    { title: '本月笔数', value: String(stats.currentCount), note: '有效支出记录', icon: ReceiptText, tone: 'bg-[#f8ebdc] text-[#a87743]' },
    { title: '日均支出', value: money(stats.dailyAverage), note: '按有消费的天数计算', icon: CalendarDays, tone: 'bg-[#e8f0e4] text-[#61775a]' },
    { title: '最大单笔', value: money(stats.largest), note: '当前月份', icon: CreditCard, tone: 'bg-[#e5eff4] text-[#557a8d]' },
    { title: 'Top 分类', value: label(stats.topCategory?.name), note: stats.topCategory ? money(stats.topCategory.amount) : '暂无支出', icon: Tags, tone: 'bg-[#f3e8e4] text-[#98685e]' },
    { title: 'Top 商户', value: label(stats.topMerchant?.name), note: stats.topMerchant ? money(stats.topMerchant.amount) : '暂无支出', icon: Landmark, tone: 'bg-[#ede9df] text-[#776d5e]' },
    { title: '全部支出 / 笔数', value: money(stats.allTotal), note: `${stats.allCount} 笔`, icon: TrendingUp, tone: 'bg-[#eaf0e5] text-[#66765b]' },
    { title: '最近一笔账单时间', value: latestTime, note: stats.latest?.merchant || '-', icon: CalendarDays, tone: 'bg-[#eee7f1] text-[#76506f]' },
  ];
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <article key={card.title} className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_12px_28px_rgba(91,72,72,0.08)]"><div className={`grid h-9 w-9 place-items-center rounded-2xl ${card.tone}`}><Icon size={17} /></div><p className="mt-3 text-xs font-black text-[#9a817e]">{card.title}</p><strong className="mt-1 block truncate text-xl font-black text-[#403632]" title={card.value}>{card.value}</strong><p className="mt-1 text-xs font-bold text-[#8b7471]">{card.note}</p></article>; })}</section>;
}
