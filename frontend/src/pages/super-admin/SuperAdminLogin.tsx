import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuMail,
  LuLock,
  LuEye,
  LuEyeOff,
  LuKeyRound,
  LuShieldCheck,
  LuCircleAlert,
  LuCircleCheck,
  LuArrowLeft,
  LuLogIn,
} from "react-icons/lu";
import { API_URL } from "../../../config";
import "./SuperAdminLogin.css";

type View = "login" | "forgot" | "otp" | "reset";

// Backend ke routes yahan se badal sakte ho
const ENDPOINTS = {
  login: "/super-admin/login",
  forgot: "/super-admin/forgot-password",
  verifyOtp: "/super-admin/verify-otp",
  reset: "/super-admin/reset-password",
};

async function postJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function SuperAdminLogin() {
  const navigate = useNavigate();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const goTo = (v: View) => {
    setView(v);
    setError("");
  };

  /* ---------- LOGIN ---------- */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Email aur password dono likho");
      return;
    }

    setLoading(true);
    try {
      const { ok, json } = await postJson(ENDPOINTS.login, {
        email: email.trim(),
        password,
      });

      if (!ok) {
        setError(json?.message ?? "Login fail ho gaya.");
        return;
      }

      localStorage.setItem("sa_token", json.token);
      localStorage.setItem("sa_user", JSON.stringify(json.user));
      navigate("/super-admin/dashboard");
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- FORGOT (email bhejo) ---------- */
  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!resetEmail.trim()) {
      setError("Apni email likho");
      return;
    }

    setLoading(true);
    try {
      const { ok, json } = await postJson(ENDPOINTS.forgot, {
        email: resetEmail.trim(),
      });

      if (!ok) {
        setError(json?.message ?? "Ye email register nahi hai.");
        return;
      }

      setOtp("");
      setView("otp");
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- OTP verify ---------- */
  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("OTP likho");
      return;
    }

    setLoading(true);
    try {
      const { ok, json } = await postJson(ENDPOINTS.verifyOtp, {
        email: resetEmail.trim(),
        otp: otp.trim(),
      });

      if (!ok) {
        setError(json?.message ?? "OTP galat ya expire ho gaya hai.");
        return;
      }

      setNewPass("");
      setConfirmPass("");
      setView("reset");
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- RESET password ---------- */
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPass.length < 6) {
      setError("Password kam az kam 6 characters ka hona chahiye");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Dono passwords match nahi kar rahe");
      return;
    }

    setLoading(true);
    try {
      const { ok, json } = await postJson(ENDPOINTS.reset, {
        email: resetEmail.trim(),
        otp: otp.trim(),
        password: newPass,
        password_confirmation: confirmPass,
      });

      if (!ok) {
        setError(json?.message ?? "Password reset nahi ho saka.");
        return;
      }

      setEmail(resetEmail.trim());
      setPassword("");
      setOtp("");
      setNewPass("");
      setConfirmPass("");
      setSuccess("Password reset ho gaya. Ab naye password se login karo.");
      setView("login");
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-card">
        {/* Brand */}
        <div className="sa-brand">
          <span className="sa-logo">F</span>
          <div>
            <div className="sa-brand-name">Fusix Admin</div>
            <div className="sa-brand-sub">Super Admin Panel</div>
          </div>
        </div>

        {/* LOGIN */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="sa-form">
            <div className="sa-icon sa-icon-amber">
              <LuShieldCheck size={24} />
            </div>
            <h1 className="sa-title">Welcome Back</h1>
            <p className="sa-sub">Dashboard kholne ke liye login karo</p>

            {success && (
              <div className="sa-success">
                <LuCircleCheck size={16} />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="sa-error">
                <LuCircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <label className="sa-label">Email</label>
            <div className="sa-field">
              <LuMail size={16} />
              <input
                className="sa-input"
                type="email"
                placeholder="admin@fusixtech.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <label className="sa-label">Password</label>
            <div className="sa-field">
              <LuLock size={16} />
              <input
                className="sa-input"
                type={showPass ? "text" : "password"}
                placeholder="Password likho"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="sa-eye"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <LuEyeOff size={17} /> : <LuEye size={17} />}
              </button>
            </div>

            <div className="sa-row">
              <button
                type="button"
                className="sa-link"
                onClick={() => {
                  setSuccess("");
                  setResetEmail(email);
                  goTo("forgot");
                }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="sa-btn" disabled={loading}>
              <LuLogIn size={17} />
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {/* FORGOT */}
        {view === "forgot" && (
          <form onSubmit={handleForgot} className="sa-form">
            <div className="sa-icon sa-icon-purple">
              <LuKeyRound size={24} />
            </div>
            <h1 className="sa-title">Forgot Password</h1>
            <p className="sa-sub">
              Apni email likho, hum aapko OTP bhejenge password reset karne ke liye
            </p>

            {error && (
              <div className="sa-error">
                <LuCircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <label className="sa-label">Email</label>
            <div className="sa-field">
              <LuMail size={16} />
              <input
                className="sa-input"
                type="email"
                placeholder="admin@fusixtech.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>

            <button type="submit" className="sa-btn" disabled={loading}>
              {loading ? "Bhej rahe hain..." : "Send OTP"}
            </button>
            <button
              type="button"
              className="sa-btn-ghost"
              onClick={() => goTo("login")}
            >
              <LuArrowLeft size={16} />
              Back to Login
            </button>
          </form>
        )}

        {/* OTP */}
        {view === "otp" && (
          <form onSubmit={handleOtp} className="sa-form">
            <div className="sa-icon sa-icon-purple">
              <LuKeyRound size={24} />
            </div>
            <h1 className="sa-title">OTP Likho</h1>
            <p className="sa-sub">
              <strong className="sa-email">{resetEmail}</strong> par bheja gaya OTP likho
            </p>

            {error && (
              <div className="sa-error">
                <LuCircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <label className="sa-label">OTP</label>
            <div className="sa-field">
              <LuKeyRound size={16} />
              <input
                className="sa-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <button type="submit" className="sa-btn" disabled={loading}>
              {loading ? "Check ho raha hai..." : "Verify OTP"}
            </button>
            <button
              type="button"
              className="sa-btn-ghost"
              onClick={() => goTo("forgot")}
            >
              <LuArrowLeft size={16} />
              Back
            </button>
          </form>
        )}

        {/* RESET */}
        {view === "reset" && (
          <form onSubmit={handleReset} className="sa-form">
            <div className="sa-icon sa-icon-green">
              <LuLock size={24} />
            </div>
            <h1 className="sa-title">Naya Password</h1>
            <p className="sa-sub">
              <strong className="sa-email">{resetEmail}</strong> ke liye naya password set karo
            </p>

            {error && (
              <div className="sa-error">
                <LuCircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <label className="sa-label">New Password</label>
            <div className="sa-field">
              <LuLock size={16} />
              <input
                className="sa-input"
                type="password"
                placeholder="Kam az kam 6 characters"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <label className="sa-label">Confirm Password</label>
            <div className="sa-field">
              <LuLock size={16} />
              <input
                className="sa-input"
                type="password"
                placeholder="Dobara likho"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="sa-btn" disabled={loading}>
              {loading ? "Save ho raha hai..." : "Reset Password"}
            </button>
            <button
              type="button"
              className="sa-btn-ghost"
              onClick={() => goTo("login")}
            >
              Cancel
            </button>
          </form>
        )}

        <div className="sa-footer">© Fusix Tech</div>
      </div>
    </div>
  );
}