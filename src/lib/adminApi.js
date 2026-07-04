import { apiUrl, apiAbsoluteUrl } from './apiBase.js';

export const ADMIN_LOGIN_CODE_KEY = 'admin_login_code';

export class AdminAuthError extends Error {
  constructor(message = 'رمز الدخول غير صحيح') {
    super(message);
    this.name = 'AdminAuthError';
    this.status = 401;
  }
}

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
  try {
    sessionStorage.removeItem('admin_crm_token');
    sessionStorage.removeItem('seller_admin_crm_token');
  } catch {
    /* ignore */
  }
  return v;
}

/** Prefer explicit code; fall back to session storage (handles stale React state). */
export function resolveLoginCode(explicit) {
  const fromArg = String(explicit || '').trim();
  if (fromArg) return fromArg;
  return readStoredLoginCode().trim();
}

function adminAuthHeaders(code) {
  const c = resolveLoginCode(code);
  return {
    'X-Admin-Login-Code': c,
    'X-Admin-Crm-Token': c,
    ...(c ? { Authorization: `Bearer ${c}` } : {}),
  };
}

export async function adminRequest(path, loginCode, options = {}) {
  const code = resolveLoginCode(loginCode);
  if (!code) {
    throw new AdminAuthError('أدخل رمز الدخول');
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...adminAuthHeaders(code),
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
    if (res.status === 401) {
      throw new AdminAuthError(msg === 'Unauthorized' ? 'رمز الدخول غير صحيح' : msg);
    }
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export async function verifyAdminLoginCode(loginCode) {
  return adminRequest('/api/admin/auth/check', loginCode);
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
  const code = resolveLoginCode(loginCode);
  const path = kind === 'visits' ? '/api/admin/crm/export/visits.csv' : '/api/admin/crm/export/orders.csv';
  const res = await fetch(apiUrl(path), {
    headers: adminAuthHeaders(code),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    if (res.status === 401) throw new AdminAuthError();
    throw new Error(await res.text().catch(() => 'Export failed'));
  }
  return res.blob();
}

export function crmReportUrl(loginCode, print = false) {
  const code = resolveLoginCode(loginCode);
  const q = new URLSearchParams({ code, token: code });
  if (print) q.set('print', '1');
  return `${apiAbsoluteUrl('/api/admin/crm/report.html')}?${q.toString()}`;
}