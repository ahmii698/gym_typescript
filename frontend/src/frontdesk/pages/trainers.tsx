import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL, STORAGE_URL } from "../../../config";
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
  experienceYears: number | null;
  photo?: string;
}

interface ApiTrainer {
  id: number;
  name: string;
  cnic: string | null;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  role: string | null;
  status: string | null;
  experience_years: number | null;
  photo_url: string | null;
  is_active: number | boolean;
}

const PAGE_SIZE = 6;

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

const DISPLAY_FALLBACK = "—";

/* ------------------------------------------------------------------ */
/* API helpers                                                         */
/* ------------------------------------------------------------------ */

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const resolvePhoto = (url: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${STORAGE_URL}/${url.replace(/^\/+/, "")}`;
};

const mapTrainer = (t: ApiTrainer): Trainer => ({
  id: String(t.id),
  name: t.name ?? "",
  role: (t.role as TrainerRole) || "Fitness Trainer",
  status: (t.status as TrainerStatus) || "Active",
  phone: t.phone ?? "",
  email: t.email ?? "",
  cnic: t.cnic ?? "",
  specialization: t.specialization ?? "",
  experienceYears: t.experience_years ?? null,
  photo: resolvePhoto(t.photo_url),
});

// Laravel field -> form field, for mapping 422 validation errors back
const apiFieldToForm: Record<string, keyof FormState> = {
  name: "name",
  phone: "phone",
  cnic: "cnic",
  email: "email",
  specialization: "specialization",
  experience_years: "experienceYears",
  photo_url: "photo",
};

class ApiValidationError extends Error {
  fieldErrors: Partial<Record<keyof FormState, string>>;
  constructor(message: string, fieldErrors: Partial<Record<keyof FormState, string>> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

const firstApiError = (json: any): string =>
  json?.message ?? "Kuch ghalat ho gaya. Dobara koshish karein.";

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
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const statusClass = (s: TrainerStatus) =>
  s === "Active" ? "active" : s === "On Leave" ? "leave" : "inactive";

const show = (v: string | null | undefined) => (v && v.trim() ? v : DISPLAY_FALLBACK);
const showYears = (v: number | null) => (v != null ? `${v} Years` : DISPLAY_FALLBACK);

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
  onSave: (data: Omit<Trainer, "id">, id?: string) => Promise<void>;
}

const TrainerModal: React.FC<TrainerModalProps> = ({ open, editing, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    if (editing) {
      setForm({
        name: editing.name,
        role: editing.role,
        status: editing.status,
        phone: editing.phone,
        email: editing.email,
        cnic: editing.cnic,
        specialization: editing.specialization || SPECIALIZATIONS[0],
        experienceYears: editing.experienceYears != null ? String(editing.experienceYears) : "",
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

    if (form.phone.trim()) {
      const phoneDigits = form.phone.replace(/\D/g, "");
      if (phoneDigits.length < 11) next.phone = "11 digit ka phone number likhein.";
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Sahi email address likhein.";

    if (form.cnic.trim()) {
      const cnicDigits = form.cnic.replace(/\D/g, "");
      if (cnicDigits.length !== 13) next.cnic = "CNIC 13 digits ka hota hai.";
    }

    if (form.experienceYears.trim() !== "") {
      const exp = Number(form.experienceYears);
      if (Number.isNaN(exp) || exp < 0) next.experienceYears = "Experience saalon mein likhein.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await onSave(
        {
          name: form.name.trim(),
          role: form.role,
          status: form.status,
          phone: form.phone.trim(),
          email: form.email.trim(),
          cnic: form.cnic.trim(),
          specialization: form.specialization.trim(),
          experienceYears: form.experienceYears.trim() === "" ? null : Number(form.experienceYears),
          photo: form.photo.trim() || undefined,
        },
        editing?.id
      );
    } catch (err) {
      if (err instanceof ApiValidationError) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Kuch ghalat ho gaya.");
      }
    } finally {
      setSubmitting(false);
    }
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
            <h2 id="trn-modal-title">{editing ? "Edit trainer" : "Add new trainer"}</h2>
            <p>Trainer ki details bharein aur save karein.</p>
          </div>
          <button type="button" className="trn-modal__close" onClick={onClose} aria-label="Close">
            <Icon.Close />
          </button>
        </header>

        <form className="trn-form" onSubmit={handleSubmit} noValidate>
          {formError && <div className="trn-form__error">{formError}</div>}

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
              <select id="trn-role" value={form.role} onChange={(e) => update("role", e.target.value as TrainerRole)}>
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
                onChange={(e) => update("status", e.target.value as TrainerStatus)}
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
              <select id="trn-spec" value={form.specialization} onChange={(e) => update("specialization", e.target.value)}>
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.specialization && <span className="trn-error">{errors.specialization}</span>}
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
              {errors.experienceYears && <span className="trn-error">{errors.experienceYears}</span>}
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
            <span className="trn-hint">Khali chhorne par naam ke initials dikhenge.</span>
          </div>

          <footer className="trn-modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Save changes" : "Add trainer"}
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

const ViewModal: React.FC<{ trainer: Trainer | null; onClose: () => void }> = ({ trainer, onClose }) => {
  useEffect(() => {
    if (!trainer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trainer, onClose]);

  if (!trainer) return null;

  const rows: Array<[string, string]> = [
    ["Role", show(trainer.role)],
    ["Status", show(trainer.status)],
    ["Phone", show(trainer.phone)],
    ["Email", show(trainer.email)],
    ["CNIC", show(trainer.cnic)],
    ["Specialization", show(trainer.specialization)],
    ["Experience", showYears(trainer.experienceYears)],
  ];

  return (
    <div className="trn-modal-backdrop" onMouseDown={onClose}>
      <div className="trn-modal trn-modal--view" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="trn-modal__head">
          <div className="trn-view__id">
            <span className="trn-avatar trn-avatar--lg">
              {trainer.photo ? <img src={trainer.photo} alt="" /> : initialsOf(trainer.name)}
            </span>
            <div>
              <h2>{trainer.name || DISPLAY_FALLBACK}</h2>
              <p>{show(trainer.role)}</p>
            </div>
          </div>
          <button type="button" className="trn-modal__close" onClick={onClose} aria-label="Close">
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
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const BOTTOM_GAP = 24;

const Trainers: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TrainerStatus>("all");
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [viewing, setViewing] = useState<Trainer | null>(null);

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

  const loadTrainers = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`${API_URL}/trainers`, { headers: authHeaders() });
      if (res.status === 401) {
        setPageError("Session expire ho gaya hai, dobara login karo.");
        return;
      }
      if (!res.ok) throw new Error();
      const json: ApiTrainer[] = await res.json();
      setTrainers(json.map(mapTrainer));
    } catch {
      setPageError("Trainers load nahi ho sake. Backend chal raha hai?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainers();
  }, []);

  // Close the kebab menu on any outside click.
  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

  const specOptions = useMemo(() => {
    const set = new Set<string>(SPECIALIZATIONS);
    trainers.forEach((t) => t.specialization && set.add(t.specialization));
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

  const buildPayload = (data: Omit<Trainer, "id">) => ({
    name: data.name,
    phone: data.phone || null,
    cnic: data.cnic || null,
    email: data.email || null,
    role: data.role,
    status: data.status,
    specialization: data.specialization || null,
    experience_years: data.experienceYears,
    photo_url: data.photo || null,
  });

  const handleSave = async (data: Omit<Trainer, "id">, id?: string) => {
    const url = id ? `${API_URL}/trainers/${id}` : `${API_URL}/trainers`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(data)),
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 422 && json?.errors) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      Object.entries(json.errors).forEach(([key, msgs]) => {
        const mapped = apiFieldToForm[key];
        if (mapped) fieldErrors[mapped] = (msgs as string[])[0];
      });
      throw new ApiValidationError(firstApiError(json), fieldErrors);
    }

    if (res.status === 401) {
      throw new Error("Session expire ho gaya hai, dobara login karo.");
    }

    if (!res.ok) {
      throw new Error(firstApiError(json));
    }

    const saved = mapTrainer(json.data ?? json);
    setTrainers((list) => (id ? list.map((t) => (t.id === saved.id ? saved : t)) : [...list, saved]));
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (t: Trainer) => {
    if (!window.confirm(`"${t.name}" ko delete kar dein?`)) return;
    try {
      const res = await fetch(`${API_URL}/trainers/${t.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setTrainers((list) => list.filter((x) => x.id !== t.id));
    } catch {
      alert("Trainer delete nahi ho saka. Backend chal raha hai?");
    }
  };

  const cycleStatus = async (t: Trainer) => {
    const order: TrainerStatus[] = ["Active", "On Leave", "Inactive"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    const previous = trainers;

    setTrainers((list) => list.map((x) => (x.id === t.id ? { ...x, status: next } : x)));

    try {
      const res = await fetch(`${API_URL}/trainers/${t.id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload({ ...t, status: next })),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTrainers(previous);
    }
  };

  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + visible.length;

  return (
    <div
      className="trainers-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
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

      {pageError && (
        <div className="trn-alert" role="alert">
          <span>{pageError}</span>
          <button type="button" onClick={loadTrainers}>
            Retry
          </button>
        </div>
      )}

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

        <select className="trn-select" value={specFilter} onChange={(e) => setSpecFilter(e.target.value)} aria-label="Filter by specialization">
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
          onChange={(e) => setStatusFilter(e.target.value as "all" | TrainerStatus)}
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

      {/* Loading */}
      {loading ? (
        <div className="trn-empty">
          <h3>Loading trainers...</h3>
          <p>Zara sabar karein, data load ho raha hai.</p>
        </div>
      ) : visible.length === 0 ? (
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
                  <h3>{t.name || DISPLAY_FALLBACK}</h3>
                  <p>{show(t.role)}</p>
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
                    <div className="trn-menu__list" onClick={(e) => e.stopPropagation()}>
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
                  <span>{show(t.phone)}</span>
                </li>
                <li>
                  <Icon.Mail />
                  <span className="is-truncate">{show(t.email)}</span>
                </li>
                <li>
                  <Icon.Target />
                  <span>Specialization: {show(t.specialization)}</span>
                </li>
                <li>
                  <Icon.Award />
                  <span>Experience: {showYears(t.experienceYears)}</span>
                </li>
              </ul>

              <footer className="trn-card__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => setViewing(t)}>
                  <Icon.Eye />
                  View
                </button>
                <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(t)}>
                  <Icon.Edit />
                  Edit
                </button>
                <button type="button" className="btn btn--sm btn--danger-solid" onClick={() => handleDelete(t)}>
                  <Icon.Trash />
                  Delete
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <footer className="trn-footer">
          <span className="trn-footer__count">
            Showing {showingFrom} to {showingTo} of {filtered.length} trainers
          </span>

          <div className="trn-pagination">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous page">
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
      )}

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