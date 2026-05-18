const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const ADMIN_LOGIN_CODE_KEY = 'admin_login_code';

export function clearStoredLoginCode() {
  try {
    sessionStorage.removeItem(ADMIN_LOGIN_CODE_KEY);
    sessionStorage.removeItem('admin_crm_token');
    sessionStorage.removeItem('seller_admin_crm_token');
  } catch {
    /* ignore */
  }
}
/** @deprecated use ADMIN_LOGIN_CODE_KEY */
export const ADMIN_TOKEN_KEY = ADMIN_LOGIN_CODE_KEY;

export function readStoredLoginCode() {
  try {
    return (
      sessionStorage.getItem(ADMIN_LOGIN_CODE_KEY)
      || sessionStorage.getItem('admin_crm_token')
      || sessionStorage.getItem('seller_admin_crm_token')
      || ''
    );
  } catch {
    return '';
  }
}

export function storeLoginCode(code) {
  const v = String(code || '').trim();
  sessionStorage.setItem(ADMIN_LOGIN_CODE_KEY, v);
  return v;
}

function adminAuthHeaders(code) {
  return {
    'X-Admin-Login-Code': code,
    'X-Admin-Crm-Token': code,
  };
}

export async function adminRequest(path, loginCode, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...adminAuthHeaders(loginCode),
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

export async function exportCrmCsv(loginCode, kind) {
  const path = kind === 'visits' ? '/api/admin/crm/export/visits.csv' : '/api/admin/crm/export/orders.csv';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: adminAuthHeaders(loginCode),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Export failed'));
  return res.blob();
}

export function crmReportUrl(loginCode, print = false) {
  const q = new URLSearchParams({ code: loginCode, token: loginCode });
  if (print) q.set('print', '1');
  return `${window.location.origin}${API_BASE}/api/admin/crm/report.html?${q.toString()}`;
}
