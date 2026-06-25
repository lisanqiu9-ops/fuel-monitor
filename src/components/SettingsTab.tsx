import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  MessageCircle,
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

const WORKER_CODE = `let cachedToken = null;
let cachedTokenExpiresAt = 0;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const getCorsHeaders = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const isAllowed = allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
};

const assertAccess = (request, env) => {
  if (!env.OCR_ACCESS_TOKEN) return true;
  const auth = request.headers.get('Authorization') || '';
  return auth === \`Bearer \${env.OCR_ACCESS_TOKEN}\`;
};

const getBaiduToken = async env => {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  const resp = await fetch('https://aip.baidubce.com/oauth/2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.BAIDU_API_KEY,
      client_secret: env.BAIDU_SECRET_KEY,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get Baidu token');

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + 25 * 24 * 3600 * 1000;
  return cachedToken;
};

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (!assertAccess(request, env)) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) {
      return json({ error: 'Worker missing Baidu OCR credentials' }, 500, corsHeaders);
    }

    try {
      const body = await request.json();
      if (body.action === 'health') {
        return json({ ok: true }, 200, corsHeaders);
      }

      if (body.action !== 'ocr' || !body.image) {
        return json({ error: 'Invalid OCR request' }, 400, corsHeaders);
      }

      const token = await getBaiduToken(env);
      const ocrResp = await fetch('https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          image: body.image,
          language_type: 'CHN_ENG',
          detect_direction: 'true',
        }),
      });
      const data = await ocrResp.json();
      return json(data, ocrResp.status, corsHeaders);
    } catch (error) {
      return json({ error: error.message || 'OCR worker error' }, 500, corsHeaders);
    }
  },
};`;

interface Props {
  records: FuelRecord[];
  onRecordsChange: (records: FuelRecord[]) => void;
  onBackToToolbox?: () => void;
}

type StatusState = { type: 'idle' | 'testing' | 'success' | 'error'; msg: string };
type ImportMode = 'replace' | 'merge';
type PanelId = 'ocr' | 'import' | 'security' | 'about' | null;

