import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Camera, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { FuelFillType, FuelRecord } from '../types';
import { callBaiduOCR, compressImage, parseOCRData } from '../lib/ocr';
import { OcrConfirmModal } from './OcrConfirmModal';

interface Props {
  onClose: () => void;
  onSave: (record: FuelRecord) => void;
  onNeedManualReview: (data: any) => void;
}

export function OcrCaptureModal({ onClose, onSave, onNeedManualReview }: Props) {
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'compressing' | 'recognizing' | 'error' | 'recognizing_more' | string>('idle');
  const [ocrErrorMsg, setOcrErrorMsg] = useState('');
  const [ocrResult, setOcrResult] = useState<{ data: any; confidence: any } | null>(null);
  const [pendingOcrFiles, setPendingOcrFiles] = useState<File[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const getOcrProgress = () => {
    if (ocrStatus === 'idle' || ocrStatus === 'error') return 0;
    if (ocrStatus === 'compressing') return 12;
    if (ocrStatus === 'recognizing' || ocrStatus === 'recognizing_more') return 55;
    const match = ocrStatus.toString().match(/recognizing(?:_more)?_(\d+)_(\d+)/);
    if (!match) return 45;
    return Math.min(92, Math.max(20, Math.round((Number(match[1]) / Number(match[2])) * 88)));
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

  const recognizeFiles = async (
    files: File[],
    options: { mode: 'initial' | 'more'; data?: any; confidence?: any },
  ) => {
    if (files.length === 0) return;
    const isMore = options.mode === 'more';

    try {
      setOcrStatus(isMore ? 'recognizing_more' : 'compressing');
      let combinedData = options.data ?? null;
      let combinedConfidence = options.confidence ?? null;

      for (let i = 0; i < files.length; i++) {
        setOcrStatus(
          isMore
            ? files.length > 1 ? `recognizing_more_${i + 1}_${files.length}` : 'recognizing_more'
            : files.length > 1 ? `recognizing_${i + 1}_${files.length}` : 'recognizing',
        );
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

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setPendingOcrFiles(prev => [...prev, files[0]]);
    setOcrStatus('idle');
    setOcrErrorMsg('');
    e.target.value = '';
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setPendingOcrFiles(prev => [...prev, ...files]);
    setOcrStatus('idle');
    setOcrErrorMsg('');
    e.target.value = '';
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

  const handleOcrConfirm = (data: any) => {
    const recordDate = data.date;
    const liters = Number(data.fuelLiters);
    const price = Number(data.unitPrice);
    const cost = Number(data.totalCost || (Number.isFinite(liters) && Number.isFinite(price) ? liters * price : NaN));

    if (!recordDate || !Number.isFinite(liters) || liters <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(cost) || cost <= 0) {
      onNeedManualReview(data);
      return;
    }

    const dKm = data.drivenKm ? Number(data.drivenKm) : null;
    const fillType: FuelFillType = data.fillType === 'partial' ? 'partial' : 'full';
    const actualFuelP100 = fillType === 'full' && dKm && dKm > 0 ? Number(((liters / dKm) * 100).toFixed(2)) : null;
    const costPKm = fillType === 'full' && dKm && dKm > 0 ? Number((cost / dKm).toFixed(3)) : null;

    onSave({
      id: uuidv4(),
      date: recordDate,
      fillType,
      fuelLiters: liters,
      pricePerLiter: price,
      totalCost: Number(cost.toFixed(2)),
      fuelType: data.fuelType || null,
      drivenKm: dKm,
      actualFuelPer100: actualFuelP100,
      costPerKm: costPKm,
      dashboardOdo: data.dashboardOdo ? Number(data.dashboardOdo) : null,
      dashboardAvgSpeed: data.dashboardAvgSpeed ? Number(data.dashboardAvgSpeed) : null,
      dashboardDriveHours: data.dashboardDriveHours ? String(data.dashboardDriveHours) : null,
      dashboardFuelPer100: data.dashboardFuelPer100 ? Number(data.dashboardFuelPer100) : null,
      dashboardRange: data.dashboardRange ? Number(data.dashboardRange) : null,
    });
    onClose();
  };

  const isOcrBusy = ocrStatus !== 'idle' && ocrStatus !== 'error';
  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ocr-launch-backdrop fixed inset-0 z-[90] flex items-end justify-center px-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))] pt-safe"
      onClick={onClose}
    >
      <motion.section
        initial={{ y: 26, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 26, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="ocr-launch-panel w-full max-w-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="ocr-launch-head">
          <div>
            <span>拍照 / 上传识别</span>
            <p>可连续添加小票和仪表盘图片，最后统一识别。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭识别面板">
            <X size={18} />
          </button>
        </div>

        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleCameraChange} />
        <input type="file" accept="image/*" multiple className="hidden" ref={uploadInputRef} onChange={handleUploadChange} />

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isOcrBusy} className="ocr-mode-button ocr-mode-primary">
            <Camera size={24} />
            <strong>{pendingOcrFiles.length > 0 ? '继续拍照' : '拍照添加'}</strong>
            <span>调用手机相机</span>
          </button>
          <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={isOcrBusy} className="ocr-mode-button">
            <Upload size={23} />
            <strong>上传图片</strong>
            <span>从相册多选</span>
          </button>
        </div>

        {pendingOcrFiles.length > 0 && (
          <div className="ocr-upload-queue mt-3">
            <div className="ocr-upload-head">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} />
                <span>待识别 {pendingOcrFiles.length} 张图片</span>
              </div>
              <button type="button" onClick={() => setPendingOcrFiles([])} disabled={isOcrBusy} aria-label="清空上传图片">
                <X size={15} />
              </button>
            </div>
            <div className="ocr-file-list">
              {pendingOcrFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`}>
                  <span>{index + 1}</span>
                  <strong>{file.name || `图片 ${index + 1}`}</strong>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => recognizeFiles(pendingOcrFiles, { mode: 'initial' })} disabled={isOcrBusy} className="settings-primary-button w-full">
              开始识别 {pendingOcrFiles.length} 张
            </button>
          </div>
        )}

        {isOcrBusy && (
          <div className="ocr-launch-progress">
            <Loader2 size={16} className="animate-spin" />
            <span>{getOcrStatusLabel()}</span>
            <div><motion.i initial={{ width: 0 }} animate={{ width: `${getOcrProgress()}%` }} /></div>
          </div>
        )}

        {ocrStatus === 'error' && (
          <div className="ocr-launch-error">
            <AlertCircle size={13} />
            <span>{ocrErrorMsg}</span>
          </div>
        )}

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
      </motion.section>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
