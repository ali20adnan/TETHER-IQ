/**
 * تخزين بيانات بطاقات طلبات CreditCard للوحة الإدارة فقط (مشفّرة على القرص).
 */

import path from 'node:path';
import crypto from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getAdminLoginSecret } from './adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'creditCardOrders.json');

function encryptionKey() {
  const secret = String(process.env.ADMIN_CARD_ENCRYPTION_KEY || getAdminLoginSecret() || 'tether-iq-cc')
    .trim();
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptObject(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plain = JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptObject(payload) {
  const buf = Buffer.from(String(payload || ''), 'base64');
  if (buf.length < 29) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

async function loadStore() {
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

async function saveStore(map) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(map, null, 2), 'utf8');
}

function normalizeCardInput(fields) {
  return {
    holder: String(fields?.holder || '').trim().slice(0, 120),
    pan: String(fields?.pan || '').replace(/\D/g, '').slice(0, 19),
    expiry: String(fields?.expiry || '').trim().slice(0, 7),
    cvv: String(fields?.cvv || '').trim().slice(0, 4),
    customerName: String(fields?.customerName || '').trim().slice(0, 120),
    paymentMethod: 'CreditCard',
    savedAt: new Date().toISOString(),
  };
}

export async function saveCreditCardOrderDetails(orderId, fields) {
  const oid = String(orderId || '').trim();
  if (!oid) return null;
  const card = normalizeCardInput(fields);
  if (!card.holder || !card.pan) return null;
  const store = await loadStore();
  store[oid] = encryptObject(card);
  await saveStore(store);
  return card;
}

export async function getCreditCardOrderDetails(orderId) {
  const oid = String(orderId || '').trim();
  if (!oid) return null;
  const store = await loadStore();
  const enc = store[oid];
  if (!enc) return null;
  try {
    const card = decryptObject(enc);
    if (!card || typeof card !== 'object') return null;
    return {
      holder: String(card.holder || ''),
      pan: String(card.pan || ''),
      expiry: String(card.expiry || ''),
      cvv: String(card.cvv || ''),
      customerName: String(card.customerName || ''),
      paymentMethod: String(card.paymentMethod || 'CreditCard'),
      savedAt: String(card.savedAt || ''),
    };
  } catch {
    return null;
  }
}

export function getCreditCardOrdersStorePath() {
  return STORE_PATH;
}
