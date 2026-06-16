import React, { useState, useEffect, useRef } from 'react';
import { FuelRecord } from '../types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { checkOcrConfig, compressImage, callBaiduOCR, parseOCRData } from '../lib/ocr';
import { OcrConfirmModal } from './OcrConfirmModal';

interface Props {
  onSave: (record: FuelRecord) => void;
  onOpenHistory: () => void;
  onGoSettings: () => void;
  ocrLaunchRequest?: number;
  ocrPrefillData?: any;
  ocrPrefillRequest?: number;
}

export function AddRecordTab({
  onSave,
  onOpenHistory,
  onGoSettings,
  ocrLaunchRequest = 0,
  ocrPrefillData,
  ocrPrefillRequest = 0,
}: Props) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fuelLiters, setFuelLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [fuelType, setFuelType] = useState('');
  
  const [drivenKm, setDrivenKm] = useState('');
  const [dashboardOdo, setDashboardOdo] = useState('');
  const [dashboardAvgSpeed, setDashboardAvgSpeed] = useState('');
  const [dashboardDriveHours, setDashboardDriveHours] = useState('');
  const [dashboardFuelPer100, setDashboardFuelPer100] = useState('');
  const [dashboardRange, setDashboardRange] = useState('');

  // OCR state
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'compressing' | 'recognizing' | 'error' | 'recognizing_more' | string>('idle');
  const [ocrErrorMsg, setOcrErrorMsg] = useState('');
  const [ocrResult, setOcrResult] = useState<{data: any, confidence: any} | null>(null);
  const [hasOcrConfig, setHasOcrConfig] = useState(false);
  const [pendingOcrFiles, setPendingOcrFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkOcrConfig().then(res => setHasOcrConfig(res));
  }, []);

  useEffect(() => {
    if (ocrLaunchRequest > 0) {
      window.setTimeout(() => fileInputRef.current?.click(), 120);
    }
  }, [ocrLaunchRequest]);

  useEffect(() => {
    if (ocrPrefillRequest > 0 && ocrPrefillData) {
      applyOcrData(ocrPrefillData);
    }
  }, [ocrPrefillRequest, ocrPrefillData]);

  const getOcrProgress = () => {
    if (ocrStatus === 'idle' || ocrStatus === 'error') return 0;
    if (ocrStatus === 'compressing') return 12;
    if (ocrStatus === 'recognizing' || ocrStatus === 'recognizing_more') return 55;
    const match = ocrStatus.toString().match(/recognizing(?:_more)?_(\d+)_(\d+)/);
    if (!match) return 45;
    const current = Number(match[1]);
    const total = Number(match[2]);
    return Math.min(92, Math.max(20, Math.round((current / total) * 88)));
  };

  const getOcrStatusLabel = () => {
    if (ocrStatus === 'compressing') return '正在压缩图片';
    if (ocrStatus === 'recognizing') return '正在云端识别';
    if (ocrStatus === 'recognizing_more') return '正在补充识别';
    const multiMatch = ocrStatus.toString().match(/recognizing_(\d+)_(\d+)/);
    if (multiMatch) return `正在识别第 ${multiMatch[1]} / ${multiMatch[2]} 张`;
    const addMoreMatch = ocrStatus.toString().match(/recognizing_more_(\d+)_(\d+)/);
    if (addMoreMatch) return `正在补充第 ${addMoreMatch[1]} / ${addMoreMatch[2]} 张`;
    return '正在处理';
  };

  const isOcrBusy = ocrStatus !== 'idle' && ocrStatus !== 'error';
  const ocrProgress = getOcrProgress();

  const recognizeFiles = async (
    files: File[],
    options: { mode: 'initial' | 'more'; data?: any; confidence?: any }
  ) => {
    if (files.length === 0) return;

    const isMore = options.mode === 'more';

    try {
      setOcrStatus(isMore ? 'recognizing_more' : 'compressing');

      let combinedData = options.data ?? null;
      let combinedConfidence = options.confidence ?? null;

      for (let i = 0; i < files.length; i++) {
        if (isMore) {
          setOcrStatus(files.length > 1 ? `recognizing_more_${i + 1}_${files.length}` : 'recognizing_more');
        } else {
          setOcrStatus(files.length > 1 ? `recognizing_${i + 1}_${files.length}` : 'recognizing');
        }

        const base64 = await compressImage(files[i]);
        const rawData = await callBaiduOCR(base64);

        const parsed = parseOCRData(rawData.words_result, { data: combinedData, confidence: combinedConfidence });
        combinedData = parsed.fields;
        combinedConfidence = parsed.confidence;
      }

      setOcrResult({ data: combinedData, confidence: combinedConfidence });
      setOcrStatus('idle');
      if (!isMore) setPendingOcrFiles([]);
    } catch (err: any) {
      setOcrStatus('error');
      setOcrErrorMsg(err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setPendingOcrFiles(prev => [...prev, ...files]);
    setOcrStatus('idle');
    setOcrErrorMsg('');

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartOcr = () => {
    recognizeFiles(pendingOcrFiles, { mode: 'initial' });
  };

  const handleAddMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    await recognizeFiles(files, {
      mode: 'more',
      data: ocrResult?.data,
      confidence: ocrResult?.confidence,
    });
    e.target.value = '';
  };

  const applyOcrData = (data: any) => {
    if (data.date) setDate(data.date);
    if (data.fuelLiters) setFuelLiters(data.fuelLiters.toString());
    if (data.unitPrice) setPricePerLiter(data.unitPrice.toString());
    if (data.totalCost) setTotalCost(data.totalCost.toString());
    if (data.fuelType) setFuelType(data.fuelType.toString());

    if (data.drivenKm) setDrivenKm(data.drivenKm.toString());
    if (data.dashboardFuelPer100) setDashboardFuelPer100(data.dashboardFuelPer100.toString());
    if (data.dashboardAvgSpeed) setDashboardAvgSpeed(data.dashboardAvgSpeed.toString());
    if (data.dashboardDriveHours) setDashboardDriveHours(data.dashboardDriveHours.toString());
    if (data.dashboardRange) setDashboardRange(data.dashboardRange.toString());
    if (data.dashboardOdo) setDashboardOdo(data.dashboardOdo.toString());
  };

  const handleOcrConfirm = (data: any) => {
    applyOcrData(data);
    
    setOcrResult(null);
  };

  // Auto calculate total cost
  useEffect(() => {
    const liters = parseFloat(fuelLiters);
    const price = parseFloat(pricePerLiter);
    if (!isNaN(liters) && !isNaN(price)) {
      setTotalCost((liters * price).toFixed(2));
    }
  }, [fuelLiters, pricePerLiter]);

  const actualFuelPreview = () => {
    const liters = parseFloat(fuelLiters);
    const km = parseFloat(drivenKm);
    if (!isNaN(liters) && !isNaN(km) && km > 0) {
      return (liters / km * 100).toFixed(2);
    }
    return null;
  };
  
  const preview = actualFuelPreview();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !fuelLiters || !pricePerLiter || !totalCost) {
      alert("请填写必填项");
      return;
    }

    const parseRequiredPositive = (label: string, val: string) => {
      const num = Number(val);
      if (!Number.isFinite(num) || num <= 0) {
        alert(`${label}必须大于 0`);
        return null;
      }
      return num;
    };

    const parseOptionalNonNegative = (label: string, val: string) => {
      if (!val) return null;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0) {
        alert(`${label}不能为负数`);
        return undefined;
      }
      return num;
    };

    const l = parseRequiredPositive('加油量', fuelLiters);
    const price = parseRequiredPositive('单价', pricePerLiter);
    const tCost = parseRequiredPositive('总价', totalCost);
    const dKm = parseOptionalNonNegative('行驶里程', drivenKm);
    const odo = parseOptionalNonNegative('总里程', dashboardOdo);
    const avgSpeed = parseOptionalNonNegative('均速', dashboardAvgSpeed);
    const dashboardFuel = parseOptionalNonNegative('表显油耗', dashboardFuelPer100);
    const range = parseOptionalNonNegative('剩余续航', dashboardRange);
    if (l === null || price === null || tCost === null || dKm === undefined || odo === undefined || avgSpeed === undefined || dashboardFuel === undefined || range === undefined) {
      return;
    }
    
    let actualFuelP100 = null;
    let costPKm = null;
    if (dKm && dKm > 0) {
      actualFuelP100 = Number(((l / dKm) * 100).toFixed(2));
      costPKm = Number((tCost / dKm).toFixed(3));
    }

    const newRecord: FuelRecord = {
      id: uuidv4(),
      date,
      fuelLiters: l,
      pricePerLiter: price,
      totalCost: tCost,
      drivenKm: dKm,
      actualFuelPer100: actualFuelP100,
      costPerKm: costPKm,
      fuelType: fuelType || null,
      dashboardOdo: odo,
      dashboardAvgSpeed: avgSpeed,
      dashboardDriveHours: dashboardDriveHours || null,
      dashboardFuelPer100: dashboardFuel,
      dashboardRange: range,
    };

    onSave(newRecord);
    
    // Reset core form values
    setFuelLiters('');
    setTotalCost('');
    setDrivenKm('');
  };

  return (
    <div className="tab-content-panel flex flex-col gap-4 p-4 pb-24">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* === OCR 拍照区域 === */}
        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[#e8ecf4] font-medium flex items-center gap-2 text-sm">
              <Camera size={16} className="text-[#4fc3f7]" />
              拍照识别小票
            </h3>
            {isOcrBusy && (
              <span className="text-[#4fc3f7] text-[11px] flex items-center gap-1 bg-[#4fc3f7]/10 border border-[#4fc3f7]/20 px-2 py-1 rounded-full">
                <Loader2 size={12} className="animate-spin" />
                {getOcrStatusLabel()}
              </span>
            )}
          </div>
          
          <input 
            type="file" 
            accept="image/*" 
            multiple
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {isOcrBusy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 bg-[#1a1e2a]/92 backdrop-blur-sm flex flex-col items-center justify-center px-6 text-center"
            >
              <Loader2 size={30} className="text-[#4fc3f7] animate-spin mb-3" />
              <div className="text-[#e8ecf4] text-sm font-medium">{getOcrStatusLabel()}</div>
              <div className="text-[#6b7a99] text-[11px] mt-1">正在合并小票和仪表盘数据，请稍候</div>
              <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-4">
                <motion.div
                  className="h-full bg-[#4fc3f7]"
                  initial={{ width: 0 }}
                  animate={{ width: `${ocrProgress}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </motion.div>
          )}

          {!hasOcrConfig ? (
            <div className="bg-[#0d0f14] border border-white/5 rounded-lg p-4 flex justify-between items-center">
              <div className="text-xs text-[#6b7a99]">配置 OCR 后可一键识别小票</div>
              <button 
                type="button"
                onClick={onGoSettings}
                className="text-xs text-[#f5a623] px-3 py-1.5 bg-[#f5a623]/10 rounded border border-[#f5a623]/20 whitespace-nowrap"
              >
                去配置
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrStatus !== 'idle'}
                  className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#0d0f14] border border-[#f5a623]/30 rounded-lg py-5 text-[#f5a623] active:bg-[#f5a623]/10 transition-colors disabled:opacity-50"
                >
                  <Camera size={24} />
                  <span className="text-xs font-medium">{pendingOcrFiles.length > 0 ? '继续添加照片' : '拍照 / 选图'}</span>
                </button>
                <div className="flex-1 flex flex-col justify-center items-start px-2">
                  <p className="text-[10px] text-[#6b7a99] leading-relaxed mb-1 flex items-start gap-1">
                    <ImageIcon size={10} className="mt-0.5 shrink-0" />
                    先暂存照片，拍完小票和仪表盘后再统一识别。
                  </p>
                  {pendingOcrFiles.length > 0 && (
                    <div className="text-[11px] text-[#4fc3f7] mt-1">
                      已暂存 {pendingOcrFiles.length} 张
                    </div>
                  )}
                </div>
              </div>

              {pendingOcrFiles.length > 0 && (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={handleStartOcr}
                    disabled={ocrStatus !== 'idle'}
                    className="bg-[#f5a623] text-black font-semibold rounded-lg py-3 text-sm active:bg-[#d48c1a] transition-colors disabled:opacity-50"
                  >
                    开始识别 {pendingOcrFiles.length} 张
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingOcrFiles([]);
                      setOcrStatus('idle');
                      setOcrErrorMsg('');
                    }}
                    disabled={ocrStatus !== 'idle'}
                    className="px-4 py-3 rounded-lg bg-[#0d0f14] border border-white/10 text-[#6b7a99] text-sm active:bg-white/5 disabled:opacity-50"
                  >
                    清空
                  </button>
                </div>
              )}
            </div>
          )}

          {isOcrBusy && (
            <div className="h-1.5 bg-[#0d0f14] rounded-full overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-[#4fc3f7]"
                initial={{ width: 0 }}
                animate={{ width: `${ocrProgress}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          )}
          
          {ocrStatus === 'error' && (
            <div className="text-[#ff4757] text-[10px] bg-red-500/10 p-2 rounded border border-red-500/20 mt-1 flex items-start gap-1">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{ocrErrorMsg}</span>
            </div>
          )}
        </div>

        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-[#f5a623] font-medium border-b border-white/5 pb-2">基础信息 (必填)</h3>
          
          <div className="flex flex-col">
            <label className="text-xs text-[#6b7a99] mb-1">加油日期</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#f5a623] focus:outline-none w-full"
            />
          </div>
          
          <div className="flex gap-3">
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">加油量 (L)</label>
              <input type="number" step="0.01" min="0.01" required value={fuelLiters} onChange={e => setFuelLiters(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#f5a623] focus:outline-none w-full"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">单价 (元/L)</label>
              <input type="number" step="0.01" min="0.01" required value={pricePerLiter} onChange={e => setPricePerLiter(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#f5a623] focus:outline-none w-full"
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">总价 (元)</label>
              <input type="number" step="0.01" min="0.01" required value={totalCost} onChange={e => setTotalCost(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#f5a623] font-medium focus:border-[#f5a623] focus:outline-none w-full"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">油号</label>
              <input type="text" value={fuelType} onChange={e => setFuelType(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#f5a623] focus:outline-none w-full"
                placeholder="例如: 汽92"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-[#4fc3f7] font-medium border-b border-white/5 pb-2 flex justify-between">
            <span>里程与仪表 (选填)</span>
            {preview && <span className="text-[#f5a623] text-sm">预测: {preview} L/100km</span>}
          </h3>
          
          <div className="flex flex-col">
            <label className="text-xs text-[#6b7a99] mb-1">行驶里程 (km) <span className="text-[10px] opacity-70">- 上次加油后行驶</span></label>
            <input type="number" step="0.1" min="0" value={drivenKm} onChange={e => setDrivenKm(e.target.value)}
              className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
              placeholder="0"
            />
          </div>
          
          <div className="flex gap-3">
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">表显油耗</label>
              <input type="number" step="0.1" min="0" value={dashboardFuelPer100} onChange={e => setDashboardFuelPer100(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-xs text-[#6b7a99] mb-1">剩余续航</label>
              <input type="number" min="0" value={dashboardRange} onChange={e => setDashboardRange(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <div className="flex flex-col">
              <label className="text-xs text-[#6b7a99] mb-1">总里程 (km)</label>
              <input type="number" min="0" value={dashboardOdo} onChange={e => setDashboardOdo(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
              />
            </div>
             <div className="flex flex-col">
              <label className="text-xs text-[#6b7a99] mb-1">均速 (km/h)</label>
              <input type="number" min="0" value={dashboardAvgSpeed} onChange={e => setDashboardAvgSpeed(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
              />
            </div>
             <div className="flex flex-col col-span-2">
              <label className="text-xs text-[#6b7a99] mb-1">行驶时间 (h)</label>
              <input type="text" value={dashboardDriveHours} onChange={e => setDashboardDriveHours(e.target.value)}
                className="bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-[#e8ecf4] focus:border-[#4fc3f7] focus:outline-none w-full"
                placeholder="例如: 24:23 或 23.63"
              />
            </div>
          </div>
        </div>

        <button type="submit" className="bg-[#f5a623] text-black font-semibold rounded-xl py-4 mt-2 active:bg-[#d48c1a] transition-colors shadow-[0_0_15px_rgba(245,166,35,0.3)]">
          保存记录
        </button>
        
        <button type="button" onClick={onOpenHistory} className="text-[#6b7a99] text-sm underline text-center mt-2 pb-6">
          查看/管理历史记录
        </button>
      </form>

      <AnimatePresence>
        {ocrResult && (
          <OcrConfirmModal 
            data={ocrResult.data} 
            confidence={ocrResult.confidence}
            onConfirm={handleOcrConfirm}
            onCancel={() => setOcrResult(null)}
            onAddMore={handleAddMore}
            isProcessingMore={ocrStatus === 'recognizing_more'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
