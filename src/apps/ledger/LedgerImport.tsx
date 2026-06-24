import { FileUp, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { LedgerCache } from './ledgerTypes';
interface Props { cache: LedgerCache | null; isImporting: boolean; error: string | null; onImport: (file: File) => void; onClear: () => void; }
export function LedgerImport({ cache, isImporting, error, onImport, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <section className="rounded-[26px] border border-white/80 bg-white/75 p-4 shadow-[0_16px_36px_rgba(91,72,72,0.1)] backdrop-blur">
    <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain,.txt" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} />
    <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9e2f1] text-[#76506f]"><FileUp size={20} /></div><div className="min-w-0 flex-1"><p className="font-black text-[#403632]">{cache ? '账本已导入' : '导入 ledger.csv'}</p><p className="mt-1 text-xs font-bold leading-5 text-[#8b7471]">{cache ? `${cache.fileName} · ${cache.records.length} 条记录 · ${new Date(cache.importedAt).toLocaleString('zh-CN')}` : '从“文件”中选择快捷指令生成的 CSV 或制表符文本。'}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={isImporting} onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#6f536b] px-4 text-sm font-black text-white disabled:opacity-60">{cache ? <RotateCcw size={16} /> : <FileUp size={16} />}{isImporting ? '正在解析…' : cache ? '重新导入' : '选择本地文件'}</button>{cache && <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#f3ece8] px-4 text-sm font-black text-[#8a6260]"><Trash2 size={16} />清空本地缓存</button>}</div>
    <div className="mt-4 flex gap-2 rounded-2xl bg-[#edf3ea] px-3 py-2.5 text-xs font-bold leading-5 text-[#657660]"><ShieldCheck size={16} className="mt-0.5 shrink-0" />数据仅在当前浏览器本地解析和缓存，不会上传或同步。</div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ee] px-3 py-2 text-xs font-bold leading-5 text-[#bd564b]">{error}</p>}
  </section>;
}
