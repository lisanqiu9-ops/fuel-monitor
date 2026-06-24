import { LedgerCharts } from './LedgerCharts';

export function LedgerAnalysisPage({ stats }: { stats: ReturnType<typeof import('./ledgerStats').buildStats> }) {
  return <div><div className="mb-4"><h2 className="text-lg font-black">消费分析</h2><p className="mt-1 text-xs font-bold text-[#8b7471]">趋势、分类、商户和支付渠道集中查看</p></div><LedgerCharts stats={stats} /></div>;
}
