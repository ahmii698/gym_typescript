import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Briefcase, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { API_URL } from "../../../config"; // adjust the path if Staff.tsx lives at a different depth
import "./staff.css";

type StaffMember = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  salary: number | string;
  status: "active" | "inactive";
  created_at: string;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  salary: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { name: "", phone: "", email: "", salary: "" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NEW: Phone -> only digits, max 11
const formatPhone = (value: string): string => value.replace(/\D/g, "").slice(0, 11);

// NEW: Phone must be exactly 11 digits and start with 03
const isValidPhone = (value: string): boolean => /^03\d{9}$/.test(value);

// Small fetch helper. API_URL already ends with /api (see .env), so only /staff is added here.
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/staff${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json", // makes Laravel return JSON validation errors
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Something went wrong.");
  return body as T;
}

const formatSalary = (value: number | string) =>
  `Rs ${Number(value || 0).toLocaleString("en-US")}`;

const Staff = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [notice, setNotice] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api<{ data: StaffMember[] }>("");
      setStaff(res.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Auto-hide the success notice.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Close dialogs with the Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!saving) setModalOpen(false);
      if (!deleting) setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, deleting]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
    );
  }, [staff, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError("");
    setModalOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({
      name: member.name,
      phone: formatPhone(member.phone), // CHANGED: purana dash/space wala number bhi clean ho jayega
      email: member.email || "",
      salary: String(Number(member.salary) || ""),
    });
    setErrors({});
    setSubmitError("");
    setModalOpen(true);
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    // CHANGED: exactly 11 digits, starting with 03
    if (!form.phone.trim()) next.phone = "Phone number is required.";
    else if (!isValidPhone(form.phone.trim()))
      next.phone = "Phone must be exactly 11 digits and start with 03.";
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim()))
      next.email = "Enter a valid email address.";
    if (form.salary.trim() && (Number.isNaN(Number(form.salary)) || Number(form.salary) < 0))
      next.salary = "Salary must be 0 or more.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSubmitError("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      salary: form.salary.trim() === "" ? 0 : Number(form.salary),
    };

    try {
      if (editing) {
        const res = await api<{ data: StaffMember }>(`/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setStaff((prev) => prev.map((s) => (s.id === editing.id ? res.data : s)));
        setNotice("Staff member updated.");
      } else {
        const res = await api<{ data: StaffMember }>("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStaff((prev) => [res.data, ...prev]);
        setNotice("Staff member added.");
      }
      setModalOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save staff member.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/${deleteTarget.id}`, { method: "DELETE" });
      setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setNotice("Staff member deleted.");
      setDeleteTarget(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete staff member.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div>
          <h2 className="staff-title">Staff</h2>
          <p className="staff-subtitle">
            {staff.length} {staff.length === 1 ? "member" : "members"}
          </p>
        </div>

        <div className="staff-actions">
          <div className="staff-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search staff"
            />
          </div>
          <button type="button" className="staff-btn staff-btn-primary" onClick={openAdd}>
            <Plus size={16} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="staff-notice" role="status">
          {notice}
        </div>
      )}

      <div className="staff-card">
        {loading ? (
          <div className="staff-state">Loading staff...</div>
        ) : loadError ? (
          <div className="staff-state staff-state-error">
            <p>{loadError}</p>
            <button type="button" className="staff-btn staff-btn-ghost" onClick={loadStaff}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="staff-state">
            <Briefcase size={28} />
            <p>{search ? "No staff members match your search." : "No staff members yet."}</p>
            {!search && (
              <button type="button" className="staff-btn staff-btn-primary" onClick={openAdd}>
                <Plus size={16} />
                <span>Add your first staff member</span>
              </button>
            )}
          </div>
        ) : (
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th className="staff-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="staff-cell-name">{s.name}</td>
                    <td>{s.phone}</td>
                    <td>{s.email || <span className="staff-muted">-</span>}</td>
                    <td>
                      <span className="staff-badge">{s.role}</span>
                    </td>
                    <td>{formatSalary(s.salary)}</td>
                    <td>
                      <div className="staff-row-actions">
                        <button
                          type="button"
                          className="staff-icon-btn"
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.name}`}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="staff-icon-btn staff-icon-btn-danger"
                          onClick={() => setDeleteTarget(s)}
                          aria-label={`Delete ${s.name}`}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit dialog */}
      {modalOpen && (
        <div
          className="staff-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <form
            className="staff-modal"
            onSubmit={handleSubmit}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-modal-title"
          >
            <div className="staff-modal-head">
              <h3 id="staff-modal-title">{editing ? "Edit Staff" : "Add Staff"}</h3>
              <button
                type="button"
                className="staff-icon-btn"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body">
              <div className="staff-field">
                <label htmlFor="staff-name">
                  Name <span className="staff-required">*</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Full name"
                  autoFocus
                  className={errors.name ? "has-error" : ""}
                />
                {errors.name && <span className="staff-error">{errors.name}</span>}
              </div>

              <div className="staff-field">
                <label htmlFor="staff-phone">
                  Phone number <span className="staff-required">*</span>
                </label>
                {/* CHANGED: digits only, max 11 */}
                <input
                  id="staff-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={form.phone}
                  onChange={(e) => setField("phone", formatPhone(e.target.value))}
                  placeholder="03XXXXXXXXX"
                  className={errors.phone ? "has-error" : ""}
                />
                {errors.phone && <span className="staff-error">{errors.phone}</span>}
              </div>

              <div className="staff-field">
                <label htmlFor="staff-email">Email (optional)</label>
                <input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="name@example.com"
                  className={errors.email ? "has-error" : ""}
                />
                {errors.email && <span className="staff-error">{errors.email}</span>}
              </div>

              <div className="staff-field-row">
                <div className="staff-field">
                  <label htmlFor="staff-salary">Salary (optional)</label>
                  <input
                    id="staff-salary"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={form.salary}
                    onChange={(e) => setField("salary", e.target.value)}
                    placeholder="0"
                    className={errors.salary ? "has-error" : ""}
                  />
                  {errors.salary && <span className="staff-error">{errors.salary}</span>}
                </div>

                <div className="staff-field">
                  <label htmlFor="staff-role">Role</label>
                  <input id="staff-role" type="text" value="Staff" readOnly disabled />
                </div>
              </div>

              {submitError && <div className="staff-submit-error">{submitError}</div>}
            </div>

            <div className="staff-modal-foot">
              <button
                type="button"
                className="staff-btn staff-btn-ghost"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="staff-btn staff-btn-primary" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Add staff"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="staff-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div className="staff-modal staff-modal-sm" role="alertdialog" aria-modal="true">
            <div className="staff-modal-body">
              <h3>Delete staff member?</h3>
              <p className="staff-confirm-text">
                <strong>{deleteTarget.name}</strong> will be removed permanently. This cannot be
                undone.
              </p>
            </div>
            <div className="staff-modal-foot">
              <button
                type="button"
                className="staff-btn staff-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="staff-btn staff-btn-primary"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;