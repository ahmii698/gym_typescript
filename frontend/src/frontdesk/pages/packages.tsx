import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../../config";
import "./packages.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type PackageType = "Normal" | "Premium" | "With Trainer";
type PackageStatus = "Active" | "Inactive";
type PackageIcon = "dumbbell" | "users" | "user" | "layers";

interface GymPackage {
  id: string;
  name: string;
  type: PackageType;
  price: number;
  durationDays: number;
  features: string[];
  status: PackageStatus;
  icon: PackageIcon;
}

// Shape of the data returned by the backend
interface ApiPackage {
  id: number;
  name: string;
  type: PackageType;
  price: string | number;
  duration_days: number;
  features: string[] | null;
  is_active: boolean | 0 | 1;
  icon: PackageIcon;
}

type ViewMode = "grid" | "list";

/* ------------------------------------------------------------------ */
/* API helpers (kept inside this file)                                 */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return localStorage.getItem("token"); // adjust the key to match your login flow
}

function mapApiToPackage(p: ApiPackage): GymPackage {
  return {
    id: String(p.id),
    name: p.name,
    type: p.type,
    price: Number(p.price),
    durationDays: p.duration_days,
    features: p.features ?? [],
    status: p.is_active ? "Active" : "Inactive",
    icon: p.icon ?? "dumbbell",
  };
}

function mapPackageToApi(data: Omit<GymPackage, "id">) {
  return {
    name: data.name,
    type: data.type,
    price: data.price,
    duration_days: data.durationDays,
    features: data.features,
    is_active: data.status === "Active",
    icon: data.icon,
  };
}

async function apiFetchPackages(): Promise<GymPackage[]> {
  const res = await fetch(`${API_URL}/packages`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Failed to load packages.");
  const data: ApiPackage[] = await res.json();
  return data.map(mapApiToPackage);
}

async function apiCreatePackage(data: Omit<GymPackage, "id">): Promise<GymPackage> {
  const res = await fetch(`${API_URL}/packages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(mapPackageToApi(data)),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to add package.");
  }
  const created: ApiPackage = await res.json();
  return mapApiToPackage(created);
}

async function apiUpdatePackage(id: string, data: Omit<GymPackage, "id">): Promise<GymPackage> {
  const res = await fetch(`${API_URL}/packages/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(mapPackageToApi(data)),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to update package.");
  }
  const updated: ApiPackage = await res.json();
  return mapApiToPackage(updated);
}

async function apiDeletePackage(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/packages/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Failed to delete package.");
}

/* Escapes a value for safe use inside a CSV cell */
function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

/* Escapes a value for safe use inside HTML (PDF report) */
function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Inline styles for the action buttons (no external CSS)              */
/* ------------------------------------------------------------------ */

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  marginBottom: 14,
  flexShrink: 0,
};

const baseActionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 18px",
  border: "none",
  borderRadius: 10,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "inherit",
  lineHeight: 1,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const refreshBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#3b82f6",
};

const excelBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#22c55e",
};

const pdfBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#ef4444",
};

/* ------------------------------------------------------------------ */
/* Inline icons                                                        */
/* ------------------------------------------------------------------ */

const Icon = {
  Box: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Search: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  ),
  Reset: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 0-15.5-6.3L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12a9 9 0 0 0 15.5 6.3L21 16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  File: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Grid: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  List: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  ),
  Check: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Edit: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" strokeLinejoin="round" />
    </svg>
  ),
  Trash: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Close: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  Dumbbell: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" strokeLinecap="round" />
    </svg>
  ),
  Users: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" strokeLinecap="round" />
      <path d="M16 6.2A3.2 3.2 0 0 1 16 14M17 19c0-2.4-.8-4-2-5" strokeLinecap="round" />
    </svg>
  ),
  User: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
    </svg>
  ),
  Layers: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3M4 18c0 1.7 3.6 3 8 3s8-1.3 8-3" strokeLinecap="round" />
    </svg>
  ),
};

