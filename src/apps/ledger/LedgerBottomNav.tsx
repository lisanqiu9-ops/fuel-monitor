import { BarChart3, FileUp, LayoutDashboard, ReceiptText, ShieldCheck } from 'lucide-react';

export type LedgerTab = 'overview' | 'analysis' | 'transactions' | 'quality' | 'import';

export const ledgerTabs = [
  { id: 'overview', label: '概览', icon: LayoutDashboard },
  { id: 'analysis', label: '分析', icon: BarChart3 },
  { id: 'transactions', label: '流水', icon: ReceiptText },
  { id: 'quality', label: '质量', icon: ShieldCheck },
  { id: 'import', label: '导入', icon: FileUp },
] as const;

interface Props {
  activeTab: LedgerTab;
  onChange: (tab: LedgerTab) => void;
}

export function LedgerBottomNav({ activeTab, onChange }: Props) {
  return <nav aria-label="账本页面导航" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-[#fffaf4]/92 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl md:hidden">
    <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
      {ledgerTabs.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        const className = 'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition ' + (active ? 'bg-[#e9e2f1] text-[#6f536b]' : 'text-[#9a817e]');
        return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={className}><Icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{tab.label}</span></button>;
      })}
    </div>
  </nav>;
}
