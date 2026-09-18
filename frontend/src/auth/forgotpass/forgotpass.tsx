import { useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import bgImage from "../../assets/gym-banner1.png";
import "./forgotpass.css";

/* ------------------------------------------------------------------ */
/*  Settings — yahan se sab kuch change kar sakte ho                   */
/* ------------------------------------------------------------------ */
const API_BASE = "http://localhost:5000/api/auth"; // apna backend URL
const USE_MOCK = true; // true = backend ke bagair UI test karo, backend ready ho to false karo
const LOGIN_ROUTE = "/login"; // password reset ke baad yahan redirect hoga
const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;
const REDIRECT_DELAY_MS = 1200;
const MIN_PASSWORD_LENGTH = 8;

/* ------------------------------------------------------------------ */
/*  API calls                                                          */
/* ------------------------------------------------------------------ */
async function post(path: string, body: Record<string, string>): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Something went wrong. Please try again.");
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const authApi = {
  async sendOtp(email: string): Promise<void> {
    if (USE_MOCK) return wait(800);
    return post("/forgot-password", { email });
  },
  async verifyOtp(email: string, otp: string): Promise<void> {
    if (USE_MOCK) return wait(700);
    return post("/verify-otp", { email, otp });
  },
  async resetPassword(email: string, otp: string, password: string): Promise<void> {
    if (USE_MOCK) return wait(900);
    return post("/reset-password", { email, otp, password });
  },
};

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatTime = (total: number) => {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG — koi extra package nahi chahiye)                */
/* ------------------------------------------------------------------ */
const Icon = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const MailIcon = () => (
  <Icon>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);
const SendIcon = () => (
  <Icon>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);
const ArrowLeftIcon = () => (
  <Icon size={16}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
);
const LockIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const EyeOffIcon = () => (
  <Icon>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </Icon>
);
const ShieldCheckIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const RefreshIcon = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Icon>
);
const LockResetIcon = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
    <rect x="9.25" y="11" width="5.5" height="4.5" rx="1" />
    <path d="M10.5 11V9.75a1.5 1.5 0 0 1 3 0V11" />
  </svg>
);

