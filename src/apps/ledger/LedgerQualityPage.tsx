import { ShieldCheck } from 'lucide-react';
import type { QualityItem } from './ledgerTypes';
import { LedgerQualityPanel } from './LedgerQualityPanel';

export function LedgerQualityPage({ items }: { items: QualityItem[] }) {
  const total = (item: QualityItem) => item.count ?? item.records.length;
  const critical = items.reduce((sum, item) => sum + (item.severity === 'critical' ? total(item) : 0), 0);
  const notices = items.reduce((sum, item) => sum + (item.severity === 'notice' ? total(item) : 0), 0);
  const summary = critical ? '有 ' + critical + ' 条严重异常需要优先处理。' : notices ? '有 ' + notices + ' 条待确认提醒，暂不影响消费统计。' : '整体正常，暂未发现需要处理的问题。';
  return <div><section className="mb-4 rounded-2xl border border-white/80 bg-white/76 p-4 shadow-[0_10px_24px_rgba(91,72,72,0.07)]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eaf4e8] text-[#5c8a55]"><ShieldCheck size={19} /></div><div><h2 className="text-lg font-black">数据质量</h2><p className="mt-1 text-xs font-bold leading-5 text-[#8b7471]">{summary}</p></div></div></section><LedgerQualityPanel items={items} /></div>;
}
