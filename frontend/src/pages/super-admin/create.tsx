import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBuilding2,
  LuUser,
  LuMail,
  LuPhone,
  LuLock,
  LuEye,
  LuEyeOff,
  LuUserPlus,
  LuCircleCheck,
  LuFlaskConical,
  LuCalendarDays,
} from "react-icons/lu";
import { API_URL } from "../../../config";
import Sidebar from "./sidebar";
import "./dashboard.css"; // styling for sas-layout / sas-content lives here
import "./create.css";

/* ------------------------------------------------------------------ */
/*  BACKEND SETTINGS                                                    */
/* ------------------------------------------------------------------ */
const COMPANIES_ENDPOINT = `${API_URL}/super-admin/companies`; // GET = list, POST = create

type Company = {
  id: number;
  name: string;
  admin_name: string;
  email: string;
  phone: string;
  created_at: string;
};

type FormState = {
  company_name: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
};

// trial_days can also be an error key
type FieldErrors = Partial<Record<keyof FormState | "trial_days", string>>;

const EMPTY_FORM: FormState = {
  company_name: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
};

const QUICK_DAYS = [1, 3, 7, 14, 30]; // chips for quick selection of trial days

// In-memory cache: coming back to this page shows the last list instantly
let companiesCache: Company[] | null = null;

const formatDate = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d || "-";
  return dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

