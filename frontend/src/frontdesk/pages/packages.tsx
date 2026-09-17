import React, { useMemo, useState } from "react";
import "./packages.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type PackageType = "Normal" | "Premium" | "With Trainer";
export type PackageStatus = "Active" | "Inactive";
export type PackageIcon = "dumbbell" | "users" | "user" | "layers";

export interface GymPackage {
  id: string;
  name: string;
  type: PackageType;
  price: number;
  durationDays: number;
  features: string[];
  status: PackageStatus;
  icon: PackageIcon;
}

type ViewMode = "grid" | "list";

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const SEED_PACKAGES: GymPackage[] = [
  {
    id: "pkg-1",
    name: "Monthly Basic",
    type: "Normal",
    price: 5000,
    durationDays: 30,
    features: ["Gym Access", "Weight Training", "Cardio Access"],
    status: "Active",
    icon: "dumbbell",
  },
  {
    id: "pkg-2",
    name: "Quarterly Standard",
    type: "Normal",
    price: 12000,
    durationDays: 90,
    features: [
      "Gym Access",
      "Weight Training",
      "Cardio Access",
      "Personal Guidance (1 Month)",
    ],
    status: "Active",
    icon: "dumbbell",
  },
  {
    id: "pkg-3",
    name: "6 Months Premium",
    type: "Premium",
    price: 20000,
    durationDays: 180,
    features: [
      "Gym Access",
      "Weight Training",
      "Cardio Access",
      "Personal Guidance",
      "Nutrition Plan",
    ],
    status: "Active",
    icon: "dumbbell",
  },
  {
    id: "pkg-4",
    name: "1 Year Elite",
    type: "Premium",
    price: 35000,
    durationDays: 365,
    features: [
      "Gym Access",
      "Weight Training",
      "Cardio Access",
      "Personal Guidance",
      "Nutrition Plan",
      "Free Locker",
    ],
    status: "Active",
    icon: "dumbbell",
  },
  {
    id: "pkg-5",
    name: "Student Package",
    type: "Normal",
    price: 8000,
    durationDays: 90,
    features: ["Gym Access", "Weight Training", "Cardio Access"],
    status: "Active",
    icon: "users",
  },
  {
    id: "pkg-6",
    name: "Couple Package",
    type: "Normal",
    price: 15000,
    durationDays: 180,
    features: [
      "Gym Access",
      "Weight Training",
      "Cardio Access",
      "(2 Members)",
    ],
    status: "Active",
    icon: "user",
  },
  {
    id: "pkg-7",
    name: "Trainer Package",
    type: "With Trainer",
    price: 25000,
    durationDays: 90,
    features: [
      "Gym Access",
      "Personal Trainer",
      "Custom Workout Plan",
      "Nutrition Plan",
    ],
    status: "Active",
    icon: "user",
  },
  {
    id: "pkg-8",
    name: "Special Offer",
    type: "Normal",
    price: 10000,
    durationDays: 60,
    features: ["Gym Access", "Weight Training", "Cardio Access"],
    status: "Inactive",
    icon: "layers",
  },
];

/* ------------------------------------------------------------------ */
/* Inline icons (no external icon lib needed)                          */
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
  onClose: () => void;
  onSave: (data: Omit<GymPackage, "id">, id?: string) => void;
}

const PackageModal: React.FC<PackageModalProps> = ({
  open,
  editing,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Reset the form whenever the modal opens (fresh add vs. edit).
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

  // Close on Escape.
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
    const feats = form.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
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
        features: form.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
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
            <h2 id="pkg-modal-title">
              {editing ? "Edit package" : "Add new package"}
            </h2>
            <p>Membership ki details bharein aur save karein.</p>
          </div>
          <button
            type="button"
            className="pkg-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
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
              {errors.durationDays && (
                <span className="pkg-error">{errors.durationDays}</span>
              )}
            </div>
          </div>

          <div className="pkg-field-row">
            <div className="pkg-field">
              <label htmlFor="pkg-type">Type</label>
              <select
                id="pkg-type"
                value={form.type}
                onChange={(e) => update("type", e.target.value as PackageType)}
              >
                <option value="Normal">Normal</option>
                <option value="Premium">Premium</option>
                <option value="With Trainer">With Trainer</option>
              </select>
            </div>

            <div className="pkg-field">
              <label htmlFor="pkg-status">Status</label>
              <select
                id="pkg-status"
                value={form.status}
                onChange={(e) =>
                  update("status", e.target.value as PackageStatus)
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pkg-field">
            <label htmlFor="pkg-icon">Card icon</label>
            <select
              id="pkg-icon"
              value={form.icon}
              onChange={(e) => update("icon", e.target.value as PackageIcon)}
            >
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
            {errors.features && (
              <span className="pkg-error">{errors.features}</span>
            )}
          </div>

          <footer className="pkg-modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editing ? "Save changes" : "Add package"}
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

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<GymPackage[]>(SEED_PACKAGES);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PackageType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PackageStatus>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GymPackage | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.features.some((f) => f.toLowerCase().includes(q));
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

  const handleSave = (data: Omit<GymPackage, "id">, id?: string) => {
    if (id) {
      setPackages((list) =>
        list.map((p) => (p.id === id ? { ...data, id } : p))
      );
    } else {
      setPackages((list) => [
        ...list,
        { ...data, id: `pkg-${Date.now()}` },
      ]);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = (pkg: GymPackage) => {
    const ok = window.confirm(`"${pkg.name}" delete kar dein?`);
    if (ok) setPackages((list) => list.filter((p) => p.id !== pkg.id));
  };

  const toggleStatus = (pkg: GymPackage) => {
    setPackages((list) =>
      list.map((p) =>
        p.id === pkg.id
          ? { ...p, status: p.status === "Active" ? "Inactive" : "Active" }
          : p
      )
    );
  };

  return (
    <div className="packages-page">
      {/* Header */}
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

      {/* Toolbar */}
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
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | PackageStatus)
          }
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

      {/* Cards */}
      {filtered.length === 0 ? (
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
                    <span
                      className={`badge badge--${pkg.type
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
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
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => openEdit(pkg)}
                    >
                      <Icon.Edit />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => handleDelete(pkg)}
                    >
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