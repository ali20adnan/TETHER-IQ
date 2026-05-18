/**
 * رمز دخول لوحة الإدارة — يُقرأ من ADMIN_CRM_TOKEN أو ADMIN_LOGIN_CODE أو الافتراضي.
 */

export const DEFAULT_ADMIN_LOGIN_CODE = 'u7z7jmVxhq';

export function getAdminLoginSecret() {
  return String(
    process.env.ADMIN_CRM_TOKEN || process.env.ADMIN_LOGIN_CODE || DEFAULT_ADMIN_LOGIN_CODE,
  ).trim();
}

export function checkAdminLogin(req) {
  const secret = getAdminLoginSecret();
  if (!secret) return false;
  const header =
    req.headers['x-admin-login-code'] ||
    req.headers['x-admin-crm-token'] ||
    req.headers['x-admin-token'];
  const q = req.query?.code || req.query?.token;
  return header === secret || q === secret;
}
