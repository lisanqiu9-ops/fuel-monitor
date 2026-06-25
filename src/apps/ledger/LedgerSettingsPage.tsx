import { ArrowLeft, ChevronDown, ChevronRight, Database, FileUp, Info, RefreshCw, ShieldCheck, TableProperties, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { LedgerCache } from './ledgerTypes';

interface Props {
  cache: LedgerCache | null;
  isImporting: boolean;
  error: string | null;
  onImport: (file: File) => void;
  onClear: () => void;
  onBackToToolbox: () => void;
}

const fieldSummary = [
  '基础：id、date、time、type、amount',
  '分类：category1、category2、tags',
  '交易：merchant、account、pay_method、order_no',
  '补充：person、note、source、confirmed、created_at',
];

export function LedgerSettingsPage({ cache, isImporting, error, onImport, onClear, onBackToToolbox }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [openInfo, setOpenInfo] = useState<'fields' | 'quality' | null>(null);
  const chooseFile = () => inputRef.current?.click();
  const clear = () => {
    if (window.confirm('确定清空当前浏览器中的账本缓存吗？原始 ledger.csv 不会被删除。')) onClear();
  };
  const importedAt = cache ? new Date(cache.importedAt).toLocaleString('zh-CN') : '尚未导入';
  const rowClass = 'flex min-h-14 w-full items-center gap-3 px-4 text-left transition active:bg-[#f6f0ec]';
  const iconClass = 'grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#f2ebe7] text-[#76506f]';

  return <div className="space-y-4">
    <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain,.txt" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} />

    <section><h2 className="mb-2 px-1 text-xs font-black text-[#9a817e]">数据</h2><div className="overflow-hidden rounded-2xl border border-white/80 bg-white/76 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
      <div className={rowClass}><span className={iconClass}><Database size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-sm font-black">当前账本</strong><span className="mt-1 block truncate text-xs font-bold text-[#9a817e]">{cache ? cache.fileName + ' · ' + cache.records.length + ' 条' : '暂无本地账本'}</span></div><span className="max-w-28 text-right text-[10px] font-bold text-[#9a817e]">{importedAt}</span></div>
      <div className="border-t border-[#eee4df]"><button type="button" onClick={chooseFile} disabled={isImporting} className={rowClass}><span className={iconClass}><FileUp size={17} /></span><span className="flex-1 text-sm font-black">{isImporting ? '正在解析…' : '导入 ledger.csv'}</span><ChevronRight size={17} className="text-[#b49e98]" /></button></div>
      {cache && <div className="border-t border-[#eee4df]"><button type="button" onClick={chooseFile} disabled={isImporting} className={rowClass}><span className={iconClass}><RefreshCw size={17} /></span><span className="flex-1 text-sm font-black">重新导入</span><ChevronRight size={17} className="text-[#b49e98]" /></button></div>}
      {cache && <div className="border-t border-[#eee4df]"><button type="button" onClick={clear} className={rowClass}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#fff0ee] text-[#bd564b]"><Trash2 size={17} /></span><span className="flex-1 text-sm font-black text-[#a34e47]">清空本地缓存</span><ChevronRight size={17} className="text-[#d59a94]" /></button></div>}
    </div>{error && <p role="alert" className="mt-2 rounded-xl bg-[#fff0ee] px-3 py-2 text-xs font-bold leading-5 text-[#bd564b]">{error}</p>}</section>

    <section><h2 className="mb-2 px-1 text-xs font-black text-[#9a817e]">安全与说明</h2><div className="overflow-hidden rounded-2xl border border-white/80 bg-white/76 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
      <div className={rowClass}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eaf4e8] text-[#5c8a55]"><ShieldCheck size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-sm font-black">数据仅本地处理</strong><span className="mt-1 block text-xs font-bold text-[#9a817e]">CSV 不上传、不远程同步</span></div><span className="text-xs font-black text-[#5c8a55]">已保护</span></div>
      <div className="border-t border-[#eee4df]"><button type="button" onClick={() => setOpenInfo(openInfo === 'fields' ? null : 'fields')} className={rowClass}><span className={iconClass}><TableProperties size={17} /></span><span className="flex-1 text-sm font-black">数据字段说明</span><ChevronDown size={17} className={'text-[#b49e98] transition ' + (openInfo === 'fields' ? 'rotate-180' : '')} /></button>{openInfo === 'fields' && <div className="border-t border-[#eee4df] bg-[#faf6f2] px-4 py-3 text-xs font-bold leading-6 text-[#7d6965]">{fieldSummary.map(text => <p key={text}>{text}</p>)}</div>}</div>
      <div className="border-t border-[#eee4df]"><button type="button" onClick={() => setOpenInfo(openInfo === 'quality' ? null : 'quality')} className={rowClass}><span className={iconClass}><Info size={17} /></span><span className="flex-1 text-sm font-black">数据质量说明</span><ChevronDown size={17} className={'text-[#b49e98] transition ' + (openInfo === 'quality' ? 'rotate-180' : '')} /></button>{openInfo === 'quality' && <div className="border-t border-[#eee4df] bg-[#faf6f2] px-4 py-3 text-xs font-bold leading-6 text-[#7d6965]">商户、账户和订单号待确认属于提醒；重复订单号、异常金额、字段错列或缺失属于高优先级问题。</div>}</div>
    </div></section>

    <section><h2 className="mb-2 px-1 text-xs font-black text-[#9a817e]">关于</h2><div className="overflow-hidden rounded-2xl border border-white/80 bg-white/76 shadow-[0_10px_24px_rgba(91,72,72,0.07)]">
      <button type="button" onClick={onBackToToolbox} className={rowClass}><span className={iconClass}><ArrowLeft size={17} /></span><span className="flex-1 text-sm font-black">返回三秋工具箱</span><ChevronRight size={17} className="text-[#b49e98]" /></button>
      <div className="border-t border-[#eee4df]"><div className={rowClass}><span className={iconClass}><Info size={17} /></span><div className="flex-1"><strong className="block text-sm font-black">版本信息</strong><span className="mt-1 block text-xs font-bold text-[#9a817e]">本地记账 · 应用化导航版</span></div><span className="text-xs font-black text-[#9a817e]">v0.3</span></div></div>
    </div></section>
  </div>;
}
