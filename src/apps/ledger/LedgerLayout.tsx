import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { ledgerTabs, type LedgerTab } from './LedgerBottomNav';

interface Props {
  activeTab: LedgerTab;
  onTabChange: (tab: LedgerTab) => void;
  onBackToToolbox: () => void;
  children: ReactNode;
}

export function LedgerLayout({ activeTab, onTabChange, onBackToToolbox, children }: Props) {
  return <main className="soft-scrollbar h-dvh overflow-y-auto bg-[linear-gradient(180deg,#fffaf2_0%,#f4eef7_56%,#f8f1ea_100%)] px-4 pb-[calc(92px+env(safe-area-inset-bottom,0px))] pt-[calc(16px+env(safe-area-inset-top,0px))] text-[#403632] md:px-7 md:pb-8 md:pt-6">
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-4 flex items-start justify-between gap-3 md:mb-5">
        <div className="min-w-0"><button type="button" onClick={onBackToToolbox} className="mb-2 inline-flex items-center gap-1 text-xs font-black text-[#8b7471] transition hover:text-[#6f536b]"><ArrowLeft size={15} />三秋工具箱</button><h1 className="text-2xl font-black tracking-normal md:text-3xl">本地记账</h1><p className="mt-1 text-xs font-bold text-[#8b7471] md:text-sm">本地 CSV 消费看板</p></div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/75 text-[#76506f] shadow-sm"><BookOpenCheck size={19} /></div>
      </header>
      <nav aria-label="账本页面导航" className="mb-5 hidden rounded-2xl border border-white/80 bg-white/65 p-1.5 shadow-sm md:flex md:w-fit">
        {ledgerTabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const className = 'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-black transition ' + (active ? 'bg-[#6f536b] text-white shadow-sm' : 'text-[#8b7471] hover:bg-[#f5ede8]');
          return <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} className={className}><Icon size={16} />{tab.label}</button>;
        })}
      </nav>
      {children}
    </div>
  </main>;
}
