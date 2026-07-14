import type { FuelRecord } from '../types';

const endpoint = 'https://sanqiu-toolbox-api.lisanqiu9.workers.dev';
const accessKeyStorageKey = 'sanqiu-fuel-access-key';

const readError = async (response: Response) => {
  try {
    const data = await response.json() as { error?: string };
    return data.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

export const configureFuelCloudKey = (key: string) => {
  localStorage.setItem(accessKeyStorageKey, key.trim());
};

export const getFuelCloudKey = () => localStorage.getItem(accessKeyStorageKey)?.trim() || '';

export const clearFuelCloudKey = () => localStorage.removeItem(accessKeyStorageKey);

export const configureFuelCloudFromUrl = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get('fuel_key')?.trim();
  if (key) {
    configureFuelCloudKey(key);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }
  return hasFuelCloudKey();
};

export const hasFuelCloudKey = () => Boolean(getFuelCloudKey());

export const getFuelCloudHeaders = () => {
  const key = getFuelCloudKey();
  if (!key) throw new Error('请先连接油耗云端服务');
  return { Authorization: `Bearer ${key}` };
};

export const loadCloudFuelRecords = async (): Promise<unknown[] | null> => {
  const response = await fetch(`${endpoint}/api/fuel/records`, {
    headers: getFuelCloudHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`云端油耗记录读取失败：${await readError(response)}`);

  const data = await response.json() as { records?: unknown };
  if (!Array.isArray(data.records)) throw new Error('云端油耗记录格式无效');
  return data.records;
};

export const saveCloudFuelRecords = async (records: FuelRecord[]) => {
  const response = await fetch(`${endpoint}/api/fuel/records`, {
    method: 'PUT',
    headers: {
      ...getFuelCloudHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });
  if (!response.ok) throw new Error(`云端油耗记录写入失败：${await readError(response)}`);
};

export const callCloudFuelOcr = async (base64Image: string) => {
  const response = await fetch(`${endpoint}/api/fuel/ocr`, {
    method: 'POST',
    headers: {
      ...getFuelCloudHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!response.ok) throw new Error(`OCR 请求失败：${await readError(response)}`);
  return response.json();
};
