import { BookOpenCheck } from 'lucide-react';
import { LedgerImport } from './LedgerImport';
import type { LedgerCache } from './ledgerTypes';

interface Props {
  cache: LedgerCache | null;
  isImporting: boolean;
  error: string | null;
  onImport: (file: File) => void;
  onClear: () => void;
}

export function LedgerImportPage(props: Props) {
  return <div className="space-y-4"><section className="rounded-2xl border border-white/80 bg-white/76 p-4 shadow-[0_10px_24px_rgba(91,72,72,0.07)]"><BookOpenCheck size={21} className="text-[#76506f]" /><h2 className="mt-3 text-lg font-black">导入本地账本</h2><p className="mt-1 text-xs font-bold leading-5 text-[#8b7471]">选择快捷指令追加的 ledger.csv。处理仅发生在当前浏览器，本页不会上传任何流水。</p></section><LedgerImport {...props} /></div>;
}
