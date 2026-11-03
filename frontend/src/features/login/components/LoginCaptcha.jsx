import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);

  const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.turnstile));
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(script);
  });
}

export default function LoginCaptcha({
  provider,
  siteKey,
  question,
  answer,
  onAnswerChange,
  onTurnstileToken,
  onRefresh,
  disabled,
}) {
  const widgetRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [turnstileError, setTurnstileError] = useState('');

  const resetTurnstile = useCallback(() => {
    if (widgetIdRef.current != null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    onTurnstileToken?.('');
  }, [onTurnstileToken]);

  useEffect(() => {
    if (provider !== 'turnstile' || !siteKey) return undefined;

    let cancelled = false;

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !widgetRef.current) return;
        if (widgetIdRef.current != null) {
          turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            setTurnstileError('');
            onTurnstileToken?.(token);
          },
          'expired-callback': () => onTurnstileToken?.(''),
          'error-callback': () => {
            setTurnstileError('CAPTCHA failed to load. Refresh and try again.');
            onTurnstileToken?.('');
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTurnstileError('CAPTCHA failed to load. Refresh and try again.');
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [provider, siteKey, onTurnstileToken]);

  useEffect(() => {
    if (provider === 'turnstile') resetTurnstile();
  }, [provider, siteKey, resetTurnstile]);

  return (
    <div className="rounded-[12px] border border-amber-200 bg-amber-50/80 px-3.5 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Security verification required
      </div>
      <p className="mb-3 text-xs leading-relaxed text-amber-800/90">
        Too many failed sign-in attempts. Complete the verification below to continue.
      </p>

      {provider === 'turnstile' ? (
        <div>
          <div ref={widgetRef} className="min-h-[65px]" />
          {turnstileError ? (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {turnstileError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="captcha-answer" className="block text-xs font-semibold text-amber-900">
            {question || 'Loading verification…'}
          </label>
          <div className="flex gap-2">
            <input
              id="captcha-answer"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={answer}
              onChange={(e) => onAnswerChange?.(e.target.value)}
              disabled={disabled || !question}
              placeholder="Enter answer"
              className="h-11 flex-1 rounded-[0.875rem] border border-amber-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-nimbus-blue focus:shadow-[0_0_0_0.25rem_rgba(37,99,235,0.12)] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => {
                onRefresh?.();
                onAnswerChange?.('');
              }}
              disabled={disabled}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[0.875rem] border border-amber-200 bg-white text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
              aria-label="Refresh verification"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
