import { useEffect, useLayoutEffect, useRef, useState } from "react";
import axios from "axios";
import {
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Pencil,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./frontdeskregister.css";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  baseSalary: string;
  password: string;
  confirmPassword: string;
}

interface FrontdeskUser {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  base_salary: number | string | null;
}

const EMPTY_FORM: FormData = {
  fullName: "",
  email: "",
  phone: "",
  baseSalary: "",
  password: "",
  confirmPassword: "",
};

const BOTTOM_GAP = 24;

// NEW: Phone -> only digits, max 11
const formatPhone = (value: string): string => value.replace(/\D/g, "").slice(0, 11);

// NEW: Phone must be exactly 11 digits and start with 03
const isValidPhone = (value: string): boolean => /^03\d{9}$/.test(value);

const baseWrapperStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "24px 0 40px",
  boxSizing: "border-box",
  overflowX: "hidden",
  overflowY: "auto",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  margin: "0 auto",
  flexShrink: 0,
};

const showSalary = (v: number | string | null) =>
  v != null && v !== "" ? `PKR ${Number(v).toLocaleString("en-US")}` : "—";

const authHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/* ---------------- Edit popup styles (inline) ---------------- */
const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#0f0f0f",
    border: "1px solid #262626",
    borderRadius: 16,
    padding: 22,
    color: "#fff",
    boxSizing: "border-box",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  close: {
    background: "transparent",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    display: "flex",
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 6px" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#050505",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "11px 12px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  hint: { fontSize: 12, color: "#888", marginTop: 4 },
  err: { color: "#ff5a6a", fontSize: 12, marginTop: 4, display: "block" },
  foot: { display: "flex", gap: 10, marginTop: 20 },
  cancel: {
    flex: 1,
    padding: "11px 0",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  save: {
    flex: 1,
    padding: "11px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(90deg,#ff2d4a,#d6002b)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  editBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "transparent",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};

/* ---------------- Edit popup ---------------- */
interface EditModalProps {
  user: FrontdeskUser;
  onClose: () => void;
  onSaved: () => void;
}

const EditModal = ({ user, onClose, onSaved }: EditModalProps) => {
  const [form, setForm] = useState({
    fullName: user.name ?? "",
    email: user.email ?? "",
    phone: formatPhone(user.phone ?? ""), // CHANGED: purana dash wala number bhi clean ho jayega
    baseSalary: user.base_salary != null ? String(Number(user.base_salary)) : "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;
    // CHANGED: phone par digits-only + max 11 lagao
    const value = name === "phone" ? formatPhone(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const er: Record<string, string> = {};
    if (!form.fullName.trim()) er.fullName = "Full name is required";
    if (!form.email.trim()) er.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = "Enter a valid email";
    // CHANGED: exactly 11 digits, starting with 03
    if (!form.phone.trim()) er.phone = "Phone number is required";
    else if (!isValidPhone(form.phone))
      er.phone = "Phone must be exactly 11 digits and start with 03";
    if (form.baseSalary.trim() !== "") {
      const s = Number(form.baseSalary);
      if (Number.isNaN(s) || s < 0) er.baseSalary = "Enter a valid salary amount";
    }
    if (form.password) {
      if (form.password.length < 6) er.password = "Password must be at least 6 characters";
      if (form.confirmPassword !== form.password) er.confirmPassword = "Passwords do not match";
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setServerError("");
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        base_salary: form.baseSalary.trim() === "" ? 0 : Number(form.baseSalary),
      };
      if (form.password) {
        body.password = form.password;
        body.password_confirmation = form.confirmPassword;
      }

      await axios.put(`${API_URL}/frontdesk/${user.id}`, body, { headers: authHeaders() });
      onSaved();
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setServerError("You are not allowed to do this. Please login as admin.");
      } else if (err.response?.status === 422) {
        const api = err.response.data.errors || {};
        const mapped: Record<string, string> = {};
        if (api.fullName) mapped.fullName = api.fullName[0];
        if (api.email) mapped.email = api.email[0];
        if (api.phone) mapped.phone = api.phone[0];
        if (api.base_salary) mapped.baseSalary = api.base_salary[0];
        if (api.password) mapped.password = api.password[0];
        setErrors(mapped);
      } else {
        setServerError(err.response?.data?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.backdrop} onMouseDown={onClose}>
      <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Edit Front Desk</h2>
          <button type="button" style={S.close} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <label style={S.label} htmlFor="e-fullName">Full Name</label>
          <input style={S.input} id="e-fullName" name="fullName" value={form.fullName} onChange={handle} />
          {errors.fullName && <span style={S.err}>{errors.fullName}</span>}

          <label style={S.label} htmlFor="e-email">Email Address</label>
          <input style={S.input} id="e-email" name="email" type="email" value={form.email} onChange={handle} />
          {errors.email && <span style={S.err}>{errors.email}</span>}

          <label style={S.label} htmlFor="e-phone">Phone Number</label>
          {/* CHANGED: digits only, max 11 */}
          <input
            style={S.input}
            id="e-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={form.phone}
            onChange={handle}
            placeholder="03XXXXXXXXX"
          />
          {errors.phone && <span style={S.err}>{errors.phone}</span>}

          <label style={S.label} htmlFor="e-salary">Monthly Salary (PKR)</label>
          <input
            style={S.input}
            id="e-salary"
            name="baseSalary"
            type="number"
            min="0"
            step="any"
            value={form.baseSalary}
            onChange={handle}
            placeholder="e.g. 25000"
          />
          {errors.baseSalary && <span style={S.err}>{errors.baseSalary}</span>}

          <label style={S.label} htmlFor="e-password">New Password (optional)</label>
          <input
            style={S.input}
            id="e-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handle}
            autoComplete="new-password"
            placeholder="Leave empty to keep current password"
          />
          {errors.password && <span style={S.err}>{errors.password}</span>}

          {form.password && (
            <>
              <label style={S.label} htmlFor="e-confirm">Confirm New Password</label>
              <input
                style={S.input}
                id="e-confirm"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handle}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span style={S.err}>{errors.confirmPassword}</span>}
            </>
          )}

          {serverError && <span style={S.err}>{serverError}</span>}

          <div style={S.foot}>
            <button type="button" style={S.cancel} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" style={S.save} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Page ---------------- */
const FrontdeskRegister = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [staff, setStaff] = useState<FrontdeskUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [editTarget, setEditTarget] = useState<FrontdeskUser | null>(null);

  useLayoutEffect(() => {
    const updateHeight = () => {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top + window.scrollY;
      setPageHeight(Math.max(320, window.innerHeight - top - BOTTOM_GAP));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const loadStaff = async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await axios.get(`${API_URL}/staff/frontdesk`, {
        headers: authHeaders(),
      });
      setStaff(res.data?.data ?? res.data ?? []);
    } catch (err) {
      console.error(err);
      setListError("Failed to load front desk staff.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;
    // CHANGED: phone par digits-only + max 11 lagao
    const value = name === "phone" ? formatPhone(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (serverError) setServerError("");
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email";
    }
    // CHANGED: exactly 11 digits, starting with 03
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = "Phone must be exactly 11 digits and start with 03";
    }
    if (formData.baseSalary.trim() !== "") {
      const sal = Number(formData.baseSalary);
      if (Number.isNaN(sal) || sal < 0) {
        newErrors.baseSalary = "Enter a valid salary amount";
      }
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError("");
    try {
      await axios.post(
        `${API_URL}/frontdesk/register`,
        {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          base_salary:
            formData.baseSalary.trim() === "" ? 0 : Number(formData.baseSalary),
          password: formData.password,
          password_confirmation: formData.confirmPassword,
        },
        { headers: authHeaders() }
      );

      alert("Front desk account created successfully");
      setFormData(EMPTY_FORM);
      setErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
      loadStaff();
    } catch (err: any) {
      console.error(err);

      if (err.response?.status === 401 || err.response?.status === 403) {
        setServerError("You are not allowed to do this. Please login as admin.");
      } else if (err.response?.status === 422) {
        const apiErrors = err.response.data.errors || {};
        const mapped: Partial<FormData> = {};
        if (apiErrors.fullName) mapped.fullName = apiErrors.fullName[0];
        if (apiErrors.email) mapped.email = apiErrors.email[0];
        if (apiErrors.phone) mapped.phone = apiErrors.phone[0];
        if (apiErrors.base_salary) mapped.baseSalary = apiErrors.base_salary[0];
        if (apiErrors.password) mapped.password = apiErrors.password[0];
        setErrors(mapped);
      } else {
        setServerError(
          err.response?.data?.message || "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={pageRef}
      className="fd-scroll-page"
      style={{
        ...baseWrapperStyle,
        ...(pageHeight ? { height: pageHeight } : {}),
      }}
    >
      {/* ---------------- Register form ---------------- */}
      <div className="frontdesk-register-card" style={cardStyle}>
        <div className="frontdesk-register-header">
          <div className="frontdesk-register-icon">
            <UserPlus size={26} strokeWidth={2} />
          </div>
          <h1 className="frontdesk-register-title">Front Desk Registration</h1>
          <p className="frontdesk-register-subtitle">
            Fill in the details to create a new front desk account.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="frontdesk-form-group">
            <label htmlFor="fullName">
              Full Name <span className="required">*</span>
            </label>
            <div className={`frontdesk-input-box ${errors.fullName ? "error" : ""}`}>
              <User size={18} className="input-icon" />
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Enter full name"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
              />
            </div>
            {errors.fullName && <span className="error-text">{errors.fullName}</span>}
          </div>

          <div className="frontdesk-form-group">
            <label htmlFor="email">
              Email Address <span className="required">*</span>
            </label>
            <div className={`frontdesk-input-box ${errors.email ? "error" : ""}`}>
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="frontdesk-form-group">
            <label htmlFor="phone">
              Phone Number <span className="required">*</span>
            </label>
            <div className={`frontdesk-input-box ${errors.phone ? "error" : ""}`}>
              <Phone size={18} className="input-icon" />
              {/* CHANGED: digits only, max 11 */}
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                id="phone"
                name="phone"
                placeholder="03XXXXXXXXX"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="frontdesk-form-group">
            <label htmlFor="baseSalary">Monthly Salary (PKR)</label>
            <div className={`frontdesk-input-box ${errors.baseSalary ? "error" : ""}`}>
              <Wallet size={18} className="input-icon" />
              <input
                type="number"
                id="baseSalary"
                name="baseSalary"
                min="0"
                step="any"
                placeholder="e.g. 25000"
                value={formData.baseSalary}
                onChange={handleChange}
              />
            </div>
            {errors.baseSalary && <span className="error-text">{errors.baseSalary}</span>}
          </div>

          <div className="frontdesk-form-group">
            <label htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <div className={`frontdesk-input-box ${errors.password ? "error" : ""}`}>
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <div className="frontdesk-form-group">
            <label htmlFor="confirmPassword">
              Confirm Password <span className="required">*</span>
            </label>
            <div className={`frontdesk-input-box ${errors.confirmPassword ? "error" : ""}`}>
              <Lock size={18} className="input-icon" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          {serverError && <span className="error-text">{serverError}</span>}

          <button type="submit" className="frontdesk-register-btn" disabled={loading}>
            <UserPlus size={18} />
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
      </div>

      {/* ---------------- Front desk list ---------------- */}
      <div className="fd-list-section">
        <div className="fd-list-head">
          <h2>Front Desk Staff</h2>
          <span>{staff.length} total</span>
        </div>

        {listError && <div className="fd-list-msg fd-list-msg--error">{listError}</div>}

        {listLoading ? (
          <div className="fd-list-msg">Loading front desk staff...</div>
        ) : staff.length === 0 ? (
          <div className="fd-list-msg">No front desk staff yet.</div>
        ) : (
          <div className="fd-grid">
            {staff.map((u) => (
              <article key={u.id} className="fd-card">
                <div className="fd-card__id">
                  <h3>{u.name || "—"}</h3>
                  <p>Front Desk</p>
                </div>

                <ul className="fd-card__meta">
                  <li>
                    <Phone size={15} />
                    <span>{u.phone || "—"}</span>
                  </li>
                  <li>
                    <Mail size={15} />
                    <span className="fd-truncate">{u.email || "—"}</span>
                  </li>
                  <li>
                    <Wallet size={15} />
                    <span className="fd-salary">Salary: {showSalary(u.base_salary)}</span>
                  </li>
                </ul>

                <button type="button" style={S.editBtn} onClick={() => setEditTarget(u)}>
                  <Pencil size={14} />
                  Edit
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <EditModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadStaff();
          }}
        />
      )}
    </div>
  );
};

export default FrontdeskRegister;