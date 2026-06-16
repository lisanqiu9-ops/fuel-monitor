import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, AlertTriangle, ChevronLeft, Plus, Loader2, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateOcrPreviewReport } from '../lib/report';

interface Props {
  data: any;
  confidence: any;
  onConfirm: (data: any) => void;
  onCancel: () => void;
  onAddMore?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingMore?: boolean;
}

export function OcrConfirmModal({ data, confidence, onConfirm, onCancel, onAddMore, isProcessingMore }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const report = generateOcrPreviewReport(data);
  
  const StatusIcon = ({ status }: { status: 'high' | 'low' | null }) => {
    if (status === 'high') return <Check size={16} className="text-green-400" />;
    if (status === 'low') return <AlertTriangle size={16} className="text-[#f5a623]" />;
    return <span className="text-[#6b7a99] text-xs">-</span>;
  };

  const modalContent = (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="fixed inset-0 bg-[#1a1a18] z-[100] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)] max-w-md mx-auto overflow-hidden"
    >
      <div className="flex justify-between items-center px-3 py-3 border-b border-white/5 bg-[#1a1a18]/90 backdrop-blur-xl shrink-0 pt-safe z-10">
        <button onClick={onCancel} className="flex items-center text-[#6b7a99] active:text-[#e8ecf4] transition-colors p-2 z-10 -ml-2">
          <ChevronLeft size={24} />
          <span className="text-sm font-medium">返回</span>
        </button>
        <h2 className="text-[#e8ecf4] font-medium absolute left-1/2 -translate-x-1/2">识别结果确认</h2>
        
        <div className="relative">
          <input 
            type="file" 
            accept="image/*" 
            multiple
            className="hidden" 
            ref={fileInputRef}
            onChange={onAddMore}
          />
          <button 
            disabled={isProcessingMore}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 p-2 text-[#f5a623] active:text-[#d48c1a] transition-colors disabled:opacity-50"
          >
            {isProcessingMore ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span className="text-sm font-medium">补充原图</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-safe">
        <div className="p-5 flex flex-col gap-4">
          
          <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6b7a99] w-16">日期</span>
              <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.date || '未识别'}</span>
              <StatusIcon status={confidence.date} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6b7a99] w-16">加油量</span>
              <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.fuelLiters ? `${data.fuelLiters} L` : '未识别'}</span>
              <StatusIcon status={confidence.fuelLiters} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6b7a99] w-16">单价</span>
              <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.unitPrice ? `${data.unitPrice} 元/L` : '未识别'}</span>
              <StatusIcon status={confidence.unitPrice} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6b7a99] w-16">总价</span>
              <span className="font-display text-[#f5a623] flex-1 text-right mr-3">{data.totalCost ? `${data.totalCost} 元` : '未识别'}</span>
              <StatusIcon status={confidence.totalCost} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6b7a99] w-16">油号</span>
              <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.fuelType || '未识别'}</span>
              <StatusIcon status={confidence.fuelType} />
            </div>

            <div className="border-t border-white/5 mt-1" />

            {(data.dashboardFuelPer100 || data.drivenKm || data.dashboardAvgSpeed || data.dashboardRange || data.dashboardOdo) && (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-[#f5a623] mb-1">仪表盘识别数据</div>
                {data.drivenKm && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">行驶里程</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.drivenKm} km</span>
                    <StatusIcon status={confidence.drivenKm} />
                  </div>
                )}
                {data.dashboardAvgSpeed && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">平均车速</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.dashboardAvgSpeed} km/h</span>
                    <StatusIcon status={confidence.dashboardAvgSpeed} />
                  </div>
                )}
                {data.dashboardFuelPer100 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">表显油耗</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.dashboardFuelPer100} L/100km</span>
                    <StatusIcon status={confidence.dashboardFuelPer100} />
                  </div>
                )}
                {data.dashboardDriveHours && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">行驶时间</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.dashboardDriveHours} h</span>
                    <StatusIcon status={confidence.dashboardDriveHours} />
                  </div>
                )}
                {data.dashboardRange && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">剩余续航</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.dashboardRange} km</span>
                    <StatusIcon status={confidence.dashboardRange} />
                  </div>
                )}
                {data.dashboardOdo && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6b7a99]">总里程</span>
                    <span className="font-display text-[#e8ecf4] flex-1 text-right mr-3">{data.dashboardOdo} km</span>
                    <StatusIcon status={confidence.dashboardOdo} />
                  </div>
                )}
              </div>
            )}
            
            {confidence.crossCheck === true && data.fuelLiters && data.unitPrice && (
              <div className="mt-2 pt-3 border-t border-white/5 flex items-start gap-2 bg-green-500/5 -mx-4 -mb-4 p-4 rounded-b-xl border-green-500/10">
                <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
                <div className="text-[10px] text-green-400/90 leading-tight">
                  交叉验证通过：<br/>{data.fuelLiters} L × {data.unitPrice} 元/L = {(data.fuelLiters * data.unitPrice).toFixed(2)} ≈ {data.totalCost?.toFixed(2)} 元
                </div>
              </div>
            )}
            
            {confidence.crossCheck === false && data.totalCost && (
              <div className="mt-2 pt-3 border-t border-white/5 flex items-start gap-2 bg-red-500/5 -mx-4 -mb-4 p-4 rounded-b-xl border-red-500/10 shrink-0">
                <AlertTriangle size={16} className="text-[#f5a623] mt-0.5 shrink-0" />
                <div className="text-[10px] text-[#f5a623]/90 leading-tight">
                  交叉验证未通过，请仔细核对识别数值是否准确。
                </div>
              </div>
            )}
            
          </div>

          <div className={`ocr-report-card report-tone-${report.tone}`}>
            <div className="ocr-report-title">
              <ClipboardList size={16} />
              <span>识别解读</span>
            </div>
            <div className="report-headline">
              <strong>{report.title}</strong>
              <p>{report.summary}</p>
            </div>
            <div className="report-list">
              {report.points.map((point) => (
                <div key={point}>{point}</div>
              ))}
            </div>
            <div className="report-next">
              <span>建议</span>
              {report.nextActions.map((action) => (
                <p key={action}>{action}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-[#1a1e2a] pb-safe shrink-0">
        <button 
          type="button"
          onClick={() => onConfirm(data)}
          className="w-full py-4 rounded-xl bg-[#f5a623] text-[#1a1a18] font-bold active:bg-[#d48c1a] shadow-[0_4px_15px_rgba(245,166,35,0.2)]"
        >
          确认填入
        </button>
      </div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
