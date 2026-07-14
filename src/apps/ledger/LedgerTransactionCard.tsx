import { ChevronRight, CreditCard, Hash, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LedgerRecord } from './ledgerTypes';
import { displayValue, isPending, isUnconfirmed } from './ledgerStats';

export function LedgerTransactionCard({ record }: { record: LedgerRecord }) {
  const [open, setOpen] = useState(false);
  const fieldPending = [record.category1, record.merchant, record.account].some(isPending);
  const unconfirmed = isUnconfirmed(record);
  const amountClass = 'shrink-0 text-lg font-black ' + (record.amountValid ? 'text-[#76506f]' : 'text-[#bd564b]');

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="block w-full rounded-2xl border border-white/80 bg-white/76 p-3.5 text-left shadow-[0_10px_24px_rgba(91,72,72,0.07)] transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-[#5f4d49]">{displayValue(record.date)} {displayValue(record.time)}</p>
          <p className="mt-1 truncate text-sm font-black text-[#403632]">{displayValue(record.merchant)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1"><strong className={amountClass}>{record.amountValid ? '¥' + record.amount.toFixed(2) : '无效金额'}</strong><ChevronRight size={16} className="text-[#b49e98]" /></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black">
        <span className="rounded-full bg-[#eee5f2] px-2 py-1 text-[#76506f]">{displayValue(record.category1)}</span>
        {record.category2 && <span className="rounded-full bg-[#f3ece8] px-2 py-1 text-[#8b7471]">{displayValue(record.category2)}</span>}
        {fieldPending && <span className="rounded-full bg-[#fff3df] px-2 py-1 text-[#a4772c]">字段待确认</span>}
        {unconfirmed && <span className="rounded-full bg-[#fff0db] px-2 py-1 text-[#a4772c]">记录待确认</span>}
      </div>
      <div className="mt-3 grid gap-1.5 text-[11px] font-bold text-[#8b7471]">
        <span className="flex min-w-0 items-center gap-1.5 truncate"><CreditCard size={13} />{displayValue(record.account)} · {displayValue(record.payMethod)}</span>
        <span className="flex min-w-0 items-center gap-1.5 truncate"><Hash size={13} />{displayValue(record.orderNo)}</span>
      </div>
    </button>
    {open && createPortal(<TransactionDetail record={record} fieldPending={fieldPending} unconfirmed={unconfirmed} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function TransactionDetail({ record, fieldPending, unconfirmed, onClose }: { record: LedgerRecord; fieldPending: boolean; unconfirmed: boolean; onClose: () => void }) {
  const fields = [
    ['账户', record.account], ['支付方式', record.payMethod], ['订单号', record.orderNo],
  ];
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30" role="dialog" aria-modal="true" aria-label="流水详情" onMouseDown={onClose}>
    <section className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#fffaf6] px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-14px_38px_rgba(67,48,44,0.18)]" onMouseDown={event => event.stopPropagation()}>
      <div className="mx-auto h-1 w-10 rounded-full bg-[#daccc7]" />
      <div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-xs font-black text-[#8b7471]">{displayValue(record.date)} {displayValue(record.time)}</p><h2 className="mt-1 text-lg font-black text-[#403632]">{displayValue(record.merchant)}</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3ece8] text-[#76506f]" aria-label="关闭详情"><X size={18} /></button></div>
      <strong className={'mt-4 block text-3xl font-black ' + (record.amountValid ? 'text-[#76506f]' : 'text-[#bd564b]')}>{record.amountValid ? '¥' + record.amount.toFixed(2) : '无效金额'}</strong>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black"><span className="rounded-full bg-[#eee5f2] px-2 py-1 text-[#76506f]">{displayValue(record.category1)}</span>{record.category2 && <span className="rounded-full bg-[#f3ece8] px-2 py-1 text-[#8b7471]">{record.category2}</span>}{fieldPending && <span className="rounded-full bg-[#fff3df] px-2 py-1 text-[#a4772c]">字段待确认</span>}{unconfirmed && <span className="rounded-full bg-[#fff0db] px-2 py-1 text-[#a4772c]">记录待确认</span>}</div>
      <dl className="mt-5 divide-y divide-[#eee4df] overflow-hidden rounded-2xl border border-white/80 bg-white/80 px-3">{fields.map(([label, value]) => <div key={label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3 text-sm"><dt className="font-black text-[#9a817e]">{label}</dt><dd className="break-all text-right font-bold text-[#5f4d49]">{displayValue(value)}</dd></div>)}</dl>
      {(record.person || record.tags || record.note || record.rawTextPreview) && <section className="mt-3 overflow-hidden rounded-2xl border border-white/80 bg-white/80 px-3">{record.person && <DetailText label="相关人员" value={record.person} />}{record.tags && <DetailText label="标签" value={record.tags} />}{record.note && <DetailText label="备注" value={record.note} />}{record.rawTextPreview && <DetailText label="识别文本" value={record.rawTextPreview} />}</section>}
    </section>
  </div>;
}

function DetailText({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#eee4df] py-3 last:border-0"><p className="text-xs font-black text-[#9a817e]">{label}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-[#5f4d49]">{value}</p></div>;
}
