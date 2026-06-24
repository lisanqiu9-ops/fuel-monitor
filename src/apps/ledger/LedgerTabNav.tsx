import { ledgerTabs, type LedgerTab } from './LedgerBottomNav';

interface Props {
  activeTab: LedgerTab;
  onChange: (tab: LedgerTab) => void;
}

export function LedgerTabNav({ activeTab, onChange }: Props) {
  return <nav aria-label="账本页面导航" className="mb-5 hidden rounded-2xl border border-white/80 bg-white/65 p-1.5 shadow-sm md:flex md:w-fit">
    {ledgerTabs.map(tab => {
      const Icon = tab.icon;
      const active = activeTab === tab.id;
      const className = 'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-black transition ' + (active ? 'bg-[#6f536b] text-white shadow-sm' : 'text-[#8b7471] hover:bg-[#f5ede8]');
      return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={className}><Icon size={16} />{tab.label}</button>;
    })}
  </nav>;
}
