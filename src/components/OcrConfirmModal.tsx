import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, AlertTriangle, ChevronLeft, Plus, Loader2, ClipboardList, PencilLine, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateOcrPreviewReport } from '../lib/report';
import { normalizeFuelType } from '../data';
import type { FuelFillType } from '../types';

const isLikelyFixedAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 100) return false;
  const nearestHundred = Math.round(amount / 100) * 100;
  return nearestHundred >= 100 && Math.abs(amount - nearestHundred) <= 2;
};
interface Props {
  data: any;
  confidence: any;
  onConfirm: (data: any) => void;
  onCancel: () => void;
  onAddMore?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingMore?: boolean;
}

type OcrEditableFields = {
  date: string;
  fuelLiters: string;
  unitPrice: string;
  totalCost: string;
  fuelType: string;
  drivenKm: string;
  dashboardAvgSpeed: string;
  dashboardFuelPer100: string;
  dashboardDriveHours: string;
  dashboardRange: string;
  dashboardOdo: string;
};

const fuelTypeOptions = ['92#', '95#', '98#'];

const valueToString = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return String(value);
};


const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const getInferredUnitPrice = (data: any) => {
  const liters = Number(data.fuelLiters);
  const cost = Number(data.totalCost);
  if (!Number.isFinite(liters) || liters <= 0 || !Number.isFinite(cost) || cost <= 0) return '';
  return String(Number((cost / liters).toFixed(2)));
};

const getInitialFields = (data: any): OcrEditableFields => ({
  date: valueToString(data.date),
  fuelLiters: valueToString(data.fuelLiters),
  unitPrice: valueToString(data.unitPrice) || getInferredUnitPrice(data),
  totalCost: valueToString(data.totalCost),
  fuelType: normalizeFuelType(data.fuelType) || '92#',
  drivenKm: valueToString(data.drivenKm),
  dashboardAvgSpeed: valueToString(data.dashboardAvgSpeed),
  dashboardFuelPer100: valueToString(data.dashboardFuelPer100),
  dashboardDriveHours: valueToString(data.dashboardDriveHours),
  dashboardRange: valueToString(data.dashboardRange),
  dashboardOdo: valueToString(data.dashboardOdo),
});

const buildEditedData = (data: any, fields: OcrEditableFields) => ({
  ...data,
  date: fields.date.trim() || null,
  fuelLiters: toNumberOrNull(fields.fuelLiters),
  unitPrice: toNumberOrNull(fields.unitPrice),
  totalCost: toNumberOrNull(fields.totalCost),
  fuelType: normalizeFuelType(fields.fuelType),
  drivenKm: toNumberOrNull(fields.drivenKm),
  dashboardAvgSpeed: toNumberOrNull(fields.dashboardAvgSpeed),
  dashboardFuelPer100: toNumberOrNull(fields.dashboardFuelPer100),
  dashboardDriveHours: fields.dashboardDriveHours.trim() || null,
  dashboardRange: toNumberOrNull(fields.dashboardRange),
  dashboardOdo: toNumberOrNull(fields.dashboardOdo),
});

interface EditableRowProps {
  label: string;
  value: string;
  displayValue: string;
  status: 'high' | 'low' | null;
  onChange: (value: string) => void;
  inputType?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  suffix?: string;
  placeholder?: string;
  highlight?: boolean;
  requiredReview?: boolean;
}

function EditableOcrRow({
  label,
  value,
  displayValue,
  status,
  onChange,
  inputType = 'text',
  inputMode,
  suffix,
  placeholder,
  highlight = false,
  requiredReview = false,
}: EditableRowProps) {
  const [isEditing, setIsEditing] = useState(requiredReview);
  const shouldReview = requiredReview || status === 'low' || !value.trim();

  useEffect(() => {
    if (requiredReview) setIsEditing(true);
  }, [requiredReview]);

  return (
    <div className={cn('ocr-result-row', isEditing && 'is-editing', shouldReview && 'needs-review')}>
      <span>{label}</span>
      {isEditing ? (
        <label className="ocr-inline-editor">
          <input
            type={inputType}
            inputMode={inputMode}
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder={placeholder}
          />
          {suffix && <em>{suffix}</em>}
        </label>
      ) : (
        <strong className={highlight ? 'is-price' : undefined}>{displayValue}</strong>
      )}
      <button
        type="button"
        className={cn('ocr-row-edit-button', isEditing && 'is-active')}
        onClick={() => setIsEditing(current => !current)}
        aria-label={`${isEditing ? '收起' : '修改'}${label}`}
      >
        {isEditing ? <Check size={15} /> : <PencilLine size={15} />}
      </button>
    </div>
  );
}

