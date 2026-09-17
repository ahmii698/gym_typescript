import React, { useEffect, useMemo, useState } from "react";
import "./trainers.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TrainerRole = "Fitness Trainer" | "Personal Trainer" | "Yoga Trainer";
export type TrainerStatus = "Active" | "On Leave" | "Inactive";

export interface Trainer {
  id: string;
  name: string;
  role: TrainerRole;
  status: TrainerStatus;
  phone: string;
  email: string;
  cnic: string;
  specialization: string;
  experienceYears: number;
  photo?: string;
}

const PAGE_SIZE = 6;

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const SEED_TRAINERS: Trainer[] = [
  {
    id: "trn-1",
    name: "Usman Ali",
    role: "Fitness Trainer",
    status: "Active",
    phone: "0300-1234567",
    email: "usman@fitzone.com",
    cnic: "42101-1234567-1",
    specialization: "Strength Training",
    experienceYears: 5,
  },
  {
    id: "trn-2",
    name: "Ayesha Fatima",
    role: "Personal Trainer",
    status: "Active",
    phone: "0321-7654321",
    email: "ayesha@fitzone.com",
    cnic: "42101-2234567-8",
    specialization: "Weight Loss",
    experienceYears: 3,
  },
  {
    id: "trn-3",
    name: "Bilal Hussain",
    role: "Fitness Trainer",
    status: "Active",
    phone: "0305-1112233",
    email: "bilal@fitzone.com",
    cnic: "42101-3334567-5",
    specialization: "Muscle Building",
    experienceYears: 6,
  },
  {
    id: "trn-4",
    name: "Sara Khan",
    role: "Yoga Trainer",
    status: "Active",
    phone: "0312-3344556",
    email: "sara@fitzone.com",
    cnic: "42101-4434567-2",
    specialization: "Yoga & Flexibility",
    experienceYears: 4,
  },
  {
    id: "trn-5",
    name: "Zain Ali",
    role: "Fitness Trainer",
    status: "On Leave",
    phone: "0333-4455667",
    email: "zain@fitzone.com",
    cnic: "42101-5534567-9",
    specialization: "Cardio",
    experienceYears: 5,
  },
  {
    id: "trn-6",
    name: "Hassan Raza",
    role: "Personal Trainer",
    status: "Active",
    phone: "0345-6677889",
    email: "hassan@fitzone.com",
    cnic: "42101-6634567-3",
    specialization: "CrossFit",
    experienceYears: 7,
  },
];

const SPECIALIZATIONS = [
  "Strength Training",
  "Weight Loss",
  "Muscle Building",
  "Yoga & Flexibility",
  "Cardio",
  "CrossFit",
  "Rehabilitation",
  "Nutrition Coaching",
];

/* ------------------------------------------------------------------ */
/* Inline icons                                                        */
/* ------------------------------------------------------------------ */

const Icon = {
  Trainers: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
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
  Phone: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M5 4h3l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Mail: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Target: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  ),
  Award: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" strokeLinejoin="round" />
    </svg>
  ),
  Eye: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" />
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
  Dots: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  Close: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  ChevLeft: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M14.5 5.5L8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevRight: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M9.5 5.5L16 12l-6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const statusClass = (s: TrainerStatus) =>
  s === "Active" ? "active" : s === "On Leave" ? "leave" : "inactive";

/* ------------------------------------------------------------------ */
/* Add / Edit modal                                                    */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  role: TrainerRole;
  status: TrainerStatus;
  phone: string;
  email: string;
  cnic: string;
  specialization: string;
  experienceYears: string;
  photo: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  role: "Fitness Trainer",
  status: "Active",
  phone: "",
  email: "",
  cnic: "",
  specialization: SPECIALIZATIONS[0],
  experienceYears: "",
  photo: "",
};

interface TrainerModalProps {
  open: boolean;
  editing: Trainer | null;
  onClose: () => void;
  onSave: (data: Omit<Trainer, "id">, id?: string) => void;
}

