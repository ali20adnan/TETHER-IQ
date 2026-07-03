import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminRequest, crmReportUrl, downloadBlob, exportCrmCsv } from '../lib/adminApi.js';

export default function AdminCrmPage() {
  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vTotal, setVTotal] = useState(0);
  const [oTotal, setOTotal] = useState(0);
  const [vOff, setVOff] = useState(0);
  const [oOff, setOOff] = useState(0);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 30;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const s = await adminRequest('/api/admin/crm/summary');
      setSummary(s);
      const v = await adminRequest(`/api/admin/crm/visits?offset=0&limit=${limit}`);
      setVisits(v.items || []);
      setVTotal(v.total || 0);
      setVOff(0);
      const o = await adminRequest(`/api/admin/crm/orders?offset=0&limit=${limit}`);
      setOrders(o.items || []);
      setOTotal(o.total || 0);
      setOOff(0);
    } catch (e) {
      setErr(String(e?.message || e));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const fetchVisitPage = async (nextOff) => {
    setLoading(true);
    try {
      const v = await adminRequest(`/api/admin/crm/visits?offset=${nextOff}&limit=${limit}`);
      setVisits(v.items || []);
      setVOff(nextOff);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderPage = async (nextOff) => {
    setLoading(true);
    try {
      const o = await adminRequest(`/api/admin/crm/orders?offset=${nextOff}&limit=${limit}`);
      setOrders(o.items || []);
      setOOff(nextOff);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async (kind) => {
    try {
      const blob = await exportCrmCsv(kind);
      downloadBlob(blob, kind === 'visits' ? 'visits.csv' : 'orders.csv');
    } catch (e) {
      setErr(String(e?.message || e));
    }
  };

  const openPrintReport = () => {
    window.open(crmReportUrl(), '_blank', 'noopener,noreferrer');
  };

  const exportPdf = () => {
    const w = window.open(crmReportUrl(true), '_blank', 'noopener,noreferrer');
    if (!w) {
      setErr('تعذّر فتح نافذة التصدير. اسمح بالنوافذ المنبثقة للموقع ثم أعد المحاولة.');
    }
  };

  return (
    <div className="page-shell" style={{ minHeight: '100vh', padding: '1.5rem', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#00E5FF' }}>CRM — TETHER IQ</h1>
          <Link to="/" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>← الرئيسية / Home</Link>
        </div>

        {err && (
          <div style={{ color: '#fca5a5', marginBottom: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{err}</div>
        )}

        {loading && !summary && <p className="text-muted">جاري التحميل…</p>}

        {summary && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                ['زيارات اليوم', summary.visits?.visitsToday],
                ['زيارات 7 أيام', summary.visits?.visitsWeek],
                ['زوّار مميّز (7d)', summary.visits?.uniqueVisitorsWeek],
                ['طلبات اليوم', summary.orders?.ordersToday],
                ['طلبات 7 أيام', summary.orders?.ordersWeek],
                ['USDT (7 أيام)', summary.orders?.volumeWeek],
              ].map(([k, v]) => (
                <div key={k} className="glass-panel" style={{ padding: '1rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 6 }}>{k}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00E5FF' }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => exportCsv('visits')} disabled={loading}>تصدير CSV زيارات</button>
              <button type="button" className="btn btn-primary" onClick={() => exportCsv('orders')} disabled={loading}>تصدير CSV طلبات</button>
              <button type="button" className="btn btn-outline" onClick={exportPdf} disabled={loading} title="يفتح التقرير ثم حوار الطباعة — اختر «حفظ كـ PDF»">
                تصدير PDF
              </button>
              <button type="button" className="btn btn-outline" onClick={openPrintReport} disabled={loading} title="فتح التقرير في تبويب جديد للمعاينة">
                معاينة HTML
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
              PDF: بعد الضغط يفتح التقرير ثم نافذة الطباعة — اختر الطابعة «Save as PDF» / «Microsoft Print to PDF» أو ما يعادلها.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong>الزيارات</strong>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>إجمالي {vTotal}</span>
                </div>
                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '0.35rem' }}>وقت</th>
                      <th style={{ padding: '0.35rem' }}>مسار</th>
                      <th style={{ padding: '0.35rem' }}>موقع</th>
                      <th style={{ padding: '0.35rem' }}>جهاز</th>
                      <th style={{ padding: '0.35rem' }}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '0.35rem', whiteSpace: 'nowrap' }}>{v.at?.slice(5, 16)}</td>
                        <td style={{ padding: '0.35rem' }}>{v.path}</td>
                        <td style={{ padding: '0.35rem', fontSize: '0.72rem' }}>{v.country ? (v.city ? `${v.country}, ${v.city}` : v.country) : '—'}</td>
                        <td style={{ padding: '0.35rem', fontSize: '0.72rem', maxWidth: 140 }} title={v.ua}>{v.deviceLabel || v.device}</td>
                        <td style={{ padding: '0.35rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>{v.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" className="btn btn-primary" disabled={loading || vOff + limit >= vTotal} onClick={() => fetchVisitPage(vOff + limit)}>الأقدم ←</button>
                  <button type="button" className="btn btn-primary" disabled={loading || vOff <= 0} onClick={() => fetchVisitPage(Math.max(0, vOff - limit))}>→ الأحدث</button>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong>الطلبات</strong>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>إجمالي {oTotal}</span>
                </div>
                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '0.35rem' }}>وقت</th>
                      <th style={{ padding: '0.35rem' }}>طلب</th>
                      <th style={{ padding: '0.35rem' }}>حالة</th>
                      <th style={{ padding: '0.35rem' }}>اسم</th>
                      <th style={{ padding: '0.35rem' }}>USDT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '0.35rem', whiteSpace: 'nowrap' }}>{o.at?.slice(5, 16)}</td>
                        <td style={{ padding: '0.35rem', fontSize: '0.72rem' }}>{o.orderId}</td>
                        <td style={{ padding: '0.35rem', fontSize: '0.72rem' }}>{o.status === 'completed' ? 'تم الإكمال' : o.status === 'archived' ? 'معلق' : o.status === 'cancelled' ? 'ملغى' : o.status === 'refunded' ? 'استرجاع' : 'قيد المعالجة'}</td>
                        <td style={{ padding: '0.35rem' }}>{o.name}</td>
                        <td style={{ padding: '0.35rem' }}>{o.usdtAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" className="btn btn-primary" disabled={loading || oOff + limit >= oTotal} onClick={() => fetchOrderPage(oOff + limit)}>الأقدم ←</button>
                  <button type="button" className="btn btn-primary" disabled={loading || oOff <= 0} onClick={() => fetchOrderPage(Math.max(0, oOff - limit))}>→ الأحدث</button>
                </div>
              </div>
            </div>

            {summary.marketing && (
              <p className="text-muted text-sm mt-4">
                أرقام العرض في الواجهة: عملاء {summary.marketing.customers} · عمليات {summary.marketing.transactions}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}