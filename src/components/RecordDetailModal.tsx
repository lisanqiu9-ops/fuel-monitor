import { useState } from 'react';
import { FuelRecord } from '../types';
import { Activity, Calendar, ChevronLeft, ClipboardList, Clock, Copy, Fuel, Gauge, Navigation, Route, Share2, Tag, WalletCards, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateEnergyMetrics, getPreviousRecord } from '../lib/metrics';
import { generateRecordReport } from '../lib/report';
import { createRecordNotesSummary, shareText } from '../lib/fuelExport';

interface Props {
  record: FuelRecord;
  allRecords: FuelRecord[];
  onClose: () => void;
}

const formatMoney = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '--' : `¥${value.toFixed(digits)}`;

const formatNumber = (value: number | null | undefined, suffix = '', digits?: number) => {
  if (value === null || value === undefined) return '--';
  const text = typeof digits === 'number' ? value.toFixed(digits) : String(value);
  return `${text}${suffix}`;
};

export function RecordDetailModal({ record, allRecords, onClose }: Props) {
  const [message, setMessage] = useState('');
  const validFuel = allRecords.filter((item) => item.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0
    ? validFuel.reduce((acc, item) => acc + item.actualFuelPer100!, 0) / validFuel.length
    : 0;

  const actual = record.actualFuelPer100 || 0;
  const dash = record.dashboardFuelPer100 || 0;
  const metrics = calculateEnergyMetrics(record, getPreviousRecord(allRecords, record));
  const report = generateRecordReport(record, allRecords);
  const maxScale = Math.max(actual, dash, avgFuel, 10);
  const getPercent = (value: number) => `${Math.min((value / maxScale) * 100, 100)}%`;
  const summaryText = createRecordNotesSummary(record);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 1600);
  };

  const handleCopySummary = async () => {
    await navigator.clipboard.writeText(summaryText);
    notify('摘要已复制');
  };

  const handleShareSummary = async () => {
    const result = await shareText('车辆油耗记录', summaryText);
    notify(result === 'shared' ? '已打开系统分享' : '摘要已复制');
  };

  const stats = [
    { icon: Fuel, label: '加油量', value: formatNumber(record.fuelLiters, ' L'), primary: true },
    { icon: WalletCards, label: '总价', value: formatMoney(record.totalCost, 0), primary: true },
    { icon: Tag, label: '单价', value: `${formatMoney(record.pricePerLiter, 2)}/L`, primary: false },
    { icon: Fuel, label: '油号', value: record.fuelType || '--', primary: false },
    { icon: Fuel, label: '加油方式', value: record.fillType === 'partial' ? '固定金额/未加满' : '加满跳枪', primary: false },
  ];

  const dashboardStats = [
    { icon: Route, label: '行驶里程', value: formatNumber(record.drivenKm, ' km') },
    { icon: Gauge, label: '表显油耗', value: formatNumber(record.dashboardFuelPer100, ' L/100km', 1) },
    { icon: Zap, label: '均速', value: formatNumber(record.dashboardAvgSpeed, ' km/h') },
    { icon: Clock, label: '行驶时间', value: record.dashboardDriveHours ? `${record.dashboardDriveHours} h` : '--' },
    { icon: Navigation, label: '剩余续航', value: formatNumber(record.dashboardRange, ' km') },
    { icon: Gauge, label: '总里程 ODO', value: formatNumber(record.dashboardOdo, ' km') },
  ];

  return (
    <motion.div
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 18, opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="record-detail-page absolute inset-0 z-50 flex flex-col"
    >
      <div className="record-detail-header shrink-0 px-5 pt-safe">
        <button type="button" onClick={onClose} className="soft-back-button" aria-label="返回">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[11px] font-semibold text-[#9b978f]">加油记录</div>
          <h2 className="mt-0.5 text-lg font-semibold text-[#191817]">加油详情</h2>
        </div>
        <div className="w-10" />
      </div>

      <div className="record-detail-scroll flex-1 overflow-y-auto px-5 pb-[calc(94px+env(safe-area-inset-bottom,0px))]">
        <section className="detail-date-row">
          <Calendar size={18} />
          <div>
            <span>{record.date}</span>
            <small>{record.fuelType || '加油记录'} · {record.fuelLiters} L · {record.fillType === 'partial' ? '未加满' : '跳枪'}</small>
          </div>
        </section>

        <section className="detail-main-card">
          <div className="detail-main-grid">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
              <div key={item.label} className={item.primary ? 'detail-main-item detail-main-primary' : 'detail-main-item'}>
                <div className="detail-mini-icon"><Icon size={15} /></div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              );
            })}
          </div>
          {metrics.costPerKm !== null && (
            <div className="detail-cost-row">
              <span>每公里花费</span>
              <strong>{metrics.costPerKm.toFixed(3)} 元/km</strong>
            </div>
          )}
        </section>

        <section className={`detail-card detail-report-card report-tone-${report.tone}`}>
          <div className="detail-card-title">
            <ClipboardList size={18} />
            <span>本次解读</span>
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
        </section>

        <section className="detail-card">
          <div className="detail-card-title">
            <Activity size={18} />
            <span>油耗核算</span>
          </div>
          <div className="detail-metric-grid">
            <div>
              <span>实际百公里油耗</span>
              <strong>{formatNumber(metrics.actualFuelPer100, ' L/100km', 2)}</strong>
            </div>
            <div>
              <span>每公里花费</span>
              <strong>{metrics.costPerKm !== null ? `${metrics.costPerKm.toFixed(3)} 元/km` : '--'}</strong>
            </div>
            <div>
              <span>每公里油耗</span>
              <strong>{formatNumber(metrics.fuelPerKm, ' L/km', 4)}</strong>
            </div>
            <div>
              <span>表显误差</span>
              <strong>{metrics.displayError !== null ? `${metrics.displayError > 0 ? '+' : ''}${metrics.displayError.toFixed(2)}` : '--'}</strong>
            </div>
          </div>
          <div className="detail-note">
            <span>{metrics.odoMessage}</span>
            {metrics.odoDiff !== null && (
              <span>ODO 差值：{metrics.odoDiff > 0 ? '+' : ''}{metrics.odoDiff} km</span>
            )}
          </div>
        </section>

        {(actual > 0 || dash > 0 || avgFuel > 0) && (
          <section className="detail-card">
            <div className="detail-card-title">
              <Activity size={18} />
              <span>油耗对比分析</span>
            </div>
            {actual > 0 && (
              <FuelBar label="实际油耗" value={`${actual.toFixed(2)} L/100km`} width={getPercent(actual)} tone="brand" />
            )}
            {dash > 0 && (
              <FuelBar label="表显油耗" value={`${dash.toFixed(2)} L/100km`} width={getPercent(dash)} tone="accent" />
            )}
            {avgFuel > 0 && (
              <FuelBar label="全周期平均" value={`${avgFuel.toFixed(2)} L/100km`} width={getPercent(avgFuel)} tone="muted" />
            )}
          </section>
        )}

        <section className="detail-card">
          <div className="detail-card-title">
            <Fuel size={18} />
            <span>仪表盘数据</span>
          </div>
          <div className="detail-dashboard-grid">
            {dashboardStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <Icon size={15} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>
        </section>
        {message && <div className="report-toast">{message}</div>}
      </div>

      <div className="detail-share-footer">
        <button type="button" onClick={handleCopySummary}>
          <Copy size={16} />
          复制摘要
        </button>
        <button type="button" onClick={handleShareSummary}>
          <Share2 size={16} />
          分享到备忘录
        </button>
      </div>
    </motion.div>
  );
}

function FuelBar({ label, value, width, tone }: { label: string; value: string; width: string; tone: 'brand' | 'accent' | 'muted' }) {
  return (
    <div className="detail-bar-row">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="detail-bar-track">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.45 }}
          className={`detail-bar-fill detail-bar-${tone}`}
        />
      </div>
    </div>
  );
}
