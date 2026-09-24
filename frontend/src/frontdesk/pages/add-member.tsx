import React, { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../../config";
import "./add-member.css";

type MemberType = "normal" | "normal-trainer" | "package-trainer" | "package-only";

interface FormState {
  fullName: string;
  cnic: string;
  cnicFront: File | null;
  cnicBack: File | null;
  contactNumber: string;
  email: string;
  dob: string;
  gender: string;
  trainer: string;
  memberType: MemberType;
  package: string;
  startDate: string;
  endDate: string;
  notes: string;
  feeAmount: string;
  paymentStatus: string;
}

interface PackageItem {
  id: number;
  name: string;
  duration_days: number;
  price: string | number;
}

interface TrainerItem {
  id: number;
  name: string;
  phone?: string | null;
  cnic?: string | null;
  email?: string | null;
  specialization?: string | null;
  role?: string | null;
  status?: string | null;
  experience_years?: number | null;
  photo_url?: string | null;
}

type FormErrors = Partial<Record<keyof FormState, string>>;
type AlertState = { type: "error" | "success"; text: string } | null;

const initialState: FormState = {
  fullName: "",
  cnic: "",
  cnicFront: null,
  cnicBack: null,
  contactNumber: "",
  email: "",
  dob: "",
  gender: "",
  trainer: "",
  memberType: "normal",
  package: "",
  startDate: "",
  endDate: "",
  notes: "",
  feeAmount: "0",
  paymentStatus: "",
};

const memberTypeOptions: { value: MemberType; title: string; desc: string }[] = [
  { value: "normal", title: "Normal User", desc: "Only Member Access" },
  { value: "normal-trainer", title: "Normal + Trainer", desc: "Member + Personal Trainer" },
  { value: "package-trainer", title: "Package + Trainer", desc: "With Package + Personal Trainer" },
  { value: "package-only", title: "Package Only", desc: "With Package (No Trainer)" },
];

// Frontend value -> Laravel value
const memberTypeToApi: Record<MemberType, string> = {
  normal: "normal_user",
  "normal-trainer": "normal_trainer",
  "package-trainer": "package_trainer",
  "package-only": "package_only",
};

// Laravel field name -> form field name (errors ke liye)
const apiFieldToForm: Record<string, keyof FormState> = {
  full_name: "fullName",
  cnic: "cnic",
  cnic_front: "cnicFront",
  cnic_back: "cnicBack",
  contact_number: "contactNumber",
  email: "email",
  date_of_birth: "dob",
  gender: "gender",
  package_id: "package",
  start_date: "startDate",
  end_date: "endDate",
  notes: "notes",
  member_type: "memberType",
  trainer_id: "trainer",
  fee_amount: "feeAmount",
  payment_status: "paymentStatus",
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const formatCnic = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

const firstError = (json: any): string => {
  if (json?.errors) {
    const first = Object.values(json.errors)[0] as string[] | undefined;
    if (first?.[0]) return first[0];
  }
  return json?.message ?? "Something went wrong. Please try again.";
};

function AddMember() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLElement>(null);

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [alert, setAlert] = useState<AlertState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [trainers, setTrainers] = useState<TrainerItem[]>([]);
  const [showTrainerModal, setShowTrainerModal] = useState(false);

  const needsTrainer = form.memberType === "normal-trainer" || form.memberType === "package-trainer";

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, tRes] = await Promise.all([
          fetch(`${API_URL}/packages`, { headers: authHeaders() }),
          fetch(`${API_URL}/trainers`, { headers: authHeaders() }),
        ]);
        if (pRes.ok) setPackages(await pRes.json());
        if (tRes.ok) setTrainers(await tRes.json());
        if (pRes.status === 401 || tRes.status === 401) {
          showAlert("error", "Session expire ho gaya hai, dobara login karo.");
        }
      } catch {
        showAlert("error", "Packages aur trainers load nahi ho sake. Backend chal raha hai?");
      }
    };
    load();
  }, []);

  const showAlert = (type: "error" | "success", text: string) => {
    setAlert({ type, text });
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleInput =
    (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      updateField(field, e.target.value as FormState[typeof field]);
    };

  const handleCnic = (e: ChangeEvent<HTMLInputElement>) => {
    updateField("cnic", formatCnic(e.target.value));
  };

  const handleFile = (field: "cnicFront" | "cnicBack") => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, [field]: "Image 2MB se zyada nahi honi chahiye." }));
      return;
    }
    updateField(field, file);
  };

  const handlePackageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    updateField("package", id);
    const pkg = packages.find((p) => String(p.id) === id);
    if (pkg && (form.feeAmount === "" || Number(form.feeAmount) === 0)) {
      updateField("feeAmount", String(Number(pkg.price)));
    }
  };

  const handleReset = () => {
    setForm(initialState);
    setErrors({});
    setAlert(null);
    setFormKey((k) => k + 1);
  };

  const handleTrainerCreated = (trainer: TrainerItem) => {
    setTrainers((prev) => [...prev, trainer].sort((a, b) => a.name.localeCompare(b.name)));
    updateField("trainer", String(trainer.id));
    setShowTrainerModal(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAlert(null);

    // Client-side checks
    const clientErrors: FormErrors = {};
    if (!form.cnicFront) clientErrors.cnicFront = "CNIC front image zaroori hai.";
    if (!form.cnicBack) clientErrors.cnicBack = "CNIC back image zaroori hai.";
    if (needsTrainer && !form.trainer) clientErrors.trainer = "Is member type ke liye trainer select karo.";

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      showAlert("error", "Please fix the highlighted fields.");
      return;
    }

    const fd = new FormData();
    fd.append("full_name", form.fullName.trim());
    fd.append("cnic", form.cnic);
    fd.append("cnic_front", form.cnicFront as File);
    fd.append("cnic_back", form.cnicBack as File);
    fd.append("contact_number", form.contactNumber.trim());
    if (form.email.trim()) fd.append("email", form.email.trim());
    if (form.dob) fd.append("date_of_birth", form.dob);
    if (form.gender) fd.append("gender", form.gender);
    fd.append("member_type", memberTypeToApi[form.memberType]);
    fd.append("package_id", form.package);
    fd.append("start_date", form.startDate);
    if (form.endDate) fd.append("end_date", form.endDate);
    if (form.notes.trim()) fd.append("notes", form.notes.trim());
    if (needsTrainer && form.trainer) fd.append("trainer_id", form.trainer);
    fd.append("fee_amount", form.feeAmount || "0");
    if (form.paymentStatus) fd.append("payment_status", form.paymentStatus);

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/members`, {
        method: "POST",
        headers: authHeaders(), // Content-Type mat lagana, browser khud boundary set karta hai
        body: fd,
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 422 && json?.errors) {
        const mapped: FormErrors = {};
        Object.entries(json.errors).forEach(([key, msgs]) => {
          const formKeyName = apiFieldToForm[key];
          if (formKeyName) mapped[formKeyName] = (msgs as string[])[0];
        });
        setErrors(mapped);
        showAlert("error", "Please fix the highlighted fields.");
        return;
      }

      if (res.status === 401) {
        showAlert("error", "Session expire ho gaya hai, dobara login karo.");
        return;
      }

      if (!res.ok) {
        showAlert("error", firstError(json));
        return;
      }

      showAlert("success", json?.message ?? "Member added successfully");
      setForm(initialState);
      setErrors({});
      setFormKey((k) => k + 1);
    } catch {
      showAlert("error", "Server se connect nahi ho saka. Backend chal raha hai?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="am-page">
      <header className="am-header" ref={topRef}>
        <button type="button" className="am-back-btn" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1>Add New Member</h1>
          <p>Fill in the details below to register a new member in the system.</p>
        </div>
      </header>

      {alert && (
        <div className={`am-alert am-alert--${alert.type}`} role="alert">
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <form className="am-grid" onSubmit={handleSubmit}>
        {/* LEFT COLUMN */}
        <div className="am-col">
          <section className="am-card">
            <h2>
              <UserIcon /> Personal Information
            </h2>

            <div className="am-row">
              <Field label="Full Name" required error={errors.fullName}>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={form.fullName}
                  onChange={handleInput("fullName")}
                  required
                />
              </Field>
              <Field label="CNIC" required error={errors.cnic}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="XXXXX-XXXXXXX-X"
                  value={form.cnic}
                  onChange={handleCnic}
                  maxLength={15}
                  required
                />
              </Field>
            </div>

            <div className="am-row">
              <Field label="CNIC Front Image" required error={errors.cnicFront}>
                <UploadBox key={`front-${formKey}`} file={form.cnicFront} onChange={handleFile("cnicFront")} />
              </Field>
              <Field label="CNIC Back Image" required error={errors.cnicBack}>
                <UploadBox key={`back-${formKey}`} file={form.cnicBack} onChange={handleFile("cnicBack")} />
              </Field>
            </div>

            <div className="am-row">
              <Field label="Contact Number" required error={errors.contactNumber}>
                <div className="am-input-icon">
                  <PhoneIcon />
                  <input
                    type="tel"
                    placeholder="03XX-XXXXXXX"
                    value={form.contactNumber}
                    onChange={handleInput("contactNumber")}
                    required
                  />
                </div>
              </Field>
              <Field label="Email" optional error={errors.email}>
                <div className="am-input-icon">
                  <MailIcon />
                  <input
                    type="email"
                    placeholder="example@domain.com"
                    value={form.email}
                    onChange={handleInput("email")}
                  />
                </div>
              </Field>
            </div>

            <div className="am-row">
              <Field label="Date of Birth" optional error={errors.dob}>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.dob} onChange={handleInput("dob")} placeholder="dd/mm/yyyy" />
                </div>
              </Field>
              <Field label="Gender" optional error={errors.gender}>
                <select value={form.gender} onChange={handleInput("gender")}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="am-card">
            <h2>
              <BoxIcon /> Membership Details
            </h2>

            <div className="am-row">
              <Field label="Select Package" required error={errors.package}>
                <select value={form.package} onChange={handlePackageChange} required>
                  <option value="">Choose Package</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start Date" required error={errors.startDate}>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.startDate} onChange={handleInput("startDate")} required />
                </div>
              </Field>
            </div>

            <div className="am-row">
              <Field label="End Date" optional error={errors.endDate}>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={handleInput("endDate")} />
                </div>
              </Field>
            </div>

            <Field label="Notes" optional error={errors.notes}>
              <div className="am-input-icon am-textarea-icon">
                <NoteIcon />
                <textarea
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={handleInput("notes")}
                  rows={3}
                />
              </div>
            </Field>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="am-col">
          <section className="am-card">
            <h2>
              <TrainerIcon /> Assign Trainer{" "}
              <span className="am-optional-tag">{needsTrainer ? "(Required)" : "(Optional)"}</span>
            </h2>

            <Field label="Select Trainer" error={errors.trainer}>
              <select value={form.trainer} onChange={handleInput("trainer")}>
                <option value="">Choose Trainer</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="am-or-divider">
              <span>OR</span>
            </div>

            <button type="button" className="am-add-trainer-btn" onClick={() => setShowTrainerModal(true)}>
              <PlusIcon /> Add New Trainer
            </button>
          </section>

          <section className="am-card">
            <h2>
              <UserIcon /> Member Type
            </h2>

            <div className="am-type-grid">
              {memberTypeOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`am-type-card ${form.memberType === opt.value ? "am-type-card--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="memberType"
                    value={opt.value}
                    checked={form.memberType === opt.value}
                    onChange={() => updateField("memberType", opt.value)}
                  />
                  <span className="am-type-icon">
                    {opt.value === "package-only" ? <StackIcon /> : <UserBadgeIcon />}
                  </span>
                  <span className="am-type-text">
                    <strong>{opt.title}</strong>
                    <small>{opt.desc}</small>
                  </span>
                  <span className="am-type-radio" />
                </label>
              ))}
            </div>
          </section>

          <section className="am-card">
            <h2>
              <CardIcon /> Payment Setup
            </h2>

            <div className="am-row">
              <Field label="Fee Amount" error={errors.feeAmount}>
                <div className="am-input-icon am-prefix">
                  <span className="am-prefix-text">PKR</span>
                  <input
                    type="number"
                    min={0}
                    value={form.feeAmount}
                    onChange={handleInput("feeAmount")}
                  />
                </div>
              </Field>
              <Field label="Payment Status" error={errors.paymentStatus}>
                <select value={form.paymentStatus} onChange={handleInput("paymentStatus")}>
                  <option value="">Select Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
              </Field>
            </div>

            <div className="am-actions">
              <button type="button" className="am-reset-btn" onClick={handleReset} disabled={submitting}>
                <ResetIcon /> Reset
              </button>
              <button type="submit" className="am-submit-btn" disabled={submitting}>
                <PlusIcon /> {submitting ? "Saving..." : "Add Member"}
              </button>
            </div>
          </section>
        </div>
      </form>

      {showTrainerModal && (
        <AddTrainerModal onClose={() => setShowTrainerModal(false)} onCreated={handleTrainerCreated} />
      )}
    </div>
  );
}

