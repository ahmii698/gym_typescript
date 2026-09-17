import React, { useState, ChangeEvent, FormEvent } from "react";
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

function AddMember() {
  const [form, setForm] = useState<FormState>(initialState);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInput = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    updateField(field, e.target.value as FormState[typeof field]);
  };

  const handleFile = (field: "cnicFront" | "cnicBack") => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    updateField(field, file);
  };

  const handleReset = () => setForm(initialState);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Wire this up to your API call.
    console.log("New member payload:", form);
  };

  return (
    <div className="am-page">
      <header className="am-header">
        <button type="button" className="am-back-btn" aria-label="Go back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1>Add New Member</h1>
          <p>Fill in the details below to register a new member in the system.</p>
        </div>
      </header>

      <form className="am-grid" onSubmit={handleSubmit}>
        {/* LEFT COLUMN */}
        <div className="am-col">
          <section className="am-card">
            <h2>
              <UserIcon /> Personal Information
            </h2>

            <div className="am-row">
              <Field label="Full Name" required>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={form.fullName}
                  onChange={handleInput("fullName")}
                  required
                />
              </Field>
              <Field label="CNIC" required>
                <input
                  type="text"
                  placeholder="XXXXX-XXXXXXX-X"
                  value={form.cnic}
                  onChange={handleInput("cnic")}
                  required
                />
              </Field>
            </div>

            <div className="am-row">
              <Field label="CNIC Front Image" required>
                <UploadBox file={form.cnicFront} onChange={handleFile("cnicFront")} />
              </Field>
              <Field label="CNIC Back Image" required>
                <UploadBox file={form.cnicBack} onChange={handleFile("cnicBack")} />
              </Field>
            </div>

            <div className="am-row">
              <Field label="Contact Number" required>
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
              <Field label="Email" optional>
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
              <Field label="Date of Birth" optional>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.dob} onChange={handleInput("dob")} placeholder="dd/mm/yyyy" />
                </div>
              </Field>
              <Field label="Gender" optional>
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
              <Field label="Select Package" required>
                <select value={form.package} onChange={handleInput("package")} required>
                  <option value="">Choose Package</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Start Date" required>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.startDate} onChange={handleInput("startDate")} required />
                </div>
              </Field>
            </div>

            <div className="am-row">
              <Field label="Start Date" required>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.startDate} onChange={handleInput("startDate")} required />
                </div>
              </Field>
              <Field label="End Date" optional>
                <div className="am-input-icon">
                  <CalendarIcon />
                  <input type="date" value={form.endDate} onChange={handleInput("endDate")} />
                </div>
              </Field>
            </div>

            <Field label="Notes" optional>
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
              <TrainerIcon /> Assign Trainer <span className="am-optional-tag">(Optional)</span>
            </h2>

            <Field label="Select Trainer">
              <select value={form.trainer} onChange={handleInput("trainer")}>
                <option value="">Choose Trainer</option>
                <option value="trainer-1">Ali Khan</option>
                <option value="trainer-2">Bilal Ahmed</option>
              </select>
            </Field>

            <div className="am-or-divider">
              <span>OR</span>
            </div>

            <button type="button" className="am-add-trainer-btn">
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
              <Field label="Fee Amount">
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
              <Field label="Payment Status">
                <select value={form.paymentStatus} onChange={handleInput("paymentStatus")}>
                  <option value="">Select Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
              </Field>
            </div>

            <div className="am-actions">
              <button type="button" className="am-reset-btn" onClick={handleReset}>
                <ResetIcon /> Reset
              </button>
              <button type="submit" className="am-submit-btn">
                <PlusIcon /> Add Member
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

/* ---------- Small building blocks ---------- */

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="am-field">
      <label>
        {label}
        {required && <span className="am-required">*</span>}
        {optional && <span className="am-optional"> (Optional)</span>}
      </label>
      {children}
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