export default function Create() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Free trial state
  const [trialOn, setTrialOn] = useState(false);
  const [trialDays, setTrialDays] = useState("");

  const [companies, setCompanies] = useState<Company[]>(() => companiesCache ?? []);
  const [loadingList, setLoadingList] = useState(() => !companiesCache);
  const [listError, setListError] = useState("");

  // Used to cancel an older request when a newer one starts
  const abortRef = useRef<AbortController | null>(null);

  // No token: send the user to the login page
  useEffect(() => {
    if (!token) navigate("/super-admin/login", { replace: true });
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/super-admin/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
    } catch {
      /* log out locally even if the server is unreachable */
    }
    companiesCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  /**
   * Cached list is shown right away and refreshed silently.
   * "Loading..." only appears on the very first visit (nothing cached yet),
   * and never after creating a company.
   */
  const loadCompanies = useCallback(async () => {
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (companiesCache === null) setLoadingList(true);
    setListError("");

    try {
      const res = await fetch(COMPANIES_ENDPOINT, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        companiesCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      const list: Company[] = Array.isArray(json?.data) ? json.data : [];
      companiesCache = list;
      setCompanies(list);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // a newer load took over
      setListError(e instanceof Error ? e.message : "Could not load companies");
      // keep showing the list we already have
    } finally {
      if (abortRef.current === ctrl) setLoadingList(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    loadCompanies();
    return () => {
      abortRef.current?.abort(); // cancel the request when leaving the page
    };
  }, [loadCompanies]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setSuccess("");
    setFormError("");
  };

  // Trial days change
  const handleTrialDays = (value: string) => {
    setTrialDays(value);
    setFieldErrors((prev) => ({ ...prev, trial_days: undefined }));
    setSuccess("");
    setFormError("");
  };

  // Trial on/off toggle
  const toggleTrial = () => {
    setTrialOn((v) => !v);
    setFieldErrors((prev) => ({ ...prev, trial_days: undefined }));
    setSuccess("");
    setFormError("");
  };

  /* ---------- client-side validation ---------- */
  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.company_name.trim()) errs.company_name = "Company name is required";
    if (!form.name.trim()) errs.name = "Admin name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Enter a valid email address";
    if (!form.phone.trim()) errs.phone = "Phone number is required";
    else if (!/^[0-9+\-\s]{7,20}$/.test(form.phone.trim())) errs.phone = "Enter a valid phone number";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (form.password_confirmation !== form.password)
      errs.password_confirmation = "Passwords do not match";

    // Trial days validation (only when the trial is ON)
    if (trialOn) {
      const n = Number(trialDays);
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        errs.trial_days = "Enter days between 1 and 365";
      }
    }
    return errs;
  };

  /* ---------- submit ---------- */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    setFormError("");
    setSuccess("");

    try {
      const res = await fetch(COMPANIES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          password_confirmation: form.password_confirmation,
          ...(trialOn ? { trial_days: Number(trialDays) } : {}),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        companiesCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }

      if (res.status === 422 && data?.errors) {
        // Laravel validation errors: { field: ["message", ...] }
        const serverErrs: FieldErrors = {};
        Object.keys(data.errors).forEach((key) => {
          serverErrs[key as keyof FieldErrors] = data.errors[key][0];
        });
        setFieldErrors(serverErrs);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      setSuccess(
        trialOn
          ? `"${form.company_name.trim()}" was created with a ${trialDays}-day free trial (Company ID: ${data?.company_id}).`
          : `"${form.company_name.trim()}" was created successfully (Company ID: ${data?.company_id}).`
      );
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setShowPassword(false);
      setTrialOn(false);
      setTrialDays("");

      // Refresh the list in the background (no waiting, no "Loading..." flash)
      loadCompanies();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="cr-page">
          <div className="cr-header">
            <h1 className="cr-title">Create Company</h1>
            <p className="cr-subtitle">
              Add a new company and create its admin account. Each company gets its own unique
              Company ID.
            </p>
          </div>

          <div className="cr-grid">
            {/* ---------------- FORM ---------------- */}
            <form className="cr-panel" onSubmit={handleSubmit} noValidate>
              <h2 className="cr-panel-title">Company &amp; Admin Details</h2>
              <p className="cr-panel-sub">All fields are required (free trial is optional)</p>

              {success && (
                <div className="cr-success">
                  <LuCircleCheck size={18} />
                  <span>{success}</span>
                </div>
              )}
              {formError && <div className="cr-alert">{formError}</div>}

              <div className="cr-field">
                <label className="cr-label" htmlFor="company_name">COMPANY NAME</label>
                <div className={`cr-input-wrap ${fieldErrors.company_name ? "cr-invalid" : ""}`}>
                  <LuBuilding2 size={16} />
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    placeholder="e.g. FitZone Gym"
                    value={form.company_name}
                    onChange={handleChange}
                  />
                </div>
                {fieldErrors.company_name && <span className="cr-error">{fieldErrors.company_name}</span>}
              </div>

              <div className="cr-row">
                <div className="cr-field">
                  <label className="cr-label" htmlFor="name">ADMIN NAME</label>
                  <div className={`cr-input-wrap ${fieldErrors.name ? "cr-invalid" : ""}`}>
                    <LuUser size={16} />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Full name"
                      value={form.name}
                      onChange={handleChange}
                    />
                  </div>
                  {fieldErrors.name && <span className="cr-error">{fieldErrors.name}</span>}
                </div>

                <div className="cr-field">
                  <label className="cr-label" htmlFor="phone">PHONE</label>
                  <div className={`cr-input-wrap ${fieldErrors.phone ? "cr-invalid" : ""}`}>
                    <LuPhone size={16} />
                    <input
                      id="phone"
                      name="phone"
                      type="text"
                      placeholder="03XX-XXXXXXX"
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                  {fieldErrors.phone && <span className="cr-error">{fieldErrors.phone}</span>}
                </div>
              </div>

              <div className="cr-field">
                <label className="cr-label" htmlFor="email">EMAIL</label>
                <div className={`cr-input-wrap ${fieldErrors.email ? "cr-invalid" : ""}`}>
                  <LuMail size={16} />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                {fieldErrors.email && <span className="cr-error">{fieldErrors.email}</span>}
              </div>

              <div className="cr-row">
                <div className="cr-field">
                  <label className="cr-label" htmlFor="password">PASSWORD</label>
                  <div className={`cr-input-wrap ${fieldErrors.password ? "cr-invalid" : ""}`}>
                    <LuLock size={16} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="cr-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && <span className="cr-error">{fieldErrors.password}</span>}
                </div>

                <div className="cr-field">
                  <label className="cr-label" htmlFor="password_confirmation">CONFIRM PASSWORD</label>
                  <div
                    className={`cr-input-wrap ${fieldErrors.password_confirmation ? "cr-invalid" : ""}`}
                  >
                    <LuLock size={16} />
                    <input
                      id="password_confirmation"
                      name="password_confirmation"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={form.password_confirmation}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                  </div>
                  {fieldErrors.password_confirmation && (
                    <span className="cr-error">{fieldErrors.password_confirmation}</span>
                  )}
                </div>
              </div>

              {/* ---------------- FREE TRIAL ---------------- */}
              <div className="cr-field">
                <button
                  type="button"
                  className={`cr-trial-toggle ${trialOn ? "cr-trial-on" : ""}`}
                  onClick={toggleTrial}
                >
                  <LuFlaskConical size={16} />
                  {trialOn ? "Free Trial: ON" : "Free Trial"}
                </button>

                {trialOn && (
                  <div className="cr-trial-box">
                    <label className="cr-label" htmlFor="trial_days">HOW MANY DAYS</label>
                    <div className={`cr-input-wrap ${fieldErrors.trial_days ? "cr-invalid" : ""}`}>
                      <LuCalendarDays size={16} />
                      <input
                        id="trial_days"
                        name="trial_days"
                        type="number"
                        min={1}
                        max={365}
                        placeholder="e.g. 7"
                        value={trialDays}
                        onChange={(e) => handleTrialDays(e.target.value)}
                      />
                    </div>
                    {fieldErrors.trial_days && <span className="cr-error">{fieldErrors.trial_days}</span>}

                    <div className="cr-trial-quick">
                      <span>Quick select:</span>
                      {QUICK_DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`cr-trial-chip ${Number(trialDays) === d ? "cr-trial-chip-active" : ""}`}
                          onClick={() => handleTrialDays(String(d))}
                        >
                          {d} days
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="cr-btn" disabled={submitting}>
                <LuUserPlus size={16} />
                {submitting
                  ? "Creating..."
                  : trialOn
                  ? "Create Trial Company & Admin"
                  : "Create Company & Admin"}
              </button>
            </form>

            {/* ---------------- COMPANIES LIST ---------------- */}
            <div className="cr-panel">
              <h2 className="cr-panel-title">Companies ({companies.length})</h2>
              <p className="cr-panel-sub">All companies created so far</p>

              {listError && (
                <div className="cr-alert">
                  {listError}
                  <button type="button" className="cr-retry" onClick={loadCompanies}>
                    Retry
                  </button>
                </div>
              )}

              <div className="cr-table-wrap">
                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Company</th>
                      <th>Admin</th>
                      <th>Phone</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList && companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="cr-empty">Loading...</td>
                      </tr>
                    ) : companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="cr-empty">No companies yet</td>
                      </tr>
                    ) : (
                      companies.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="cr-id">#{c.id}</span>
                          </td>
                          <td className="cr-strong">{c.name}</td>
                          <td>
                            <div className="cr-strong">{c.admin_name}</div>
                            <div className="cr-muted">{c.email}</div>
                          </td>
                          <td>{c.phone}</td>
                          <td>{formatDate(c.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}