const Logo = () => (
  <div className="fp-logo" aria-label="FitZone Gym Management System">
    <svg className="fp-logo-mark" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="1" y="11" width="6" height="18" rx="2" />
      <rect x="9" y="4" width="8" height="32" rx="2" />
      <rect x="17" y="17" width="30" height="6" />
      <rect x="47" y="4" width="8" height="32" rx="2" />
      <rect x="57" y="11" width="6" height="18" rx="2" />
    </svg>
    <div className="fp-logo-text">
      <span className="fp-logo-name">
        FIT<span>ZONE</span>
      </span>
      <span className="fp-logo-sub">GYM MANAGEMENT SYSTEM</span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
type Step = "email" | "otp" | "password";

function ForgotPass() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [seconds, setSeconds] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const redirectTimer = useRef<number | undefined>(undefined);

  /* Resend countdown */
  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, seconds]);

  /* OTP step khulte hi pehla box focus */
  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  /* Unmount par redirect timer saaf */
  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const message = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong. Please try again.";

  /* ---------------- Step 1: email ---------------- */
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();

    if (!EMAIL_REGEX.test(value)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.sendOtp(value);
      setEmail(value);
      setOtp(Array(OTP_LENGTH).fill(""));
      setSeconds(RESEND_SECONDS);
      setStep("otp");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Step 2: OTP ---------------- */
  const fillOtp = (start: number, digits: string) => {
    const next = [...otp];
    digits.split("").forEach((d, i) => {
      if (start + i < OTP_LENGTH) next[start + i] = d;
    });
    setOtp(next);
    otpRefs.current[Math.min(start + digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleOtpChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setError("");

    if (!digits) {
      const next = [...otp];
      next[index] = "";
      setOtp(next);
      return;
    }
    fillOtp(index, digits);
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      e.preventDefault();
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    setError("");
    fillOtp(0, digits);
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    const code = otp.join("");

    if (code.length < OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.verifyOtp(email, code);
      setStep("password");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (seconds > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      await authApi.sendOtp(email);
      setOtp(Array(OTP_LENGTH).fill(""));
      setSeconds(RESEND_SECONDS);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Step 3: new password ---------------- */
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(email, otp.join(""), password);
      setSuccess("Password reset successfully. Redirecting to login…");
      redirectTimer.current = window.setTimeout(
        () => navigate(LOGIN_ROUTE, { replace: true }),
        REDIRECT_DELAY_MS
      );
    } catch (err) {
      setError(message(err));
      setLoading(false);
    }
  };

  /* ---------------- Navigation ---------------- */
  const backToLogin = () => navigate(LOGIN_ROUTE);

  const backToEmail = () => {
    setError("");
    setOtp(Array(OTP_LENGTH).fill(""));
    setStep("email");
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="fp-page" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="fp-overlay" />

      <main className="fp-card">
        <Logo />

        {/* ---------- STEP 1 ---------- */}
        {step === "email" && (
          <form key="email" className="fp-step" onSubmit={handleSendOtp} noValidate>
            <div className="fp-icon-circle">
              <LockResetIcon />
            </div>
            <h1 className="fp-title">
              Forgot <span>Password?</span>
            </h1>
            <p className="fp-subtitle">
              Enter your email address and we'll send you a verification code to reset your
              password.
            </p>

            <label className="fp-field">
              <MailIcon />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Email address"
                autoComplete="email"
                aria-label="Email address"
                autoFocus
              />
            </label>

            {error && (
              <p className="fp-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="fp-btn" disabled={loading}>
              {loading ? <span className="fp-spinner" /> : <SendIcon />}
              {loading ? "Sending…" : "Send OTP"}
            </button>

            <button type="button" className="fp-back" onClick={backToLogin}>
              <ArrowLeftIcon /> Back to Login
            </button>
          </form>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === "otp" && (
          <form key="otp" className="fp-step" onSubmit={handleVerify} noValidate>
            <div className="fp-icon-plain">
              <ShieldCheckIcon size={52} />
            </div>
            <h1 className="fp-title">
              Verify <span>OTP</span>
            </h1>
            <p className="fp-subtitle">
              We've sent a {OTP_LENGTH}-digit code to your email address. Please enter it below.
            </p>

            <div className="fp-otp" role="group" aria-label="One-time password">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  className={digit ? "filled" : ""}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                />
              ))}
            </div>

            <div className="fp-resend">
              {seconds > 0 ? (
                <span>
                  <RefreshIcon /> Resend OTP in <strong>{formatTime(seconds)}</strong>
                </span>
              ) : (
                <button type="button" onClick={handleResend} disabled={loading}>
                  <RefreshIcon /> Resend OTP
                </button>
              )}
            </div>

            {error && (
              <p className="fp-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="fp-btn" disabled={loading}>
              {loading ? <span className="fp-spinner" /> : <ShieldCheckIcon />}
              {loading ? "Verifying…" : "Verify"}
            </button>

            <button type="button" className="fp-back" onClick={backToEmail}>
              <ArrowLeftIcon /> Back to Email
            </button>
          </form>
        )}

        {/* ---------- STEP 3 ---------- */}
        {step === "password" && (
          <form key="password" className="fp-step" onSubmit={handleReset} noValidate>
            <div className="fp-icon-plain">
              <LockIcon size={52} />
            </div>
            <h1 className="fp-title">
              Set New <span>Password</span>
            </h1>
            <p className="fp-subtitle">
              Your OTP has been verified. Please set your new password.
            </p>

            <label className="fp-field">
              <LockIcon />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="New password"
                autoComplete="new-password"
                aria-label="New password"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                className="fp-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </label>

            <label className="fp-field">
              <LockIcon />
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError("");
                }}
                placeholder="Confirm new password"
                autoComplete="new-password"
                aria-label="Confirm new password"
                disabled={loading}
              />
              <button
                type="button"
                className="fp-eye"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </label>

            {error && (
              <p className="fp-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="fp-success" role="status">
                {success}
              </p>
            )}

            <button type="submit" className="fp-btn" disabled={loading}>
              {loading ? <span className="fp-spinner" /> : <RefreshIcon size={20} />}
              {success ? "Password reset" : loading ? "Resetting…" : "Reset Password"}
            </button>

            <button type="button" className="fp-back" onClick={backToLogin} disabled={loading}>
              <ArrowLeftIcon /> Back to Login
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default ForgotPass;