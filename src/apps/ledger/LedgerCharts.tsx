import { BarChart3, PieChart as PieIcon, Store, WalletCards } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReactNode } from 'react';
import { money } from './ledgerStats';
interface Props { stats: ReturnType<typeof import('./ledgerStats').buildStats>; }
const colors = ['#76506f','#7c9670','#cf9b67','#7494a4','#b87a72','#8b7d59','#7e87ad','#a2779d'];
const shortMoney = (value: number) => `¥${Math.round(value)}`;
function ChartCard({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: ReactNode }) {
  return <article className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_12px_28px_rgba(91,72,72,0.08)]">
    <h2 className="flex items-center gap-2 text-sm font-black text-[#403632]"><Icon size={16} className="text-[#76506f]" />{title}</h2>
    <div className="mt-3 h-[230px] min-w-0">{children}</div>
  </article>;
}
function Ranking({ title, icon: Icon, data }: { title: string; icon: typeof Store; data: { name: string; amount: number }[] }) {
  return <section className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_12px_28px_rgba(91,72,72,0.08)]"><h2 className="flex items-center gap-2 text-sm font-black text-[#403632]"><Icon size={16} className="text-[#76506f]" />{title}</h2><div className="mt-3 space-y-2.5">{data.length ? data.slice(0, 10).map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#f3ece8] text-[10px] font-black text-[#9a817e]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-[#5f4d49]">{item.name}</span><span className="text-sm font-black text-[#76506f]">{money(item.amount)}</span></div>) : <p className="py-4 text-center text-sm font-bold text-[#9a817e]">暂无支出数据</p>}</div></section>;
}
export function LedgerCharts({ stats }: Props) {
  const tooltip = { contentStyle: { borderRadius: 14, border: '1px solid rgba(112,85,101,.12)', background: '#fffdf9' }, formatter: (value: number | string | undefined) => money(Number(value ?? 0)) };
  return <div className="space-y-3">
    <ChartCard title="月度支出趋势" icon={BarChart3}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.monthly} margin={{ top: 6, right: 2, left: -18, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9a817e' }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10, fill: '#9a817e' }} width={42} /><Tooltip {...tooltip} /><Bar dataKey="amount" fill="#76506f" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
    <ChartCard title="最近 30 天支出" icon={BarChart3}><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.daily} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}><XAxis dataKey="name" minTickGap={24} tick={{ fontSize: 10, fill: '#9a817e' }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10, fill: '#9a817e' }} width={42} /><Tooltip {...tooltip} /><Line type="monotone" dataKey="amount" stroke="#7c9670" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
    <ChartCard title="分类占比" icon={PieIcon}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.categories} dataKey="amount" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>{stats.categories.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip {...tooltip} /></PieChart></ResponsiveContainer></ChartCard>
    <Ranking title="分类金额排行" icon={PieIcon} data={stats.categories} />
    <Ranking title="商户 Top 10" icon={Store} data={stats.merchants} />
    <Ranking title="账户排行" icon={WalletCards} data={stats.accounts} />
    <Ranking title="支付方式排行" icon={WalletCards} data={stats.payMethods} />
  </div>;
}
