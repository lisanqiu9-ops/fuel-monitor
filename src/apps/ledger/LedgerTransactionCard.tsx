import { CreditCard, Hash } from 'lucide-react';
import type { LedgerRecord } from './ledgerTypes';
import { displayValue, isPending } from './ledgerStats';

export function LedgerTransactionCard({ record }: { record: LedgerRecord }) {
  const pending = [record.category1, record.merchant, record.account].some(isPending);
  const amountClass = 'shrink-0 text-lg font-black ' + (record.amountValid ? 'text-[#76506f]' : 'text-[#bd564b]');
  return <article className="rounded-2xl border border-white/80 bg-white/76 p-3.5 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black text-[#5f4d49]">{displayValue(record.date)} {displayValue(record.time)}</p><p className="mt-1 truncate text-sm font-black text-[#403632]">{displayValue(record.merchant)}</p></div><strong className={amountClass}>{record.amountValid ? '¥' + record.amount.toFixed(2) : '无效金额'}</strong></div>
    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black"><span className="rounded-full bg-[#eee5f2] px-2 py-1 text-[#76506f]">{displayValue(record.category1)}</span>{record.category2 && <span className="rounded-full bg-[#f3ece8] px-2 py-1 text-[#8b7471]">{displayValue(record.category2)}</span>}{pending && <span className="rounded-full bg-[#fff3df] px-2 py-1 text-[#a4772c]">待确认</span>}</div>
    <div className="mt-3 grid gap-1.5 text-[11px] font-bold text-[#8b7471]"><span className="flex min-w-0 items-center gap-1.5 truncate"><CreditCard size={13} />{displayValue(record.account)} · {displayValue(record.payMethod)}</span><span className="flex min-w-0 items-center gap-1.5 truncate"><Hash size={13} />{displayValue(record.orderNo)}</span></div>
  </article>;
}
