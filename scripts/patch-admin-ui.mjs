import fs from 'fs';
import { fileURLToPath } from 'url';

const p = fileURLToPath(new URL('../src/pages/AdminDashboard.jsx', import.meta.url));
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  /\s*\) : \(\s*<form[\s\S]*?admin-login-form--inline[\s\S]*?<\/form>\s*\)\}/,
  '\n            )}',
);

s = s.replace(
  '<header className="admin-dashboard__header">',
  '{!saved && (\n          <>\n        <header className="admin-dashboard__header admin-dashboard__header--gate">',
);

s = s.replace(
  '</section>\n\n        <Alert err={err}',
  '</section>\n          </>\n        )}\n\n        {saved && <Alert err={err}',
);

s = s.replace('{saved && <Alert err={err}', '<Alert err={err}');

const oldNav = `        {saved && (
          <>
            <nav className="admin-tabs" aria-label="أقسام الإدارة">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={\`admin-tabs__btn\${tab === t.id ? ' admin-tabs__btn--active' : ''}\`}
                  onClick={() => { setTab(t.id); setErr(''); setOk(''); }}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {loading && <p className="text-muted">جاري التحميل…</p>}`;

const newNav = `        {saved && (
          <motion className="admin-app">
            <aside className="admin-sidebar glass-panel" aria-label="القائمة">
              <div className="admin-sidebar__brand">
                <span className="admin-sidebar__logo">TIQ</span>
                <div><strong>TETHER IQ</strong><small>لوحة الإدارة</small></motion>
              </motion>
              <nav className="admin-sidebar__nav">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={\`admin-sidebar__link\${tab === t.id ? ' admin-sidebar__link--active' : ''}\`}
                    onClick={() => { setTab(t.id); dismissAlerts(); }}
                  >
                    <span className="admin-sidebar__icon" aria-hidden>{t.icon}</span>
                    <span className="admin-sidebar__text">
                      <span className="admin-sidebar__label">{t.label}</span>
                      <span className="admin-sidebar__desc">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </nav>
              <button type="button" className="admin-sidebar__logout" onClick={logout}>تسجيل الخروج</button>
            </aside>
            <div className="admin-main">
              <header className="admin-topbar glass-panel">
                <div className="admin-topbar__titles">
                  <h1 className="admin-topbar__title">{activeTabMeta.label}</h1>
                  <p className="admin-topbar__desc">{activeTabMeta.desc}</p>
                </motion>
                <div className="admin-topbar__actions">
                  {loading && <span className="admin-topbar__loading">جاري التحميل…</span>}
                  <Link to="/" className="admin-dashboard__home">الرئيسية</Link>
                  <span className="admin-session-pill">
                    <span className="admin-login-card__status-dot" aria-hidden />
                    متصل
                  </span>
                </motion>
              </header>
              <div className="admin-content">`;

if (!s.includes('admin-sidebar__nav')) {
  if (!s.includes('admin-tabs')) {
    console.error('admin-tabs not found, maybe already patched');
    process.exit(1);
  }
  s = s.replace(oldNav, newNav);
}

s = s.replace(
  /(\{tab === 'system'[\s\S]*?<\/Panel>\s*\)\})\s*<>\s*\)\s*}\s*<\/div>\s*<\/motion>\s*\);/,
  '$1\n            </div>\n          </motion>\n        )}\n      </div>\n    </motion>\n  );',
);

s = s.replace(/<\/?motion\b/g, (t) => t.replace('motion', 'div'));

const systemOld = `{tab === 'system' && (
              <Panel title="النظام وتيليغرام">
                <Btn onClick={() => run(async () => {
                  setTelegramProbe(await adminRequest(\`/api/admin/telegram-probe?code=\${encodeURIComponent(code)}\`, code));
                })}>فحص تيليغرام</Btn>
                {telegramProbe && <pre className="admin-pre">{JSON.stringify(telegramProbe, null, 2)}</pre>}
              </Panel>
            )}`;

const systemNew = `{tab === 'system' && (
              <Panel
                title="النظام وتيليغرام"
                actions={
                  <Btn
                    variant="outline"
                    onClick={() => run(async () => {
                      setTelegramProbe(
                        await adminRequest(\`/api/admin/telegram-probe?code=\${encodeURIComponent(code)}\`, code),
                      );
                    }, true)}
                  >
                    فحص الاتصال
                  </Btn>
                }
              >
                <p className="admin-empty-hint">تحقق من إعدادات تيليغرام ومعرّف المحادثة على السيرفر.</p>
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
                  </motion>
                )}
                {telegramProbe && <pre className="admin-pre">{JSON.stringify(telegramProbe, null, 2)}</pre>}
              </Panel>
            )}`;

if (s.includes('فحص تيليغرام</Btn>')) {
  s = s.replace(systemOld, systemNew);
}

s = s.replace(/<\/?motion\b/g, (t) => t.replace('motion', 'div'));

s = s.replace(
  'className="admin-dashboard page-shell"',
  'className="admin-dashboard admin-dashboard--app page-shell"',
);

fs.writeFileSync(p, s);
console.log('patched ok');
