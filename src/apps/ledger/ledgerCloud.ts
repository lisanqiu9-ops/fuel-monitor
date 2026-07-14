import { parseLedgerText } from './ledgerParser';

const endpoint = 'https://sanqiu-ledger-sync.lisanqiu9.workers.dev';
const readKeyStorageKey = 'sanqiu-ledger-read-key';

export const configureLedgerCloudKey = (key: string) => {
  localStorage.setItem(readKeyStorageKey, key.trim());
};

export const configureLedgerCloudFromUrl = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get('ledger_key')?.trim();
  if (key) {
    configureLedgerCloudKey(key);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }
  return Boolean(localStorage.getItem(readKeyStorageKey)?.trim());
};

export const loadCloudLedger = async () => {
  const key = localStorage.getItem(readKeyStorageKey)?.trim();
  if (!key) return null;

  const response = await fetch(`${endpoint}/ledger/data`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`云端账本读取失败（${response.status}）`);

  return parseLedgerText(await response.text());
};
