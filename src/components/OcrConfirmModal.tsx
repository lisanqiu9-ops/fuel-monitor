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
      className="ocr-confirm-page fixed inset-0 z-[100] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.18)] max-w-md mx-auto overflow-hidden"
    >
      <div className="ocr-confirm-header shrink-0 px-4 pt-safe z-10">
        <button onClick={onCancel} className="ocr-confirm-back">
          <ChevronLeft size={24} />
          <span>返回</span>
        </button>
        <h2>识别结果确认</h2>
        
        <div className="relative shrink-0">
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
            className="ocr-confirm-add-more"
          >
            {isProcessingMore ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>补充原图</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-safe">
        <div className="p-5 flex flex-col gap-4">
          
          <div className="ocr-result-card">
            
            <div className="ocr-result-row">
              <span>日期</span>
              <strong>{data.date || '未识别'}</strong>
              <StatusIcon status={confidence.date} />
            </div>
            
            <div className="ocr-result-row">
              <span>加油量</span>
              <strong>{data.fuelLiters ? `${data.fuelLiters} L` : '未识别'}</strong>
              <StatusIcon status={confidence.fuelLiters} />
            </div>

            <div className="ocr-result-row">
              <span>单价</span>
              <strong>{data.unitPrice ? `${data.unitPrice} 元/L` : '未识别'}</strong>
              <StatusIcon status={confidence.unitPrice} />
            </div>

            <div className="ocr-result-row">
              <span>总价</span>
              <strong className="is-price">{data.totalCost ? `${data.totalCost} 元` : '未识别'}</strong>
              <StatusIcon status={confidence.totalCost} />
            </div>

            <div className="ocr-result-row">
              <span>油号</span>
              <strong>{data.fuelType || '未识别'}</strong>
              <StatusIcon status={confidence.fuelType} />
            </div>

            <div className="ocr-result-divider" />

            {(data.dashboardFuelPer100 || data.drivenKm || data.dashboardAvgSpeed || data.dashboardRange || data.dashboardOdo) && (
              <div className="flex flex-col gap-3">
                <div className="ocr-result-section-title">仪表盘识别数据</div>
                {data.drivenKm && (
                  <div className="ocr-result-row">
                    <span>行驶里程</span>
                    <strong>{data.drivenKm} km</strong>
                    <StatusIcon status={confidence.drivenKm} />
                  </div>
                )}
                {data.dashboardAvgSpeed && (
                  <div className="ocr-result-row">
                    <span>平均车速</span>
                    <strong>{data.dashboardAvgSpeed} km/h</strong>
                    <StatusIcon status={confidence.dashboardAvgSpeed} />
                  </div>
                )}
                {data.dashboardFuelPer100 && (
                  <div className="ocr-result-row">
                    <span>表显油耗</span>
                    <strong>{data.dashboardFuelPer100} L/100km</strong>
                    <StatusIcon status={confidence.dashboardFuelPer100} />
                  </div>
                )}
                {data.dashboardDriveHours && (
                  <div className="ocr-result-row">
                    <span>行驶时间</span>
                    <strong>{data.dashboardDriveHours} h</strong>
                    <StatusIcon status={confidence.dashboardDriveHours} />
                  </div>
                )}
                {data.dashboardRange && (
                  <div className="ocr-result-row">
                    <span>剩余续航</span>
                    <strong>{data.dashboardRange} km</strong>
                    <StatusIcon status={confidence.dashboardRange} />
                  </div>
                )}
                {data.dashboardOdo && (
                  <div className="ocr-result-row">
                    <span>总里程</span>
                    <strong>{data.dashboardOdo} km</strong>
                    <StatusIcon status={confidence.dashboardOdo} />
                  </div>
                )}
              </div>
            )}
            
            {confidence.crossCheck === true && data.fuelLiters && data.unitPrice && (
              <div className="ocr-check-note is-ok">
                <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
                <div>
                  交叉验证通过：<br/>{data.fuelLiters} L × {data.unitPrice} 元/L = {(data.fuelLiters * data.unitPrice).toFixed(2)} ≈ {data.totalCost?.toFixed(2)} 元
                </div>
              </div>
            )}
            
            {confidence.crossCheck === false && data.totalCost && (
              <div className="ocr-check-note">
                <AlertTriangle size={16} className="text-[#f5a623] mt-0.5 shrink-0" />
                <div>
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

      <div className="ocr-confirm-footer p-4 pb-safe shrink-0">
        <button 
          type="button"
          onClick={() => onConfirm(data)}
          className="w-full py-4 rounded-xl font-bold"
        >
          确认填入
        </button>
      </div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
