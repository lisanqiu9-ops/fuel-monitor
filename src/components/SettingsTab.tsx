import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  Settings,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FuelRecord } from '../types';
import { createExportPayload, normalizeFuelRecords } from '../data';

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
}

type StatusState = { type: 'idle' | 'testing' | 'success' | 'error'; msg: string };
type ImportMode = 'replace' | 'merge';

export function SettingsTab({ records, onRecordsChange }: Props) {
  const [workerUrl, setWorkerUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
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
    const payload = createExportPayload(records);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataMsg({ type: 'success', msg: `已导出 ${payload.records.length} 条记录` });
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

      const nextRecords = importMode === 'replace' ? importedRecords : [...records, ...importedRecords];
      onRecordsChange(nextRecords);
      setDataMsg({
        type: 'success',
        msg: importMode === 'replace'
          ? `已用 ${importedRecords.length} 条记录覆盖当前数据`
          : `已合并 ${importedRecords.length} 条记录`,
      });
    } catch (e: any) {
      setDataMsg({ type: 'error', msg: `导入失败: ${e.message}` });
    } finally {
      event.target.value = '';
    }
  };

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
    <div className="flex flex-col gap-4 p-4 pb-24 overflow-y-auto">
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <Database className="text-[#4fc3f7]" size={18} />
          <h3 className="text-[#e8ecf4] font-medium text-sm">数据备份</h3>
        </div>

        <div className="text-xs text-[#6b7a99] leading-relaxed">
          当前共有 {records.length} 条记录。分享应用时不要附带私有备份文件；自己使用新版时，可以在这里导入备份。
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-[#1a1a18] border border-white/10 text-[#e8ecf4] font-medium text-sm rounded-lg py-3 active:bg-white/5 transition-colors"
          >
            <Download size={16} />
            导出 JSON
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-[#1a1a18] border border-white/10 text-[#e8ecf4] font-medium text-sm rounded-lg py-3 active:bg-white/5 transition-colors"
          >
            <Upload size={16} />
            导入 JSON
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#0d0f14] p-1 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setImportMode('replace')}
            className={`text-xs rounded-md py-2 transition-colors ${importMode === 'replace' ? 'bg-[#f5a623] text-black font-semibold' : 'text-[#6b7a99]'}`}
          >
            覆盖当前数据
          </button>
          <button
            type="button"
            onClick={() => setImportMode('merge')}
            className={`text-xs rounded-md py-2 transition-colors ${importMode === 'merge' ? 'bg-[#f5a623] text-black font-semibold' : 'text-[#6b7a99]'}`}
          >
            合并到当前
          </button>
        </div>

        <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
        {renderStatus(dataMsg)}
      </div>

      <div className="bg-[#1a1e2a] card-glow rounded-xl p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <Settings className="text-[#f5a623]" size={18} />
          <h3 className="text-[#e8ecf4] font-medium text-sm">OCR 识别配置</h3>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-[#6b7a99] mb-1.5">Cloudflare Worker URL</label>
          <input
            type="url"
            value={workerUrl}
            onChange={e => {
              const next = e.target.value;
              setWorkerUrl(next);
              saveWorkerUrl(next);
            }}
            placeholder="https://xxx.workers.dev"
            className="bg-[#1a1a18] border border-white/10 rounded-lg px-3 py-2 text-[#e8ecf4] text-sm focus:border-[#f5a623] focus:outline-none w-full placeholder:text-white/20"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-[#6b7a99] mb-1.5">访问令牌（可选）</label>
          <input
            type="password"
            value={accessToken}
            onChange={e => {
              const next = e.target.value;
              setAccessToken(next);
              saveAccessToken(next);
            }}
            placeholder="Worker 设置 OCR_ACCESS_TOKEN 后填写"
            className="bg-[#1a1a18] border border-white/10 rounded-lg px-3 py-2 text-[#e8ecf4] text-sm focus:border-[#f5a623] focus:outline-none w-full placeholder:text-white/20"
          />
        </div>

        <div className="text-[10px] text-[#6b7a99] leading-relaxed bg-[#0d0f14] border border-white/5 rounded-lg p-3">
          百度 API Key 和 Secret Key 不再保存在浏览器里。请把它们配置到 Cloudflare Worker 的环境变量中。访问令牌用于防止别人直接调用你的 Worker。
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={handleTest}
            disabled={testRes.type === 'testing'}
            className="bg-[#1a1a18] border border-white/10 text-[#e8ecf4] font-medium text-sm rounded-lg py-3 active:bg-white/5 transition-colors disabled:opacity-50"
          >
            {testRes.type === 'testing' ? '连接中...' : '测试连接'}
          </button>
          {renderStatus(testRes)}
        </div>
      </div>

      <div className="bg-[#1a1e2a] card-glow rounded-xl flex flex-col overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="px-5 py-4 flex justify-between items-center bg-transparent active:bg-white/5 transition-colors"
        >
          <span className="text-[#e8ecf4] font-medium text-sm">如何配置 OCR</span>
          {showGuide ? <ChevronUp size={16} className="text-[#6b7a99]" /> : <ChevronDown size={16} className="text-[#6b7a99]" />}
        </button>

        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="px-5 flex flex-col gap-4 text-sm text-[#6b7a99] overflow-hidden"
            >
              <div className="pt-2 border-t border-white/5">
                <p className="font-medium text-[#e8ecf4] mb-1">步骤 1：准备百度 OCR 密钥</p>
                <p className="text-xs leading-relaxed">
                  前往 <a href="https://console.bce.baidu.com/ai" target="_blank" className="text-[#4fc3f7] underline">百度智能云控制台</a>，创建文字识别应用，拿到 API Key 和 Secret Key。
                </p>
              </div>

              <div>
                <p className="font-medium text-[#e8ecf4] mb-1">步骤 2：配置 Worker 环境变量</p>
                <p className="text-xs leading-relaxed">
                  在 Cloudflare Worker 的 Settings - Variables 里添加：
                </p>
                <div className="text-[10px] leading-relaxed bg-[#0d0f14] border border-white/5 rounded-lg p-3 mt-2">
                  BAIDU_API_KEY = 你的百度 API Key<br />
                  BAIDU_SECRET_KEY = 你的百度 Secret Key<br />
                  ALLOWED_ORIGINS = http://localhost:3000,http://localhost:3001,你的正式部署网址<br />
                  OCR_ACCESS_TOKEN = 可选，设置后前端也需要带令牌
                </div>
              </div>

              <div>
                <p className="font-medium text-[#e8ecf4] mb-1">步骤 3：部署 Worker 代码</p>
                <p className="text-xs leading-relaxed mb-2">
                  把下面代码部署到 Cloudflare Worker。部署后把 Worker URL 填到上方。
                </p>
                <div className="relative">
                  <pre className="bg-[#0d0f14] p-3 rounded-lg text-[10px] overflow-x-auto text-[#e8ecf4]/70 border border-white/5">
                    {WORKER_CODE}
                  </pre>
                  <button
                    onClick={copyCode}
                    className="absolute top-2 right-2 p-1.5 bg-[#1a1a18] border border-white/10 rounded text-[#e8ecf4] hover:bg-white/10"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="pb-5">
                <p className="font-medium text-[#e8ecf4] mb-1">步骤 4：测试连接</p>
                <p className="text-xs leading-relaxed">
                  填入 Worker URL 后点击“测试连接”。连接成功后，就可以在记录页使用拍照识别。
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
