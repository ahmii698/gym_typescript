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

// Backend se jaisa data aata hai
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
/* API helpers (isi file ke andar)                                     */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return localStorage.getItem("token"); // apke login flow ke mutabiq key adjust kar lein
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
  if (!res.ok) throw new Error("Packages load nahi ho sakin.");
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
    throw new Error(body?.message || "Package add nahi ho saka.");
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
    throw new Error(body?.message || "Package update nahi ho saka.");
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
  if (!res.ok) throw new Error("Package delete nahi ho saka.");
}

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

const PACKAGE_ICONS: Record<PackageIcon, () => JSX.Element> = {
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
    if (!form.name.trim()) next.name = "Package ka naam likhein.";
    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price <= 0)
      next.price = "Price 0 se zyada honi chahiye.";
    const days = Number(form.durationDays);
    if (!form.durationDays.trim() || !Number.isInteger(days) || days <= 0)
      next.durationDays = "Duration poore dinon mein likhein.";
    const feats = form.features.split("\n").map((f) => f.trim()).filter(Boolean);
    if (feats.length === 0) next.features = "Kam az kam aik feature add karein.";
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
            <p>Membership ki details bharein aur save karein.</p>
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
            <span className="pkg-hint">Har feature nayi line par likhein.</span>
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
      setError(err instanceof Error ? err.message : "Packages load nahi ho sakin.");
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
      setError(err instanceof Error ? err.message : "Package save nahi ho saka.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: GymPackage) => {
    const ok = window.confirm(`"${pkg.name}" delete kar dein?`);
    if (!ok) return;
    try {
      await apiDeletePackage(pkg.id);
      setPackages((list) => list.filter((p) => p.id !== pkg.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Package delete nahi ho saka.");
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
      setError(err instanceof Error ? err.message : "Status update nahi ho saka.");
    }
  };

  return (
    <div
      className="packages-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
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
          <h3>Koi package nahi mila</h3>
          <p>Filters reset karein ya naya package add karein.</p>
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
                    title="Status badalne ke liye click karein"
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