import tetherApi from '../../public/tether-api.json';

function normalizeOrigin(s) {
  return (s ?? '').replace(/\/$/, '').trim();
}

/**
 * أولوية: VITE_API_BASE_URL من البناء، ثم apiOrigin من public/tether-api.json.
 * القيمة الفارغة = نفس النطاق (بدون CORS). في التطوير: proxy في vite.config.js.
 */
function resolveApiOrigin() {
  const fromEnv = normalizeOrigin(import.meta.env.VITE_API_BASE_URL);
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv;
  }

  if (import.meta.env.DEV) {
    return '';
  }

  const fromFile = normalizeOrigin(tetherApi?.apiOrigin);
  if (fromFile && /^https?:\/\//i.test(fromFile)) {
    return fromFile;
  }

  // إنتاج: نفس النطاق افتراضياً (tetheriq.ch يخدم الواجهة والـ API معاً)
  return '';
}

const cachedBase = resolveApiOrigin();

export function getApiOrigin() {
  return cachedBase;
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (cachedBase) {
    return `${cachedBase}${p}`;
  }
  return p;
}

/** روابط تُفتح في المتصفح (تقرير CRM، إلخ) */
export function apiAbsoluteUrl(path) {
  const rel = apiUrl(path);
  if (/^https?:\/\//i.test(rel)) {
    return rel;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${rel}`;
  }
  return rel;
}
