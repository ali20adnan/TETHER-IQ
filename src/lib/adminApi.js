import { apiUrl, apiAbsoluteUrl } from './apiBase.js';

export async function adminRequest(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: options.signal ?? AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j.error) msg = j.error;
    } catch {
      /* plain text */
    }
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export function downloadBlob(blob, filename) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(u);
}

export async function exportCrmCsv(kind) {
  const path = kind === 'visits' ? '/api/admin/crm/export/visits.csv' : '/api/admin/crm/export/orders.csv';
  const res = await fetch(apiUrl(path), {
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(await res.text().catch(() => 'Export failed'));
  }
  return res.blob();
}

export function crmReportUrl(print = false) {
  const q = new URLSearchParams();
  if (print) q.set('print', '1');
  const qs = q.toString();
  return `${apiAbsoluteUrl('/api/admin/crm/report.html')}${qs ? `?${qs}` : ''}`;
}