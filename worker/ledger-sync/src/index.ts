interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  httpEtag: string;
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: string, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
}

interface Env {
  LEDGER_BUCKET: R2Bucket;
  LEDGER_READ_KEY: string;
  LEDGER_WRITE_KEY: string;
  CORS_ALLOWED_ORIGIN?: string;
}

const LEDGER_FILE = 'ledger.csv';
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const REQUIRED_HEADERS = ['id', 'date', 'time', 'type', 'amount', 'category1', 'merchant', 'account'];

const corsHeaders = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.CORS_ALLOWED_ORIGIN || '';
  return {
    'Access-Control-Allow-Origin': origin === allowed ? allowed : 'null',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const response = (request: Request, env: Env, body: BodyInit | null, status: number, headers: HeadersInit = {}) => {
  return new Response(body, { status, headers: { ...corsHeaders(request, env), ...headers } });
};

const json = (request: Request, env: Env, value: Record<string, unknown>, status = 200) => {
  return response(request, env, JSON.stringify(value), status, { 'Content-Type': 'application/json; charset=utf-8' });
};

const hasBearer = (request: Request, expected: string) => {
  return request.headers.get('Authorization') === `Bearer ${expected}`;
};

const normalizeCsv = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/,\n/g, '\n').replace(/,$/, '');

const validLedgerCsv = (text: string) => {
  const [header = '', firstRecord = ''] = text.split('\n');
  const headers = header.split(',').map(value => value.trim());
  return REQUIRED_HEADERS.every(field => headers.includes(field)) && Boolean(firstRecord.trim());
};

const readCsvBody = async (request: Request) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) return request.text();

  const form = await request.formData();
  const file = Array.from(form.values()).find(value => value instanceof File);
  if (!file) throw new Error('No CSV file found in multipart request');
  return file.text();
};

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') return response(request, env, null, 204);

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json(request, env, { ok: true, service: 'ledger-sync' });

    if (request.method === 'PUT' && url.pathname === '/ledger/sync') {
      if (!hasBearer(request, env.LEDGER_WRITE_KEY)) return json(request, env, { error: '未授权写入' }, 401);

      let raw: string;
      try {
        raw = await readCsvBody(request);
      } catch (reason) {
        console.error('Unable to read ledger sync request body', reason);
        return json(request, env, { error: 'Invalid CSV upload body' }, 400);
      }
      if (new TextEncoder().encode(raw).byteLength > MAX_CSV_BYTES) return json(request, env, { error: 'CSV 文件超过 2MB 限制' }, 413);

      const csv = normalizeCsv(raw);
      if (!validLedgerCsv(csv)) return json(request, env, { error: 'CSV 缺少必要表头或账目记录' }, 400);

      await env.LEDGER_BUCKET.put(LEDGER_FILE, csv, {
        httpMetadata: { contentType: 'text/csv; charset=utf-8' },
        customMetadata: { syncedAt: new Date().toISOString() },
      });
      return json(request, env, { ok: true, bytes: new TextEncoder().encode(csv).byteLength, syncedAt: new Date().toISOString() });
    }

    if (request.method === 'GET' && url.pathname === '/ledger/data') {
      if (!hasBearer(request, env.LEDGER_READ_KEY)) return json(request, env, { error: '未授权读取' }, 401);

      const object = await env.LEDGER_BUCKET.get(LEDGER_FILE);
      if (!object) return json(request, env, { error: '云端账本尚未同步' }, 404);

      return response(request, env, object.body, 200, {
        'Content-Type': object.httpMetadata?.contentType || 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        ETag: object.httpEtag,
        'X-Ledger-Synced-At': object.customMetadata?.syncedAt || '',
      });
    }

    return json(request, env, { error: 'Not found' }, 404);
  },
};