const PACKAGE_ICONS: Record<PackageIcon, () => React.ReactElement> = {
  dumbbell: Icon.Dumbbell,
  users: Icon.Users,
  user: Icon.User,
  layers: Icon.Layers,
};

/* ------------------------------------------------------------------ */
/* Modal form                                                          */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  type: PackageType;
  price: string;
  durationDays: string;
  features: string;
  status: PackageStatus;
  icon: PackageIcon;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "Normal",
  price: "",
  durationDays: "",
  features: "",
  status: "Active",
  icon: "dumbbell",
};

interface PackageModalProps {
  open: boolean;
  editing: GymPackage | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Omit<GymPackage, "id">, id?: string) => void;
}

const PackageModal: React.FC<PackageModalProps> = ({
  open,
  editing,
  saving,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        price: String(editing.price),
        durationDays: String(editing.durationDays),
        features: editing.features.join("\n"),
        status: editing.status,
        icon: editing.icon,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Please enter a package name.";
    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price <= 0)
      next.price = "Price must be greater than 0.";
    const days = Number(form.durationDays);
    if (!form.durationDays.trim() || !Number.isInteger(days) || days <= 0)
      next.durationDays = "Enter the duration in whole days.";
    const feats = form.features.split("\n").map((f) => f.trim()).filter(Boolean);
    if (feats.length === 0) next.features = "Add at least one feature.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(
      {
        name: form.name.trim(),
        type: form.type,
        price: Number(form.price),
        durationDays: Number(form.durationDays),
        features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
        status: form.status,
        icon: form.icon,
      },
      editing?.id
    );
  };

  return (
    <div className="pkg-modal-backdrop" onMouseDown={onClose}>
      <div
        className="pkg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pkg-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="pkg-modal__head">
          <div>
            <h2 id="pkg-modal-title">{editing ? "Edit package" : "Add new package"}</h2>
            <p>Fill in the membership details and save.</p>
          </div>
          <button type="button" className="pkg-modal__close" onClick={onClose} aria-label="Close">
            <Icon.Close />
          </button>
        </header>

        <form className="pkg-form" onSubmit={handleSubmit} noValidate>
          <div className="pkg-field">
            <label htmlFor="pkg-name">Package name</label>
            <input
              id="pkg-name"
              type="text"
              placeholder="e.g. Monthly Basic"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoFocus
            />
            {errors.name && <span className="pkg-error">{errors.name}</span>}
          </div>

          <div className="pkg-field-row">
            <div className="pkg-field">
              <label htmlFor="pkg-price">Price (PKR)</label>
              <input
                id="pkg-price"
                type="number"
                min="0"
                placeholder="5000"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
              />
              {errors.price && <span className="pkg-error">{errors.price}</span>}
            </div>

            <div className="pkg-field">
              <label htmlFor="pkg-days">Duration (days)</label>
              <input
                id="pkg-days"
                type="number"
                min="1"
                placeholder="30"
                value={form.durationDays}
                onChange={(e) => update("durationDays", e.target.value)}
              />
              {errors.durationDays && <span className="pkg-error">{errors.durationDays}</span>}
            </div>
          </div>

          <div className="pkg-field-row">
            <div className="pkg-field">
              <label htmlFor="pkg-type">Type</label>
              <select id="pkg-type" value={form.type} onChange={(e) => update("type", e.target.value as PackageType)}>
                <option value="Normal">Normal</option>
                <option value="Premium">Premium</option>
                <option value="With Trainer">With Trainer</option>
              </select>
            </div>

            <div className="pkg-field">
              <label htmlFor="pkg-status">Status</label>
              <select id="pkg-status" value={form.status} onChange={(e) => update("status", e.target.value as PackageStatus)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pkg-field">
            <label htmlFor="pkg-icon">Card icon</label>
            <select id="pkg-icon" value={form.icon} onChange={(e) => update("icon", e.target.value as PackageIcon)}>
              <option value="dumbbell">Dumbbell</option>
              <option value="users">Group / Student</option>
              <option value="user">Single member / Trainer</option>
              <option value="layers">Special offer</option>
            </select>
          </div>

          <div className="pkg-field">
            <label htmlFor="pkg-features">Features</label>
            <textarea
              id="pkg-features"
              rows={5}
              placeholder={"Gym Access\nWeight Training\nCardio Access"}
              value={form.features}
              onChange={(e) => update("features", e.target.value)}
            />
            <span className="pkg-hint">Enter each feature on a new line.</span>
            {errors.features && <span className="pkg-error">{errors.features}</span>}
          </div>

          <footer className="pkg-modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add package"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const BOTTOM_GAP = 24;

const Packages: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PackageType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PackageStatus>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GymPackage | null>(null);

  /* make the page its own scroll container, same as the rest of the app */
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

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchPackages();
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((p) => {
      const matchesSearch =
        !q || p.name.toLowerCase().includes(q) || p.features.some((f) => f.toLowerCase().includes(q));
      const matchesType = typeFilter === "all" || p.type === typeFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [packages, search, typeFilter, statusFilter]);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  /* ---------------- Export: Excel (CSV, opens in Excel) ---------------- */
  const handleExportExcel = () => {
    const header = ["Name", "Type", "Price (PKR)", "Duration (Days)", "Features", "Status"];
    const rows = filtered.map((p) => [
      p.name,
      p.type,
      p.price,
      p.durationDays,
      p.features.join("; "),
      p.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    // BOM so Excel reads UTF-8 correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `packages-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---------------- Export: PDF (print dialog > Save as PDF) ---------------- */
  const handleExportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) {
      window.alert("Please allow pop-ups for this site to export the PDF.");
      return;
    }

    const activeCount = packages.filter((p) => p.status === "Active").length;
    const inactiveCount = packages.length - activeCount;

    const bodyRows = filtered
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.type)}</td><td>PKR ${escapeHtml(p.price.toLocaleString("en-PK"))}</td><td>${p.durationDays}</td><td>${escapeHtml(p.features.join(", "))}</td><td>${escapeHtml(p.status)}</td></tr>`
      )
      .join("");

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Packages Report</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p.meta { margin: 0 0 16px; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  .grid { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { flex: 1; min-width: 130px; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .card span { display: block; font-size: 11px; color: #666; }
  .card strong { font-size: 18px; }
</style>
</head>
<body>
  <h1>Packages Report</h1>
  <p class="meta">Generated ${escapeHtml(new Date().toLocaleString("en-US"))}</p>

  <div class="grid">
    <div class="card"><span>Total Packages</span><strong>${packages.length}</strong></div>
    <div class="card"><span>Active</span><strong>${activeCount}</strong></div>
    <div class="card"><span>Inactive</span><strong>${inactiveCount}</strong></div>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Name</th><th>Type</th><th>Price</th><th>Days</th><th>Features</th><th>Status</th></tr>
    </thead>
    <tbody>${bodyRows || '<tr><td colspan="7">No packages found.</td></tr>'}</tbody>
  </table>
</body>
</html>`);
    win.document.close();
    win.focus();
    // Give the new window a moment to render before opening the print dialog
    setTimeout(() => {
      win.print();
    }, 300);
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (pkg: GymPackage) => {
    setEditing(pkg);
    setModalOpen(true);
  };

  const handleSave = async (data: Omit<GymPackage, "id">, id?: string) => {
    setSaving(true);
    setError(null);
    try {
      if (id) {
        const updated = await apiUpdatePackage(id, data);
        setPackages((list) => list.map((p) => (p.id === id ? updated : p)));
      } else {
        const created = await apiCreatePackage(data);
        setPackages((list) => [created, ...list]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save package.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: GymPackage) => {
    const ok = window.confirm(`Delete "${pkg.name}"?`);
    if (!ok) return;
    try {
      await apiDeletePackage(pkg.id);
      setPackages((list) => list.filter((p) => p.id !== pkg.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete package.");
    }
  };

  const toggleStatus = async (pkg: GymPackage) => {
    const nextStatus: PackageStatus = pkg.status === "Active" ? "Inactive" : "Active";
    try {
      const updated = await apiUpdatePackage(pkg.id, {
        name: pkg.name,
        type: pkg.type,
        price: pkg.price,
        durationDays: pkg.durationDays,
        features: pkg.features,
        status: nextStatus,
        icon: pkg.icon,
      });
      setPackages((list) => list.map((p) => (p.id === pkg.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  return (
    <div
      className="packages-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Action Buttons: Refresh / Excel / PDF */}
      <div style={actionsRowStyle}>
        <button
          type="button"
          onClick={loadPackages}
          disabled={loading}
          style={{
            ...refreshBtnStyle,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <Icon.Refresh />
          Refresh
        </button>
        <button type="button" onClick={handleExportExcel} style={excelBtnStyle}>
          <Icon.File />
          Excel
        </button>
        <button type="button" onClick={handleExportPdf} style={pdfBtnStyle}>
          <Icon.Download />
          PDF
        </button>
      </div>

      <header className="pkg-header">
        <div className="pkg-header__left">
          <span className="pkg-header__icon">
            <Icon.Box />
          </span>
          <div>
            <h1>Packages</h1>
            <p>Manage gym membership packages</p>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={openAdd}>
          <Icon.Plus />
          Add New Package
        </button>
      </header>

      {error && (
        <div className="pkg-error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="pkg-toolbar">
        <div className="pkg-search">
          <Icon.Search />
          <input
            type="search"
            placeholder="Search packages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search packages"
          />
        </div>

        <select
          className="pkg-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | PackageType)}
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          <option value="Normal">Normal</option>
          <option value="Premium">Premium</option>
          <option value="With Trainer">With Trainer</option>
        </select>

        <select
          className="pkg-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | PackageStatus)}
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button type="button" className="btn btn--ghost" onClick={resetFilters}>
          <Icon.Reset />
          Reset
        </button>

        <div className="pkg-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === "grid" ? "is-active" : ""}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
          >
            <Icon.Grid />
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="List view"
          >
            <Icon.List />
          </button>
        </div>
      </section>

      {loading ? (
        <div className="pkg-empty">
          <h3>Loading...</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pkg-empty">
          <h3>No packages found</h3>
          <p>Reset the filters or add a new package.</p>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            <Icon.Plus />
            Add New Package
          </button>
        </div>
      ) : (
        <div className={`pkg-grid pkg-grid--${view}`}>
          {filtered.map((pkg) => {
            const CardIcon = PACKAGE_ICONS[pkg.icon] ?? Icon.Dumbbell;
            return (
              <article key={pkg.id} className="pkg-card">
                <div className="pkg-card__top">
                  <span className="pkg-card__icon">
                    <CardIcon />
                  </span>
                  <div className="pkg-card__title">
                    <h3>{pkg.name}</h3>
                    <span className={`badge badge--${pkg.type.toLowerCase().replace(/\s+/g, "-")}`}>
                      {pkg.type}
                    </span>
                  </div>
                </div>

                <div className="pkg-card__price">
                  <strong>PKR {pkg.price.toLocaleString("en-PK")}</strong>
                  <span>{pkg.durationDays} Days</span>
                </div>

                <ul className="pkg-card__features">
                  {pkg.features.map((f, i) => (
                    <li key={i}>
                      <Icon.Check />
                      {f}
                    </li>
                  ))}
                </ul>

                <footer className="pkg-card__foot">
                  <button
                    type="button"
                    className={`status-pill status-pill--${pkg.status.toLowerCase()}`}
                    onClick={() => toggleStatus(pkg)}
                    title="Click to change status"
                  >
                    {pkg.status}
                  </button>
                  <div className="pkg-card__actions">
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(pkg)}>
                      <Icon.Edit />
                      Edit
                    </button>
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => handleDelete(pkg)}>
                      <Icon.Trash />
                      Delete
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <PackageModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};

export default Packages;