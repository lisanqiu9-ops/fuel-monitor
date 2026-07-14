import { useRef, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  MessageCircle,
  Palette,
  PackageOpen,
  ScanLine,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FuelRecord } from '../types';
import { normalizeFuelRecords } from '../data';
import { downloadFuelCsv, downloadFuelJsonBackup } from '../lib/fuelExport';


interface Props {
  records: FuelRecord[];
  onRecordsChange: (records: FuelRecord[]) => void;
  onBackToToolbox?: () => void;
  theme?: string;
  themeOptions?: readonly { id: string; name: string }[];
  onThemeChange?: (theme: any) => void;
  cloudConfigured: boolean;
  cloudState: StatusState;
  onConnectCloud: (key: string) => Promise<void>;
}

type StatusState = { type: 'idle' | 'syncing' | 'success' | 'error'; msg: string };
type ImportMode = 'replace' | 'merge';
type PanelId = 'ocr' | 'import' | 'theme' | 'security' | 'about' | null;

export function SettingsTab({ records, onRecordsChange, onBackToToolbox, theme, themeOptions = [], onThemeChange, cloudConfigured, cloudState, onConnectCloud }: Props) {
  const [cloudKey, setCloudKey] = useState('');
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [dataMsg, setDataMsg] = useState<StatusState>({ type: 'idle', msg: '' });
  const importInputRef = useRef<HTMLInputElement>(null);

  const connectCloud = async () => {
    const key = cloudKey.trim();
    if (!key) return;
    try {
      await onConnectCloud(key);
      setCloudKey('');
    } catch {
      // 错误由上层 cloudState 显示，保留密钥便于用户核对后重试。
    }
  };

  const handleExport = () => {
    const count = downloadFuelJsonBackup(records);
    setDataMsg({ type: 'success', msg: `已导出 ${count} 条 JSON 备份` });
  };

  const handleExportCsv = () => {
    downloadFuelCsv(records);
    setDataMsg({ type: 'success', msg: `已导出 ${records.length} 条 CSV，可用 Numbers 打开` });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const importedRecords = normalizeFuelRecords(parsed);
      if (importedRecords.length === 0) {
        setDataMsg({ type: 'error', msg: '没有找到可导入的有效记录' });
        return;
      }

      const nextRecords = importMode === 'replace' ? importedRecords : mergeFuelRecords(records, importedRecords);
      onRecordsChange(nextRecords);
      setDataMsg({
        type: 'success',
        msg: importMode === 'replace'
          ? `已用 ${importedRecords.length} 条记录覆盖当前数据`
          : `已合并 ${importedRecords.length} 条记录，自动去重后共 ${nextRecords.length} 条`,
      });
    } catch (e: any) {
      setDataMsg({ type: 'error', msg: `导入失败: ${e.message}` });
    } finally {
      event.target.value = '';
    }
  };

  const handleClearLocal = () => {
    if (!window.confirm('确定清空全部加油记录吗？连接云端后，此操作也会同步清空云端记录。')) return;
    onRecordsChange([]);
    setDataMsg({ type: 'success', msg: '已清空记录并提交云端同步' });
  };

  const openPanel = (panel: Exclude<PanelId, null>) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const ocrStatusText = cloudConfigured
    ? cloudState.type === 'error' ? '连接异常' : '云端可用'
    : '待连接';
  const themeName = themeOptions.find(option => option.id === theme)?.name || '默认';
  const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
  const validFuel = records.filter(record => record.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0
    ? validFuel.reduce((sum, record) => sum + (record.actualFuelPer100 ?? 0), 0) / validFuel.length
    : null;
  const latestDate = records.length > 0 ? records[records.length - 1].date : '暂无记录';

  const renderStatus = (state: StatusState) => (
    <AnimatePresence>
      {state.type === 'syncing' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-[#f5a623] text-xs text-center bg-[#f5a623]/10 py-2 rounded-lg border border-[#f5a623]/20">
          {state.msg}
        </motion.div>
      )}
      {state.type === 'success' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-green-400 text-xs text-center bg-green-500/10 py-2 rounded-lg border border-green-500/20">
          {state.msg}
        </motion.div>
      )}
      {state.type === 'error' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-[#ff4757] text-xs p-2 rounded-lg bg-red-500/10 border border-red-500/20 break-words">
          {state.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="settings-home tab-content-panel flex flex-col gap-4 p-4 pb-24">
      <section className="settings-profile-card">
        <div className="settings-avatar">油</div>
        <div className="min-w-0 flex-1">
          <div className="settings-profile-title">油耗监控助手</div>
          <div className="settings-profile-sub">云端同步 · 本地离线缓存</div>
          <div className="settings-profile-meta">{records.length} 条记录 · 最近 {latestDate}</div>
        </div>
        <div className={cloudConfigured && cloudState.type !== 'error' ? 'settings-status-dot is-ready' : 'settings-status-dot'} />
      </section>

      <section className="settings-stats-grid">
        <div>
          <span>累计油费</span>
          <strong>¥{totalCost.toFixed(0)}</strong>
        </div>
        <div>
          <span>平均油耗</span>
          <strong>{avgFuel !== null ? avgFuel.toFixed(2) : '--'}</strong>
        </div>
        <div>
          <span>OCR 状态</span>
          <strong>{ocrStatusText}</strong>
        </div>
      </section>

      <SettingsGroup title="数据">
        <SettingsRow icon={Database} label="数据导入" value="默认合并去重" onClick={() => openPanel('import')} />
        <SettingsRow icon={ScanLine} label="油耗云端服务" value={ocrStatusText} onClick={() => openPanel('ocr')} />
        {themeOptions.length > 0 && onThemeChange && <SettingsRow icon={Palette} label="界面主题" value={themeName} onClick={() => openPanel('theme')} />}
        <SettingsRow icon={MessageCircle} label="问题反馈" onClick={() => openPanel('about')} />
      </SettingsGroup>

      <AnimatePresence initial={false}>
        {activePanel === 'ocr' && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="settings-panel"
          >
            <div className="settings-panel-head">
              <div>
                <span>油耗云端服务</span>
                <p>记录同步和 OCR 均通过 Cloudflare Worker</p>
              </div>
              <button type="button" onClick={() => setActivePanel(null)}>×</button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="settings-field-label">油耗访问密钥</label>
                <input
                  type="password"
                  value={cloudKey}
                  onChange={e => setCloudKey(e.target.value)}
                  placeholder={cloudConfigured ? '输入新密钥可重新连接' : '粘贴 FUEL_ACCESS_KEY'}
                  className="settings-input"
                />
              </div>

              <div className="settings-tip">
                Worker 地址已内置。百度密钥保存在 Cloudflare Secrets，当前浏览器只保存油耗访问密钥。
              </div>

              <button type="button" onClick={connectCloud} disabled={!cloudKey.trim() || cloudState.type === 'syncing'} className="settings-primary-button">
                {cloudState.type === 'syncing' ? '连接中...' : cloudConfigured ? '重新连接' : '连接云端'}
              </button>
              {renderStatus(cloudState)}
            </div>
          </motion.section>
        )}

        {activePanel === 'import' && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="settings-panel"
          >
            <div className="settings-panel-head">
              <div>
                <span>数据导入</span>
                <p>当前共有 {records.length} 条记录。建议使用合并模式，系统会自动去重。</p>
              </div>
              <button type="button" onClick={() => setActivePanel(null)}>×</button>
            </div>

            <div className="grid grid-cols-2 gap-2 settings-segment">
              <button type="button" onClick={() => setImportMode('merge')} className={importMode === 'merge' ? 'is-active' : ''}>
                合并去重
              </button>
              <button type="button" onClick={() => setImportMode('replace')} className={importMode === 'replace' ? 'is-active' : ''}>
                覆盖全部
              </button>
            </div>

            <div className="settings-tip">
              覆盖全部会先清空当前记录，只适合导入一份“完整合集”。如果只是补历史账单，请使用合并去重。
            </div>

            <button type="button" onClick={() => importInputRef.current?.click()} className="settings-primary-button w-full">
              <Upload size={16} />
              选择 JSON 文件
            </button>
            <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            {renderStatus(dataMsg)}
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {activePanel === 'theme' && themeOptions.length > 0 && onThemeChange && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="settings-panel"
          >
            <div className="settings-panel-head">
              <div>
                <span>界面主题</span>
                <p>主题属于低频偏好，已从页面顶部移到这里。</p>
              </div>
              <button type="button" onClick={() => setActivePanel(null)}>×</button>
            </div>
            <div className="grid grid-cols-2 gap-2 settings-segment">
              {themeOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onThemeChange(option.id);
                    setActivePanel(null);
                  }}
                  className={theme === option.id ? 'is-active' : ''}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <SettingsGroup title="安全与说明">
        <SettingsRow icon={Download} label="下载数据备份" value="JSON" onClick={handleExport} />
        <SettingsRow icon={FileSpreadsheet} label="下载表格数据" value="CSV" onClick={handleExportCsv} />
        <SettingsRow icon={Shield} label="安全说明" onClick={() => openPanel('security')} />
        <SettingsRow icon={Trash2} label="清空全部数据" danger onClick={handleClearLocal} />
      </SettingsGroup>

      <AnimatePresence initial={false}>
        {activePanel === 'security' && (
          <InfoPanel title="安全说明" icon={Shield} onClose={() => setActivePanel(null)}>
            加油记录经访问鉴权后保存到 Cloudflare R2，并在当前浏览器保留离线缓存。百度 OCR 密钥仅保存在 Worker Secrets，不会进入前端构建产物。
          </InfoPanel>
        )}
      </AnimatePresence>

      <SettingsGroup title="关于">
        {onBackToToolbox && (
          <SettingsRow icon={PackageOpen} label="返回三秋工具箱" value="切换工具" onClick={onBackToToolbox} />
        )}
        <SettingsRow icon={Info} label="关于 Web App" value="v0.1.0" onClick={() => openPanel('about')} />
        <SettingsRow icon={AlertTriangle} label="使用建议" value="先备份" onClick={() => openPanel('security')} />
      </SettingsGroup>

      <AnimatePresence initial={false}>
        {activePanel === 'about' && (
          <InfoPanel title="关于油耗监控" icon={Info} onClose={() => setActivePanel(null)}>
            这是面向个人使用的油耗记录工具，支持云端同步、小票识别、手动记录、趋势核算和 JSON 备份。
          </InfoPanel>
        )}
      </AnimatePresence>

      <footer className="settings-brand-footer">
        <strong>油耗监控助手</strong>
        <span>云端同步 · 本地离线缓存</span>
        <span>Web v0.1.0</span>
      </footer>
    </div>
  );
}

function mergeFuelRecords(currentRecords: FuelRecord[], importedRecords: FuelRecord[]) {
  const map = new Map<string, FuelRecord>();
  const makeKey = (record: FuelRecord) => [
    record.date,
    record.fuelLiters.toFixed(2),
    record.totalCost.toFixed(2),
    record.pricePerLiter.toFixed(2),
  ].join('|');

  [...currentRecords, ...importedRecords].forEach(record => {
    map.set(record.id || makeKey(record), record);
    map.set(makeKey(record), record);
  });

  return normalizeFuelRecords(Array.from(new Map(Array.from(map.values()).map(record => [makeKey(record), record])).values()));
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group-block">
      <div className="settings-group-title">{title}</div>
      <div className="settings-list-card">{children}</div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  danger = false,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={danger ? 'settings-list-row is-danger' : 'settings-list-row'} onClick={onClick}>
      <span className="settings-row-left">
        <span className="settings-row-icon"><Icon size={17} /></span>
        <strong>{label}</strong>
      </span>
      <span className="settings-row-right">
        {value && <span>{value}</span>}
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

function InfoPanel({
  title,
  icon: Icon,
  children,
  onClose,
}: {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="settings-panel"
    >
      <div className="settings-panel-head">
        <div className="flex items-center gap-2">
          <span className="settings-row-icon"><Icon size={17} /></span>
          <span>{title}</span>
        </div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <p className="settings-panel-text">{children}</p>
    </motion.section>
  );
}