const TrainerModal: React.FC<TrainerModalProps> = ({
  open,
  editing,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setForm({
        name: editing.name,
        role: editing.role,
        status: editing.status,
        phone: editing.phone,
        email: editing.email,
        cnic: editing.cnic,
        specialization: editing.specialization,
        experienceYears: String(editing.experienceYears),
        photo: editing.photo ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  useEffect(() => {
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
    if (!form.name.trim()) next.name = "Trainer ka naam likhein.";

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 11) next.phone = "11 digit ka phone number likhein.";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Sahi email address likhein.";

    const cnicDigits = form.cnic.replace(/\D/g, "");
    if (cnicDigits.length !== 13) next.cnic = "CNIC 13 digits ka hota hai.";

    if (!form.specialization.trim())
      next.specialization = "Specialization select karein.";

    const exp = Number(form.experienceYears);
    if (form.experienceYears.trim() === "" || Number.isNaN(exp) || exp < 0)
      next.experienceYears = "Experience saalon mein likhein.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(
      {
        name: form.name.trim(),
        role: form.role,
        status: form.status,
        phone: form.phone.trim(),
        email: form.email.trim(),
        cnic: form.cnic.trim(),
        specialization: form.specialization.trim(),
        experienceYears: Number(form.experienceYears),
        photo: form.photo.trim() || undefined,
      },
      editing?.id
    );
  };

  return (
    <div className="trn-modal-backdrop" onMouseDown={onClose}>
      <div
        className="trn-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trn-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="trn-modal__head">
          <div>
            <h2 id="trn-modal-title">
              {editing ? "Edit trainer" : "Add new trainer"}
            </h2>
            <p>Trainer ki details bharein aur save karein.</p>
          </div>
          <button
            type="button"
            className="trn-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </header>

        <form className="trn-form" onSubmit={handleSubmit} noValidate>
          <div className="trn-field">
            <label htmlFor="trn-name">Full name</label>
            <input
              id="trn-name"
              type="text"
              placeholder="e.g. Usman Ali"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoFocus
            />
            {errors.name && <span className="trn-error">{errors.name}</span>}
          </div>

          <div className="trn-field-row">
            <div className="trn-field">
              <label htmlFor="trn-phone">Phone</label>
              <input
                id="trn-phone"
                type="tel"
                placeholder="0300-1234567"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
              {errors.phone && <span className="trn-error">{errors.phone}</span>}
            </div>

            <div className="trn-field">
              <label htmlFor="trn-cnic">CNIC</label>
              <input
                id="trn-cnic"
                type="text"
                placeholder="42101-1234567-1"
                value={form.cnic}
                onChange={(e) => update("cnic", e.target.value)}
              />
              {errors.cnic && <span className="trn-error">{errors.cnic}</span>}
            </div>
          </div>

          <div className="trn-field">
            <label htmlFor="trn-email">Email</label>
            <input
              id="trn-email"
              type="email"
              placeholder="name@fitzone.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
            {errors.email && <span className="trn-error">{errors.email}</span>}
          </div>

          <div className="trn-field-row">
            <div className="trn-field">
              <label htmlFor="trn-role">Role</label>
              <select
                id="trn-role"
                value={form.role}
                onChange={(e) => update("role", e.target.value as TrainerRole)}
              >
                <option value="Fitness Trainer">Fitness Trainer</option>
                <option value="Personal Trainer">Personal Trainer</option>
                <option value="Yoga Trainer">Yoga Trainer</option>
              </select>
            </div>

            <div className="trn-field">
              <label htmlFor="trn-status">Status</label>
              <select
                id="trn-status"
                value={form.status}
                onChange={(e) =>
                  update("status", e.target.value as TrainerStatus)
                }
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="trn-field-row">
            <div className="trn-field">
              <label htmlFor="trn-spec">Specialization</label>
              <select
                id="trn-spec"
                value={form.specialization}
                onChange={(e) => update("specialization", e.target.value)}
              >
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.specialization && (
                <span className="trn-error">{errors.specialization}</span>
              )}
            </div>

            <div className="trn-field">
              <label htmlFor="trn-exp">Experience (years)</label>
              <input
                id="trn-exp"
                type="number"
                min="0"
                placeholder="5"
                value={form.experienceYears}
                onChange={(e) => update("experienceYears", e.target.value)}
              />
              {errors.experienceYears && (
                <span className="trn-error">{errors.experienceYears}</span>
              )}
            </div>
          </div>

          <div className="trn-field">
            <label htmlFor="trn-photo">Photo URL (optional)</label>
            <input
              id="trn-photo"
              type="url"
              placeholder="https://..."
              value={form.photo}
              onChange={(e) => update("photo", e.target.value)}
            />
            <span className="trn-hint">
              Khali chhorne par naam ke initials dikhenge.
            </span>
          </div>

          <footer className="trn-modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editing ? "Save changes" : "Add trainer"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* View modal                                                          */
/* ------------------------------------------------------------------ */

const ViewModal: React.FC<{ trainer: Trainer | null; onClose: () => void }> = ({
  trainer,
  onClose,
}) => {
  useEffect(() => {
    if (!trainer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trainer, onClose]);

  if (!trainer) return null;

  const rows: Array<[string, string]> = [
    ["Role", trainer.role],
    ["Status", trainer.status],
    ["Phone", trainer.phone],
    ["Email", trainer.email],
    ["CNIC", trainer.cnic],
    ["Specialization", trainer.specialization],
    ["Experience", `${trainer.experienceYears} Years`],
  ];

  return (
    <div className="trn-modal-backdrop" onMouseDown={onClose}>
      <div
        className="trn-modal trn-modal--view"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="trn-modal__head">
          <div className="trn-view__id">
            <span className="trn-avatar trn-avatar--lg">
              {trainer.photo ? (
                <img src={trainer.photo} alt="" />
              ) : (
                initialsOf(trainer.name)
              )}
            </span>
            <div>
              <h2>{trainer.name}</h2>
              <p>{trainer.role}</p>
            </div>
          </div>
          <button
            type="button"
            className="trn-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </header>

        <div className="trn-view__body">
          {rows.map(([label, value]) => (
            <div key={label} className="trn-view__row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <footer className="trn-modal__foot trn-modal__foot--padded">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Trainers: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>(SEED_TRAINERS);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TrainerStatus>("all");
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [viewing, setViewing] = useState<Trainer | null>(null);

  // Close the kebab menu on any outside click.
  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

  const specOptions = useMemo(() => {
    const set = new Set<string>(SPECIALIZATIONS);
    trainers.forEach((t) => set.add(t.specialization));
    return Array.from(set).sort();
  }, [trainers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainers.filter((t) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.cnic.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q);
      const matchesSpec = specFilter === "all" || t.specialization === specFilter;
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesSpec && matchesStatus;
    });
  }, [trainers, search, specFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  // Whenever the filters change, go back to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, specFilter, statusFilter]);

  const resetFilters = () => {
    setSearch("");
    setSpecFilter("all");
    setStatusFilter("all");
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (t: Trainer) => {
    setEditing(t);
    setModalOpen(true);
  };

  const handleSave = (data: Omit<Trainer, "id">, id?: string) => {
    if (id) {
      setTrainers((list) => list.map((t) => (t.id === id ? { ...data, id } : t)));
    } else {
      setTrainers((list) => [...list, { ...data, id: `trn-${Date.now()}` }]);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = (t: Trainer) => {
    if (window.confirm(`"${t.name}" ko delete kar dein?`)) {
      setTrainers((list) => list.filter((x) => x.id !== t.id));
    }
  };

  const cycleStatus = (t: Trainer) => {
    const order: TrainerStatus[] = ["Active", "On Leave", "Inactive"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    setTrainers((list) =>
      list.map((x) => (x.id === t.id ? { ...x, status: next } : x))
    );
  };

  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + visible.length;

  return (
    <div className="trainers-page">
      {/* Header */}
      <header className="trn-header">
        <div className="trn-header__left">
          <span className="trn-header__icon">
            <Icon.Trainers />
          </span>
          <div>
            <h1>Trainers</h1>
            <p>Manage gym trainers and their details</p>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={openAdd}>
          <Icon.Plus />
          Add New Trainer
        </button>
      </header>

      {/* Toolbar */}
      <section className="trn-toolbar">
        <div className="trn-search">
          <Icon.Search />
          <input
            type="search"
            placeholder="Search trainers by name, phone, or CNIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search trainers"
          />
        </div>

        <select
          className="trn-select"
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          aria-label="Filter by specialization"
        >
          <option value="all">All Specializations</option>
          {specOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="trn-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | TrainerStatus)
          }
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button type="button" className="btn btn--ghost" onClick={resetFilters}>
          <Icon.Reset />
          Reset
        </button>
      </section>

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="trn-empty">
          <h3>Koi trainer nahi mila</h3>
          <p>Filters reset karein ya naya trainer add karein.</p>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            <Icon.Plus />
            Add New Trainer
          </button>
        </div>
      ) : (
        <div className="trn-grid">
          {visible.map((t) => (
            <article key={t.id} className="trn-card">
              <div className="trn-card__top">
                <span className="trn-avatar">
                  {t.photo ? <img src={t.photo} alt="" /> : initialsOf(t.name)}
                </span>

                <div className="trn-card__id">
                  <h3>{t.name}</h3>
                  <p>{t.role}</p>
                </div>

                <button
                  type="button"
                  className={`status-pill status-pill--${statusClass(t.status)}`}
                  onClick={() => cycleStatus(t)}
                  title="Status badalne ke liye click karein"
                >
                  {t.status}
                </button>

                <div className="trn-menu">
                  <button
                    type="button"
                    className="trn-menu__btn"
                    aria-label="More options"
                    aria-expanded={menuOpenId === t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === t.id ? null : t.id);
                    }}
                  >
                    <Icon.Dots />
                  </button>
                  {menuOpenId === t.id && (
                    <div
                      className="trn-menu__list"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button type="button" onClick={() => { setViewing(t); setMenuOpenId(null); }}>
                        <Icon.Eye /> View details
                      </button>
                      <button type="button" onClick={() => { openEdit(t); setMenuOpenId(null); }}>
                        <Icon.Edit /> Edit trainer
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => { handleDelete(t); setMenuOpenId(null); }}
                      >
                        <Icon.Trash /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <ul className="trn-card__meta">
                <li>
                  <Icon.Phone />
                  <span>{t.phone}</span>
                </li>
                <li>
                  <Icon.Mail />
                  <span className="is-truncate">{t.email}</span>
                </li>
                <li>
                  <Icon.Target />
                  <span>Specialization: {t.specialization}</span>
                </li>
                <li>
                  <Icon.Award />
                  <span>Experience: {t.experienceYears} Years</span>
                </li>
              </ul>

              <footer className="trn-card__actions">
                <button
                  type="button"
                  className="btn btn--sm btn--outline"
                  onClick={() => setViewing(t)}
                >
                  <Icon.Eye />
                  View
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--outline"
                  onClick={() => openEdit(t)}
                >
                  <Icon.Edit />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--danger-solid"
                  onClick={() => handleDelete(t)}
                >
                  <Icon.Trash />
                  Delete
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      <footer className="trn-footer">
        <span className="trn-footer__count">
          Showing {showingFrom} to {showingTo} of {filtered.length} trainers
        </span>

        <div className="trn-pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <Icon.ChevLeft />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={n === currentPage ? "is-active" : ""}
              onClick={() => setPage(n)}
              aria-current={n === currentPage ? "page" : undefined}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <Icon.ChevRight />
          </button>
        </div>
      </footer>

      <TrainerModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ViewModal trainer={viewing} onClose={() => setViewing(null)} />
    </div>
  );
};

export default Trainers;