import { BarChart3, LayoutDashboard, ReceiptText, Settings, ShieldCheck } from 'lucide-react';

export type LedgerTab = 'overview' | 'analysis' | 'transactions' | 'quality' | 'settings';

export const ledgerTabs = [
  { id: 'overview', label: '概览', icon: LayoutDashboard },
  { id: 'analysis', label: '分析', icon: BarChart3 },
  { id: 'transactions', label: '流水', icon: ReceiptText },
  { id: 'quality', label: '质量', icon: ShieldCheck },
  { id: 'settings', label: '设置', icon: Settings },
] as const;

interface Props {
  activeTab: LedgerTab;
  onChange: (tab: LedgerTab) => void;
}

export function LedgerBottomNav({ activeTab, onChange }: Props) {
  return <nav aria-label="账本页面导航" className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-white/80 bg-[#fffaf4]/94 px-2 pb-[calc(4px+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-12px_30px_rgba(91,72,72,0.08)] backdrop-blur-xl">
    <div className="grid grid-cols-5 gap-1">
      {ledgerTabs.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        const className = 'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition active:scale-[0.98] ' + (active ? 'bg-[#e9e2f1] text-[#6f536b]' : 'text-[#9a817e]');
        return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={className + ' touch-manipulation'}><Icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{tab.label}</span></button>;
      })}
    </div>
  </nav>;
}
