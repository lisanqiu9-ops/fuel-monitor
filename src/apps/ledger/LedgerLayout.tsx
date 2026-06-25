import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onBackToToolbox?: () => void;
}

export function LedgerLayout({ children, onBackToToolbox }: Props) {
  return <main className="h-dvh overflow-hidden bg-[linear-gradient(180deg,#efe7ef_0%,#f8f1ea_56%,#efe7df_100%)] text-[#403632]">
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[linear-gradient(180deg,#fffaf2_0%,#f4eef7_55%,#f8f1ea_100%)] shadow-2xl">
      <header className="shrink-0 px-5 pb-3 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-normal">本地记账</h1>
            <p className="mt-1 text-xs font-bold text-[#8b7471]">本地 CSV 消费看板</p>
          </div>
          {onBackToToolbox && (
            <button
              type="button"
              onClick={onBackToToolbox}
              className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/80 bg-white/72 text-[#76506f] shadow-sm active:scale-[0.98]"
              aria-label="返回三秋工具箱"
              title="返回三秋工具箱"
            >
              <PackageOpen size={18} />
            </button>
          )}
        </div>
      </header>
      <section className="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(92px+env(safe-area-inset-bottom,0px))]">
        {children}
      </section>
    </div>
  </main>;
}
