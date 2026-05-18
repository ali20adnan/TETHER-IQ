import fs from 'fs';
import { fileURLToPath } from 'url';

const p = fileURLToPath(new URL('../src/pages/AdminDashboard.jsx', import.meta.url));
let s = fs.readFileSync(p, 'utf8');

const gate = `      <div className="admin-dashboard__inner">
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
          <div className="admin-app">`;

const re2 = /(\s*<div className="admin-dashboard__inner">)\s*<header className="admin-dashboard__header">[\s\S]*?\) : \(\s*<div className="admin-app">/;

if (!re2.test(s)) {
  console.error('pattern not found');
  process.exit(1);
}
s = s.replace(re2, gate);
s = s.replace(/<\/?motion\b/g, (t) => t.replace('motion', 'div'));

fs.writeFileSync(p, s);
console.log('ok');
