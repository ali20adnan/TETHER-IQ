/**
 * رمز دخول لوحة الإدارة — يُقرأ من ADMIN_CRM_TOKEN أو ADMIN_LOGIN_CODE فقط.
 */

import crypto from 'node:crypto';

export function getAdminLoginSecret() {
  return String(
    process.env.ADMIN_CRM_TOKEN || process.env.ADMIN_LOGIN_CODE || '',
  ).trim();
}

function readBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function safeEqual(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (!sa || !sb) return false;
  const ba = Buffer.from(sa);
  const bb = Buffer.from(sb);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** @returns {string} submitted login code from headers, bearer, or query */
export function readAdminLoginAttempt(req) {
  const header =
    req.headers['x-admin-login-code'] ||
    req.headers['x-admin-crm-token'] ||
    req.headers['x-admin-token'];
  const q = req.query?.code || req.query?.token;
  return String(header || readBearerToken(req) || q || '').trim();
}

export function checkAdminLogin(req) {
  const secret = getAdminLoginSecret();
  if (!secret) return false;
  const attempt = readAdminLoginAttempt(req);
  if (!attempt) return false;
  return safeEqual(attempt, secret);
}