export function OcrConfirmModal({ data, confidence, onConfirm, onCancel, onAddMore, isProcessingMore }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<OcrEditableFields>(() => getInitialFields(data));
  const [fillType, setFillType] = useState<FuelFillType>(data.fillType === 'partial' ? 'partial' : 'full');
  const editedData = useMemo(() => buildEditedData(data, fields), [data, fields]);
  const report = generateOcrPreviewReport(editedData);
  const fixedAmountHint = isLikelyFixedAmount(editedData.totalCost);
  const inferredUnitPrice = getInferredUnitPrice(data);
  const unitPriceWasInferred = !valueToString(data.unitPrice).trim() && fields.unitPrice === inferredUnitPrice;
  const hasReceiptRequiredMissing = !fields.date.trim() || !fields.fuelLiters.trim() || !fields.unitPrice.trim() || !fields.totalCost.trim();
  const fuelTypeWasDefaulted = !normalizeFuelType(data.fuelType);
  const crossCheckOk = editedData.fuelLiters && editedData.unitPrice && editedData.totalCost
    ? Math.abs(editedData.fuelLiters * editedData.unitPrice - editedData.totalCost) <= Math.max(0.5, editedData.totalCost * 0.01)
    : null;

  useEffect(() => {
    setFields(getInitialFields(data));
    setFillType(data.fillType === 'partial' ? 'partial' : 'full');
  }, [data]);

  const updateField = (key: keyof OcrEditableFields, value: string) => {
    setFields(current => ({ ...current, [key]: value }));
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
            <div className="ocr-edit-hint">
              <span>识别值可直接修改</span>
              <p>黄色或未识别字段会自动展开；油号识别不到时按常用 92# 预选。</p>
            </div>

            <EditableOcrRow
              label="日期"
              value={fields.date}
              displayValue={fields.date || '未识别'}
              status={confidence.date}
              onChange={value => updateField('date', value)}
              inputType="date"
              requiredReview={!fields.date.trim() || confidence.date !== 'high'}
            />

            <EditableOcrRow
              label="加油量"
              value={fields.fuelLiters}
              displayValue={fields.fuelLiters ? `${fields.fuelLiters} L` : '未识别'}
              status={confidence.fuelLiters}
              onChange={value => updateField('fuelLiters', value)}
              inputType="number"
              inputMode="decimal"
              suffix="L"
              placeholder="38.67"
              requiredReview={!fields.fuelLiters.trim() || confidence.fuelLiters !== 'high'}
            />

            <EditableOcrRow
              label="单价"
              value={fields.unitPrice}
              displayValue={fields.unitPrice ? `${fields.unitPrice} 元/L` : '未识别'}
              status={confidence.unitPrice}
              onChange={value => updateField('unitPrice', value)}
              inputType="number"
              inputMode="decimal"
              suffix="元/L"
              placeholder="6.75"
              requiredReview={unitPriceWasInferred || !fields.unitPrice.trim() || confidence.unitPrice !== 'high'}
            />
            {unitPriceWasInferred && (
              <div className="ocr-infer-note">
                <Calculator size={14} />
                <span>单价未识别，已按总价 ÷ 加油量推算为 {fields.unitPrice} 元/L，请保存前确认。</span>
              </div>
            )}

            <EditableOcrRow
              label="总价"
              value={fields.totalCost}
              displayValue={fields.totalCost ? `${fields.totalCost} 元` : '未识别'}
              status={confidence.totalCost}
              onChange={value => updateField('totalCost', value)}
              inputType="number"
              inputMode="decimal"
              suffix="元"
              placeholder="261"
              highlight
              requiredReview={!fields.totalCost.trim() || confidence.totalCost !== 'high'}
            />

            <div className={cn('ocr-result-row fuel-type-row', fuelTypeWasDefaulted && 'needs-review')}>
              <span>油号</span>
              <div className="ocr-fuel-type-segment" role="group" aria-label="选择油号">
                {fuelTypeOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('fuelType', option)}
                    className={fields.fuelType === option ? 'is-active' : ''}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <Check size={16} className={fields.fuelType ? 'text-green-500' : 'text-[#8d8981]'} />
            </div>
            {fuelTypeWasDefaulted && (
              <p className="ocr-fuel-type-note">未识别到油号，已按常用 92# 预选，请保存前确认。</p>
            )}

            <div className="ocr-result-divider" />

            {(data.dashboardFuelPer100 || data.drivenKm || data.dashboardAvgSpeed || data.dashboardRange || data.dashboardOdo) && (
              <div className="flex flex-col gap-3">
                <div className="ocr-result-section-title">仪表盘识别数据</div>
                {fields.drivenKm && (
                  <EditableOcrRow
                    label="行驶里程"
                    value={fields.drivenKm}
                    displayValue={`${fields.drivenKm} km`}
                    status={confidence.drivenKm}
                    onChange={value => updateField('drivenKm', value)}
                    inputType="number"
                    inputMode="decimal"
                    suffix="km"
                  />
                )}
                {fields.dashboardAvgSpeed && (
                  <EditableOcrRow
                    label="平均车速"
                    value={fields.dashboardAvgSpeed}
                    displayValue={`${fields.dashboardAvgSpeed} km/h`}
                    status={confidence.dashboardAvgSpeed}
                    onChange={value => updateField('dashboardAvgSpeed', value)}
                    inputType="number"
                    inputMode="decimal"
                    suffix="km/h"
                  />
                )}
                {fields.dashboardFuelPer100 && (
                  <EditableOcrRow
                    label="表显油耗"
                    value={fields.dashboardFuelPer100}
                    displayValue={`${fields.dashboardFuelPer100} L/100km`}
                    status={confidence.dashboardFuelPer100}
                    onChange={value => updateField('dashboardFuelPer100', value)}
                    inputType="number"
                    inputMode="decimal"
                    suffix="L/100km"
                  />
                )}
                {fields.dashboardDriveHours && (
                  <EditableOcrRow
                    label="行驶时间"
                    value={fields.dashboardDriveHours}
                    displayValue={`${fields.dashboardDriveHours} h`}
                    status={confidence.dashboardDriveHours}
                    onChange={value => updateField('dashboardDriveHours', value)}
                    suffix="h"
                  />
                )}
                {fields.dashboardRange && (
                  <EditableOcrRow
                    label="剩余续航"
                    value={fields.dashboardRange}
                    displayValue={`${fields.dashboardRange} km`}
                    status={confidence.dashboardRange}
                    onChange={value => updateField('dashboardRange', value)}
                    inputType="number"
                    inputMode="numeric"
                    suffix="km"
                  />
                )}
                {fields.dashboardOdo && (
                  <EditableOcrRow
                    label="总里程"
                    value={fields.dashboardOdo}
                    displayValue={`${fields.dashboardOdo} km`}
                    status={confidence.dashboardOdo}
                    onChange={value => updateField('dashboardOdo', value)}
                    inputType="number"
                    inputMode="numeric"
                    suffix="km"
                  />
                )}
              </div>
            )}

            {crossCheckOk === true && editedData.fuelLiters && editedData.unitPrice && (
              <div className="ocr-check-note is-ok">
                <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
                <div>
                  交叉验证通过：<br/>{editedData.fuelLiters} L × {editedData.unitPrice} 元/L = {(editedData.fuelLiters * editedData.unitPrice).toFixed(2)} ≈ {editedData.totalCost?.toFixed(2)} 元
                </div>
              </div>
            )}

            {crossCheckOk === false && editedData.totalCost && (
              <div className="ocr-check-note">
                <AlertTriangle size={16} className="text-[#f5a623] mt-0.5 shrink-0" />
                <div>
                  交叉验证未通过，请仔细核对识别数值是否准确。
                </div>
              </div>
            )}

          </div>


          <div className="ocr-fill-confirm-card">
            <div className="ocr-fill-confirm-head">
              <strong>本次是否加满跳枪</strong>
              <span>默认按加满跳枪入库，请保存前确认。</span>
            </div>
            <div className="ocr-fill-segment">
              <button
                type="button"
                onClick={() => setFillType('full')}
                className={fillType === 'full' ? 'is-active' : ''}
              >
                加满跳枪
              </button>
              <button
                type="button"
                onClick={() => setFillType('partial')}
                className={fillType === 'partial' ? 'is-active' : ''}
              >
                固定金额/未加满
              </button>
            </div>
            {fixedAmountHint && (
              <p>识别金额接近整百，可能是固定金额加油。请确认是否真的加满跳枪。</p>
            )}
            {fillType === 'partial' && (
              <p>未加满记录会保存费用和升数，不单独计算实际油耗；下一次加满后合并区间计算。</p>
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
        {hasReceiptRequiredMissing && (
          <p className="ocr-confirm-footer-warning">请先补齐日期、加油量、单价和总价，再确认填入。</p>
        )}
        <button
          type="button"
          onClick={() => onConfirm({ ...editedData, fillType })}
          className="w-full py-4 rounded-xl font-bold"
        >
          确认填入
        </button>
      </div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