/* ---------- Add Trainer modal ---------- */

interface TrainerFormState {
  name: string;
  phone: string;
  cnic: string;
  email: string;
  role: string;
  status: string;
  specialization: string;
  experienceYears: string;
  photoUrl: string;
}

const trainerInitialState: TrainerFormState = {
  name: "",
  phone: "",
  cnic: "",
  email: "",
  role: "Fitness Trainer",
  status: "Active",
  specialization: "",
  experienceYears: "",
  photoUrl: "",
};

function AddTrainerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (trainer: TrainerItem) => void;
}) {
  const [form, setForm] = useState<TrainerFormState>(trainerInitialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = <K extends keyof TrainerFormState>(field: K, value: TrainerFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInput =
    (field: keyof TrainerFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateField(field, e.target.value);
    };

  const handleCnic = (e: ChangeEvent<HTMLInputElement>) => {
    updateField("cnic", formatCnic(e.target.value));
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Trainer ka naam zaroori hai.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/trainers`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          cnic: form.cnic.trim() || null,
          email: form.email.trim() || null,
          role: form.role.trim() || null,
          status: form.status || null,
          specialization: form.specialization.trim() || null,
          experience_years: form.experienceYears ? Number(form.experienceYears) : null,
          photo_url: form.photoUrl.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(firstError(json));
        return;
      }
      onCreated(json.data);
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="am-modal-overlay" onClick={onClose}>
      <div className="am-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Add New Trainer</h3>

        {error && <div className="am-error am-modal-error">{error}</div>}

        <Field label="Full Name" required>
          <input
            type="text"
            placeholder="e.g. Usman Ali"
            value={form.name}
            onChange={handleInput("name")}
            autoFocus
          />
        </Field>

        <div className="am-row">
          <Field label="Phone" optional>
            <input
              type="tel"
              placeholder="03XX-XXXXXXX"
              value={form.phone}
              onChange={handleInput("phone")}
            />
          </Field>
          <Field label="CNIC" optional>
            <input
              type="text"
              inputMode="numeric"
              placeholder="XXXXX-XXXXXXX-X"
              value={form.cnic}
              onChange={handleCnic}
              maxLength={15}
            />
          </Field>
        </div>

        <Field label="Email" optional>
          <input
            type="email"
            placeholder="name@fitzone.com"
            value={form.email}
            onChange={handleInput("email")}
          />
        </Field>

        <div className="am-row">
          <Field label="Role" optional>
            <select value={form.role} onChange={handleInput("role")}>
              <option value="Fitness Trainer">Fitness Trainer</option>
              <option value="Personal Trainer">Personal Trainer</option>
              <option value="Yoga Trainer">Yoga Trainer</option>
            </select>
          </Field>
          <Field label="Status" optional>
            <select value={form.status} onChange={handleInput("status")}>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
        </div>

        <div className="am-row">
          <Field label="Specialization" optional>
            <input
              type="text"
              placeholder="e.g. Weight training, Cardio"
              value={form.specialization}
              onChange={handleInput("specialization")}
            />
          </Field>
          <Field label="Experience (years)" optional>
            <input
              type="number"
              min={0}
              placeholder="5"
              value={form.experienceYears}
              onChange={handleInput("experienceYears")}
            />
          </Field>
        </div>

        <Field label="Photo URL" optional>
          <input
            type="text"
            placeholder="https://..."
            value={form.photoUrl}
            onChange={handleInput("photoUrl")}
          />
        </Field>

        <div className="am-modal-actions">
          <button type="button" className="am-reset-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="am-submit-btn" onClick={save} disabled={saving}>
            <PlusIcon /> {saving ? "Saving..." : "Save Trainer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small building blocks ---------- */

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`am-field ${error ? "am-field--error" : ""}`}>
      <label>
        {label}
        {required && <span className="am-required">*</span>}
        {optional && <span className="am-optional"> (Optional)</span>}
      </label>
      {children}
      {error && <span className="am-error">{error}</span>}
    </div>
  );
}

function UploadBox({ file, onChange }: { file: File | null; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  const inputId = React.useId();
  return (
    <label className="am-upload-box" htmlFor={inputId}>
      <input id={inputId} type="file" accept="image/jpeg,image/png" onChange={onChange} hidden />
      <UploadIcon />
      <span className="am-upload-title">{file ? file.name : "Click to upload"}</span>
      <span className="am-upload-sub">JPG, PNG - Max 2MB</span>
    </label>
  );
}

/* ---------- Icons (inline SVG, no external deps) ---------- */

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}
function UserBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" strokeLinecap="round" />
      <path d="M16 7h5M16 11h5M16 15h3" strokeLinecap="round" />
    </svg>
  );
}
function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}
function TrainerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4.5 3.6-7 8-7s8 2.5 8 7" strokeLinecap="round" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" strokeLinejoin="round" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M4 5c0 8.3 6.7 15 15 15l3-3.5-5-3-2 2c-2.2-1-4-2.8-5-5l2-2-3-5L4 5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h9l5 5v13H6z" strokeLinejoin="round" />
      <path d="M14 3v6h6M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default AddMember;