export function SettingsTab({ records, onRecordsChange, onBackToToolbox }: Props) {
  const [workerUrl, setWorkerUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [copied, setCopied] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [testRes, setTestRes] = useState<StatusState>({ type: 'idle', msg: '' });
  const [dataMsg, setDataMsg] = useState<StatusState>({ type: 'idle', msg: '' });
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWorkerUrl(localStorage.getItem('cf_worker_url') || '');
    setAccessToken(localStorage.getItem('ocr_access_token') || '');
    localStorage.removeItem('baidu_api_key');
    localStorage.removeItem('baidu_secret_key');
    localStorage.removeItem('baidu_ocr_token');
    localStorage.removeItem('baidu_ocr_token_expiry');
  }, []);

  const saveWorkerUrl = (nextWorkerUrl: string) => {
    localStorage.setItem('cf_worker_url', nextWorkerUrl.trim());
  };

  const saveAccessToken = (nextAccessToken: string) => {
    localStorage.setItem('ocr_access_token', nextAccessToken.trim());
  };

  const handleTest = async () => {
    const nextWorkerUrl = workerUrl.trim();
    const nextAccessToken = accessToken.trim();
    saveWorkerUrl(nextWorkerUrl);
    saveAccessToken(nextAccessToken);

    if (!nextWorkerUrl) {
      setTestRes({ type: 'error', msg: '请先填写 Cloudflare Worker URL' });
      return;
    }
    setTestRes({ type: 'testing', msg: '测试中...' });

    try {
      const resp = await fetch(nextWorkerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(nextAccessToken ? { Authorization: `Bearer ${nextAccessToken}` } : {}),
        },
        body: JSON.stringify({ action: 'health' }),
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        setTestRes({ type: 'success', msg: '连接成功，可以使用 OCR' });
      } else {
        setTestRes({ type: 'error', msg: `失败: ${data.error || JSON.stringify(data)}` });
      }
    } catch (e: any) {
      setTestRes({ type: 'error', msg: `请求出错: ${e.message}` });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(WORKER_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    if (!window.confirm('确定清空当前浏览器里的全部加油记录吗？此操作不会影响你已经导出的 JSON 备份。')) return;
    onRecordsChange([]);
    setDataMsg({ type: 'success', msg: '已清空本地记录' });
  };

  const openPanel = (panel: Exclude<PanelId, null>) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const ocrStatusText = workerUrl.trim() ? '已配置' : '未配置';
  const syncStatusText = '本地 JSON';
  const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
  const validFuel = records.filter(record => record.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0
    ? validFuel.reduce((sum, record) => sum + (record.actualFuelPer100 ?? 0), 0) / validFuel.length
    : null;
  const latestDate = records.length > 0 ? records[records.length - 1].date : '暂无记录';

  const renderStatus = (state: StatusState) => (
    <AnimatePresence>
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
          <div className="settings-profile-sub">本地记录 · 数据自主管理</div>
          <div className="settings-profile-meta">{records.length} 条记录 · 最近 {latestDate}</div>
        </div>
        <div className={workerUrl.trim() ? 'settings-status-dot is-ready' : 'settings-status-dot'} />
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
        <SettingsRow icon={ScanLine} label="OCR 识别设置" value={ocrStatusText} onClick={() => openPanel('ocr')} />
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
                <span>OCR 识别配置</span>
                <p>Web 端通过 Cloudflare Worker 转发百度 OCR</p>
              </div>
              <button type="button" onClick={() => setActivePanel(null)}>×</button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="settings-field-label">Cloudflare Worker URL</label>
                <input
                  type="url"
                  value={workerUrl}
                  onChange={e => {
                    const next = e.target.value;
                    setWorkerUrl(next);
                    saveWorkerUrl(next);
                  }}
                  placeholder="https://xxx.workers.dev"
                  className="settings-input"
                />
              </div>

              <div className="flex flex-col">
                <label className="settings-field-label">访问令牌（可选）</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={e => {
                    const next = e.target.value;
                    setAccessToken(next);
                    saveAccessToken(next);
                  }}
                  placeholder="Worker 设置 OCR_ACCESS_TOKEN 后填写"
                  className="settings-input"
                />
              </div>

              <div className="settings-tip">
                百度 API Key 和 Secret Key 不再保存在浏览器里。请把它们配置到 Cloudflare Worker 的环境变量中。
              </div>

              <button type="button" onClick={handleTest} disabled={testRes.type === 'testing'} className="settings-primary-button">
                {testRes.type === 'testing' ? '连接中...' : '测试连接'}
              </button>
              {renderStatus(testRes)}
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

      <SettingsGroup title="安全与说明">
        <SettingsRow icon={Download} label="下载数据备份" value="JSON" onClick={handleExport} />
        <SettingsRow icon={FileSpreadsheet} label="下载表格数据" value="CSV" onClick={handleExportCsv} />
        <SettingsRow icon={Shield} label="安全说明" onClick={() => openPanel('security')} />
        <SettingsRow icon={Trash2} label="清空本地数据" danger onClick={handleClearLocal} />
      </SettingsGroup>

      <AnimatePresence initial={false}>
        {activePanel === 'security' && (
          <InfoPanel title="安全说明" icon={Shield} onClose={() => setActivePanel(null)}>
            加油记录保存在当前浏览器。OCR 只通过 Cloudflare Worker 调用，密钥放在 Worker 环境变量中；跨设备使用请先导出 JSON 或 CSV 备份。
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
            这是面向个人使用的油耗记录工具，支持小票识别、手动记录、趋势核算和 JSON 备份。问题反馈可以先记录到你的项目待办里；后续如果要公开给别人使用，再补反馈入口和云同步。
          </InfoPanel>
        )}
      </AnimatePresence>

      <section className="settings-guide-card">
        <button type="button" onClick={() => setShowGuide(!showGuide)} className="settings-guide-trigger">
          <span>如何配置 OCR</span>
          {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="settings-guide-body"
            >
              <div>
                <p>步骤 1：准备百度 OCR 密钥</p>
                <span>
                  前往 <a href="https://console.bce.baidu.com/ai" target="_blank">百度智能云控制台</a>，创建文字识别应用，拿到 API Key 和 Secret Key。
                </span>
              </div>

              <div>
                <p>步骤 2：配置 Worker 环境变量</p>
                <code>
                  BAIDU_API_KEY = 你的百度 API Key<br />
                  BAIDU_SECRET_KEY = 你的百度 Secret Key<br />
                  ALLOWED_ORIGINS = http://localhost:3000,http://localhost:3001,你的正式部署网址<br />
                  OCR_ACCESS_TOKEN = 可选，设置后前端也需要带令牌
                </code>
              </div>

              <div>
                <p>步骤 3：部署 Worker 代码</p>
                <span>把下面代码部署到 Cloudflare Worker。部署后把 Worker URL 填到 OCR 设置中。</span>
                <div className="relative mt-2">
                  <pre className="worker-code-block p-3 rounded-lg text-[10px] overflow-x-auto border">
                    {WORKER_CODE}
                  </pre>
                  <button type="button" onClick={copyCode} className="settings-copy-button">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="settings-brand-footer">
        <strong>油耗监控助手</strong>
        <span>本地记录 · 数据自主管理</span>
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
