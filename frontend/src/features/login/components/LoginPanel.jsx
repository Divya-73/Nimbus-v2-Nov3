import React from 'react';
import { Eye, EyeOff, Loader2, Lock, Shield, User } from 'lucide-react';
import companyLogo from '../../../images/companylogo.png';
import logo from '../../../images/logo.png';
import { useLoginForm } from '../hooks/useLoginForm';
import { IstClock } from './IstClock';
import LoginCaptcha from './LoginCaptcha';

export function LoginPanel() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    info,
    handleSubmit,
    captchaRequired,
    captchaStep,
    captchaProvider,
    turnstileSiteKey,
    captchaQuestion,
    captchaAnswer,
    setCaptchaAnswer,
    setTurnstileToken,
    refreshCaptcha,
  } = useLoginForm();

  const fieldClass =
    'h-[3.25rem] w-full rounded-[0.875rem] border border-[#D8E0EC] bg-white text-[0.9375rem] text-nimbus-ink outline-none transition duration-200 placeholder:text-slate-400 focus:border-nimbus-blue focus:shadow-[0_0_0_0.25rem_rgba(37,99,235,0.12)] disabled:opacity-60';

  return (
    <section className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden lg:w-[42%]">
      <div
        className="absolute inset-0 bg-[linear-gradient(165deg,#EEF3FA_0%,#F7F9FC_42%,#E8EEF8_100%)]"
        aria-hidden
      />
      <div className="nimbus-dot-texture pointer-events-none absolute inset-0 opacity-[0.55]" aria-hidden />
      <div
        className="pointer-events-none absolute top-[-8%] left-[-12%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[8%] left-[20%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.1),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-r from-transparent via-[rgba(7,26,53,0.04)] to-[rgba(7,26,53,0.12)] lg:block"
        aria-hidden
      />

      {/* Systrome company logo — exact original colors */}
      <div className="relative z-10 flex shrink-0 items-center px-7 pt-6 sm:px-10 xl:px-12">
        <img
          src={companyLogo}
          alt="Systrome"
          className="h-9 w-auto object-contain object-left xl:h-10"
          height={40}
          decoding="async"
        />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-7 py-6 sm:px-10 xl:px-12">
        <div className="w-full max-w-[27.5rem]">
          <div className="overflow-hidden rounded-[1.5rem] border border-[#D5DEEB]/80 bg-white/95 shadow-[0_1.75rem_4rem_rgba(15,23,42,0.12),0_2px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-sm">
            <div className="h-[3px] bg-[linear-gradient(90deg,#1D4ED8_0%,#2563EB_40%,#38BDF8_100%)]" aria-hidden />

            <div className="px-8 pt-8 pb-9 sm:px-10 sm:pt-9 sm:pb-10">
              <div className="mb-8 flex flex-col items-center text-center">
                <img
                  src={logo}
                  alt="Nimbus"
                  className="h-auto w-[9.75rem] object-contain"
                  width={156}
                  height={42}
                  decoding="async"
                />
                <p className="mt-3 text-[0.6875rem] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                  SD-WAN Cloud Console
                </p>
              </div>

              <header className="mb-7 text-center">
                <h1 className="text-[1.6875rem] leading-tight font-bold tracking-tight text-nimbus-ink sm:text-[1.75rem]">
                  Welcome to Nimbus
                </h1>
                <p className="mx-auto mt-2.5 max-w-[18.75rem] text-[0.875rem] leading-relaxed text-slate-500">
                  Sign in to manage your enterprise network infrastructure.
                </p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {error ? (
                  <div
                    role="alert"
                    className="rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                ) : null}

                {info ? (
                  <div
                    role="status"
                    className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
                  >
                    {info}
                  </div>
                ) : null}

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[0.8125rem] font-semibold text-slate-700">
                    Email
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute top-1/2 left-3.5 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-nimbus-blue"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={loading}
                      placeholder="nina.v@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${fieldClass} pr-4 pl-11`}
                    />
                  </div>
                </div>

                {!(captchaRequired && captchaStep === 'verify') ? (
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[0.8125rem] font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3.5 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-nimbus-blue"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required={!(captchaRequired && captchaStep === 'verify')}
                      disabled={loading}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${fieldClass} pr-12 pl-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-nimbus-blue"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" strokeWidth={2} />
                      ) : (
                        <Eye className="h-5 w-5" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
                ) : null}

                {captchaRequired && captchaStep === 'verify' ? (
                  <LoginCaptcha
                    provider={captchaProvider}
                    siteKey={turnstileSiteKey}
                    question={captchaQuestion}
                    answer={captchaAnswer}
                    onAnswerChange={setCaptchaAnswer}
                    onTurnstileToken={setTurnstileToken}
                    onRefresh={refreshCaptcha}
                    disabled={loading}
                  />
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.875rem] bg-[linear-gradient(180deg,#2563EB_0%,#1D4ED8_100%)] text-[0.9375rem] font-semibold text-white shadow-[0_0.75rem_1.875rem_rgba(37,99,235,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_1rem_2.25rem_rgba(37,99,235,0.42)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {captchaRequired && captchaStep === 'verify' ? 'Verifying…' : 'Signing in…'}
                    </>
                  ) : captchaRequired && captchaStep === 'verify' ? (
                    'Verify'
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[0.75rem] text-slate-400">
                <Shield className="h-3.5 w-3.5 text-nimbus-blue/70" strokeWidth={2} aria-hidden />
                <span>Secure TLS session · Enterprise access</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-7 py-4 text-[0.75rem] text-slate-600 sm:px-10 xl:px-12">
        <span className="font-semibold text-slate-700">Version 2.0</span>
        <IstClock />
        <span className="font-medium tracking-wide text-slate-700">
          All copyright are reserved to Systrome Networks @2026
        </span>
      </footer>
    </section>
  );
}
