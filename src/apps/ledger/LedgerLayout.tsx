import type { ReactNode } from 'react';
import { type LedgerTab } from './LedgerBottomNav';
import { LedgerTabNav } from './LedgerTabNav';

interface Props {
  activeTab: LedgerTab;
  onTabChange: (tab: LedgerTab) => void;
  children: ReactNode;
}

export function LedgerLayout({ activeTab, onTabChange, children }: Props) {
  return <main className="soft-scrollbar h-dvh overflow-y-auto bg-[linear-gradient(180deg,#fffaf2_0%,#f4eef7_56%,#f8f1ea_100%)] px-4 pb-[calc(92px+env(safe-area-inset-bottom,0px))] pt-[calc(16px+env(safe-area-inset-top,0px))] text-[#403632] md:px-7 md:pb-8 md:pt-6">
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-4 md:mb-5"><h1 className="text-2xl font-black tracking-normal md:text-3xl">本地记账</h1><p className="mt-1 text-xs font-bold text-[#8b7471] md:text-sm">本地 CSV 消费看板</p></header>
      <LedgerTabNav activeTab={activeTab} onChange={onTabChange} />
      {children}
    </div>
  </main>;
}
