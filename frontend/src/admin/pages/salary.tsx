import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../../config";
import "./salary.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type StaffKind = "trainer" | "staff" | "frontdesk";

// One row in the table: a trainer, a staff member or a front desk user.
interface Person {
  key: string; // unique across all types, e.g. "trainer-1" / "staff-1" / "frontdesk-1"
  id: number;
  staffType: StaffKind;
  name: string;
  role: string;
  status: string;
  phone: string;
  email: string;
  cnic: string;
  specialization: string;
  experienceYears: number | null;
  baseSalary: number;
  membersCount: number | null; // <-- NAYI LINE (trainer kitnay members train kar raha hai)
}

interface Payment {
  id: number;
  staffId: number;
  staffType: string;
  amount: number;
  commission: number;
  total: number;
  month: number;
  year: number;
  paidOn: string;
  status: "paid" | "pending";
  note: string;
}

interface RowStats {
  paidSalary: number;
  commission: number;
  totalPaid: number;
  remaining: number;
  label: "Paid" | "Partial" | "Unpaid" | "No Salary";
}

const FALLBACK = "—";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v: number) => `Rs ${v.toLocaleString("en-US")}`;

const show = (v: string | null | undefined) => (v && v.trim() ? v : FALLBACK);

const capitalize = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

const pad = (n: number) => String(n).padStart(2, "0");

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const monthLabel = (value: string) => {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

const shortMonth = (m: number, y: number) =>
  `${new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" })} ${y}`;

const mapTrainer = (t: any): Person => ({
  key: `trainer-${t.id}`,
  id: Number(t.id),
  staffType: "trainer",
  name: t.name ?? "",
  role: t.role ?? "",
  status: t.status ?? "",
  phone: t.phone ?? "",
  email: t.email ?? "",
  cnic: t.cnic ?? "",
  specialization: t.specialization ?? "",
  experienceYears: t.experience_years ?? null,
  baseSalary: num(t.base_salary),
  membersCount: Number(t.members_count ?? 0), // <-- NAYI LINE
});

// Staff table uses `salary` (not `base_salary`) and has no cnic / specialization / experience.
const mapStaff = (s: any): Person => ({
  key: `staff-${s.id}`,
  id: Number(s.id),
  staffType: "staff",
  name: s.name ?? "",
  role: s.role ?? "Staff",
  status: capitalize(s.status ?? ""),
  phone: s.phone ?? "",
  email: s.email ?? "",
  cnic: "",
  specialization: "",
  experienceYears: null,
  baseSalary: num(s.salary),
  membersCount: null, // <-- NAYI LINE
});

// Front desk lives in the users table (role = frontdesk) and uses `base_salary`.
const mapFrontdesk = (u: any): Person => ({
  key: `frontdesk-${u.id}`,
  id: Number(u.id),
  staffType: "frontdesk",
  name: u.name ?? "",
  role: "Front Desk",
  status: "Active",
  phone: u.phone ?? "",
  email: u.email ?? "",
  cnic: "",
  specialization: "",
  experienceYears: null,
  baseSalary: num(u.base_salary),
  membersCount: null, // <-- NAYI LINE
});

const mapPayment = (p: any): Payment => ({
  id: Number(p.id),
  staffId: Number(p.staff_id),
  staffType: String(p.staff_type ?? "trainer"),
  amount: num(p.amount),
  commission: num(p.commission),
  total: num(p.amount) + num(p.commission),
  month: Number(p.month),
  year: Number(p.year),
  paidOn: String(p.paid_on ?? "").slice(0, 10),
  status: p.status === "pending" ? "pending" : "paid",
  note: p.note ?? "",
});

const useEscape = (active: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
};

const badgeClass = (label: RowStats["label"]) =>
  label === "Paid" ? "paid" : label === "Partial" ? "partial" : label === "Unpaid" ? "unpaid" : "none";

const detailsTitle = (type: StaffKind) =>
  type === "trainer" ? "Trainer details" : type === "frontdesk" ? "Front desk details" : "Staff details";

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

const Icon = {
  Wallet: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h13v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z" strokeLinejoin="round" />
      <circle cx="16" cy="14" r="1.2" fill="currentColor" />
    </svg>
  ),
  Search: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  ),
  Refresh: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 0-15.5-6.3L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12a9 9 0 0 0 15.5 6.3L21 16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Eye: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  Plus: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Close: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Pay modal (salary + commission)                                      */
/* ------------------------------------------------------------------ */

interface PayModalProps {
  trainer: Person;
  monthValue: string;
  paidSalary: number;
  onClose: () => void;
  onSaved: () => void;
}

const PayModal: React.FC<PayModalProps> = ({ trainer, monthValue, paidSalary, onClose, onSaved }) => {
  const remaining = Math.max(0, trainer.baseSalary - paidSalary);

  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [commission, setCommission] = useState("");
  const [paidOn, setPaidOn] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEscape(true, onClose);

  const amountNum = amount.trim() === "" ? 0 : Number(amount);
  const commissionNum = commission.trim() === "" ? 0 : Number(commission);
  const previewTotal =
    (Number.isFinite(amountNum) ? amountNum : 0) + (Number.isFinite(commissionNum) ? commissionNum : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(amountNum) || amountNum < 0) return setError("Enter a valid salary amount.");
    if (!Number.isFinite(commissionNum) || commissionNum < 0) return setError("Enter a valid commission amount.");
    if (amountNum + commissionNum <= 0) return setError("Enter a salary or a commission amount.");
    if (!paidOn) return setError("Please select the payment date.");
    if (trainer.baseSalary > 0 && amountNum > remaining) {
      return setError(`Salary cannot be more than the remaining ${money(remaining)}.`);
    }

    const [y, m] = monthValue.split("-").map(Number);

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/salary-payments`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: trainer.id,
          staff_type: trainer.staffType,
          amount: amountNum,
          commission: commissionNum,
          month: m,
          year: y,
          paid_on: paidOn,
          status: "paid",
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (!res.ok) throw new Error(json?.message ?? "Payment could not be saved.");

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sal-backdrop" onMouseDown={onClose}>
      <div className="sal-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sal-modal__head">
          <div>
            <h2>Pay salary</h2>
            <p>
              {trainer.name} · {monthLabel(monthValue)}
            </p>
          </div>
          <button type="button" className="sal-modal__close" onClick={onClose} aria-label="Close">
            <Icon.Close />
          </button>
        </header>

        <form className="sal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="sal-form__error">{error}</div>}

          <div className="sal-info">
            <div>
              <span>Monthly salary</span>
              <strong>{trainer.baseSalary > 0 ? money(trainer.baseSalary) : "Not set"}</strong>
            </div>
            <div>
              <span>Already paid</span>
              <strong>{money(paidSalary)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{trainer.baseSalary > 0 ? money(remaining) : FALLBACK}</strong>
            </div>
          </div>

          <div className="sal-field-row">
            <div className="sal-field">
              <label htmlFor="sal-amount">Salary (Rs)</label>
              <input
                id="sal-amount"
                type="number"
                min="0"
                step="any"
                placeholder="15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="sal-field">
              <label htmlFor="sal-commission">Commission (Rs)</label>
              <input
                id="sal-commission"
                type="number"
                min="0"
                step="any"
                placeholder="Optional"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>
          </div>

          <div className="sal-total">
            <span>Total to pay</span>
            <strong>{money(previewTotal)}</strong>
          </div>

          <div className="sal-field">
            <label htmlFor="sal-date">Payment date</label>
            <input id="sal-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>

          <div className="sal-field">
            <label htmlFor="sal-note">Note (optional)</label>
            <input
              id="sal-note"
              type="text"
              maxLength={255}
              placeholder="e.g. Cash given by admin"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <footer className="sal-modal__foot">
            <button type="button" className="sal-btn sal-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="sal-btn sal-btn--primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save payment"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* View modal (all data + payment history)                              */
/* ------------------------------------------------------------------ */

interface ViewModalProps {
  trainer: Person;
  monthValue: string;
  stats: RowStats;
  onClose: () => void;
}

const ViewModal: React.FC<ViewModalProps> = ({ trainer, monthValue, stats, onClose }) => {
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEscape(true, onClose);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/salary-payments?staff_type=${trainer.staffType}&staff_id=${trainer.id}`,
          { headers: authHeaders() }
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setHistory((json.data ?? []).map(mapPayment));
      } catch {
        if (!cancelled) setError("Failed to load payment history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [trainer.id, trainer.staffType]);

  const details: Array<[string, string]> = [
    ["Role", show(trainer.role)],
    ["Status", show(trainer.status)],
    ["Phone", show(trainer.phone)],
    ["Email", show(trainer.email)],
  ];

  // These fields only exist for trainers.
  if (trainer.staffType === "trainer") {
    details.push(
      ["CNIC", show(trainer.cnic)],
      ["Specialization", show(trainer.specialization)],
      ["Experience", trainer.experienceYears != null ? `${trainer.experienceYears} Years` : FALLBACK],
      ["Members Training", String(trainer.membersCount ?? 0)] // <-- NAYI LINE
    );
  }

  details.push(["Monthly Salary", trainer.baseSalary > 0 ? money(trainer.baseSalary) : FALLBACK]);

  const lifetimeTotal = history.filter((p) => p.status === "paid").reduce((s, p) => s + p.total, 0);

  return (
    <div className="sal-backdrop" onMouseDown={onClose}>
      <div className="sal-modal sal-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sal-modal__head">
          <div>
            <h2>{trainer.name || FALLBACK}</h2>
            <p>{show(trainer.role)}</p>
          </div>
          <button type="button" className="sal-modal__close" onClick={onClose} aria-label="Close">
            <Icon.Close />
          </button>
        </header>

        <div className="sal-view">
          <section>
            <h3 className="sal-view__title">{detailsTitle(trainer.staffType)}</h3>
            <div className="sal-view__grid">
              {details.map(([label, value]) => (
                <div key={label} className="sal-view__row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="sal-view__title">{monthLabel(monthValue)}</h3>
            <div className="sal-info">
              <div>
                <span>Salary paid</span>
                <strong>{money(stats.paidSalary)}</strong>
              </div>
              <div>
                <span>Commission</span>
                <strong>{money(stats.commission)}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>{money(stats.totalPaid)}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{trainer.baseSalary > 0 ? money(stats.remaining) : FALLBACK}</strong>
              </div>
            </div>
          </section>

          <section>
            <h3 className="sal-view__title">
              Payment history
              {!loading && !error && history.length > 0 && (
                <small>All time total: {money(lifetimeTotal)}</small>
              )}
            </h3>

            {loading ? (
              <p className="sal-muted">Loading history...</p>
            ) : error ? (
              <p className="sal-muted">{error}</p>
            ) : history.length === 0 ? (
              <p className="sal-muted">No payments recorded yet.</p>
            ) : (
              <div className="sal-table-wrap sal-table-wrap--inner">
                <table className="sal-table sal-table--compact">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Month</th>
                      <th>Salary</th>
                      <th>Commission</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.id}>
                        <td>{show(p.paidOn)}</td>
                        <td>{shortMonth(p.month, p.year)}</td>
                        <td>{money(p.amount)}</td>
                        <td>{p.commission > 0 ? money(p.commission) : FALLBACK}</td>
                        <td className="sal-strong">{money(p.total)}</td>
                        <td>
                          <span className={`sal-badge sal-badge--${p.status === "paid" ? "paid" : "partial"}`}>
                            {p.status === "paid" ? "Paid" : "Pending"}
                          </span>
                        </td>
                        <td>{show(p.note)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <footer className="sal-modal__foot">
          <button type="button" className="sal-btn sal-btn--primary" onClick={onClose}>
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

const Salary: React.FC = () => {
  const [monthValue, setMonthValue] = useState(todayStr().slice(0, 7));
  const [people, setPeople] = useState<Person[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [payTarget, setPayTarget] = useState<Person | null>(null);
  const [viewTarget, setViewTarget] = useState<Person | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [y, m] = monthValue.split("-").map(Number);
    try {
      const [trainersRes, staffRes, frontdeskRes, paymentsRes] = await Promise.all([
        fetch(`${API_URL}/trainers`, { headers: authHeaders() }),
        fetch(`${API_URL}/staff`, { headers: authHeaders() }),
        fetch(`${API_URL}/salary-frontdesk`, { headers: authHeaders() }),
        // No staff_type filter: we need trainer, staff AND frontdesk payments for this month.
        fetch(`${API_URL}/salary-payments?month=${m}&year=${y}`, { headers: authHeaders() }),
      ]);

      if (
        trainersRes.status === 401 ||
        staffRes.status === 401 ||
        frontdeskRes.status === 401 ||
        paymentsRes.status === 401
      ) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      if (!trainersRes.ok || !staffRes.ok || !frontdeskRes.ok || !paymentsRes.ok) throw new Error();

      const trainersJson = await trainersRes.json();
      const staffJson = await staffRes.json();
      const frontdeskJson = await frontdeskRes.json();
      const paymentsJson = await paymentsRes.json();

      const trainerRows = (Array.isArray(trainersJson) ? trainersJson : trainersJson.data ?? []).map(mapTrainer);
      const staffRows = (Array.isArray(staffJson) ? staffJson : staffJson.data ?? []).map(mapStaff);
      const frontdeskRows = (frontdeskJson.data ?? []).map(mapFrontdesk);

      setPeople([...trainerRows, ...staffRows, ...frontdeskRows]);
      setPayments((paymentsJson.data ?? []).map(mapPayment));
    } catch {
      setError("Failed to load salary data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    load();
  }, [load]);

  const statsFor = useCallback(
    (t: Person): RowStats => {
      // Match on BOTH id and type, because trainer #1, staff #1 and frontdesk #1 can exist together.
      const mine = payments.filter((p) => p.staffId === t.id && p.staffType === t.staffType && p.status === "paid");
      const paidSalary = mine.reduce((s, p) => s + p.amount, 0);
      const commission = mine.reduce((s, p) => s + p.commission, 0);
      const remaining = Math.max(0, t.baseSalary - paidSalary);

      let label: RowStats["label"];
      if (t.baseSalary <= 0 && mine.length === 0) label = "No Salary";
      else if (t.baseSalary > 0 && paidSalary >= t.baseSalary) label = "Paid";
      else if (paidSalary > 0 || commission > 0) label = "Partial";
      else label = "Unpaid";

      return { paidSalary, commission, totalPaid: paidSalary + commission, remaining, label };
    },
    [payments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (t) => t.name.toLowerCase().includes(q) || t.phone.toLowerCase().includes(q) || t.role.toLowerCase().includes(q)
    );
  }, [people, search]);

  const totals = useMemo(() => {
    let budget = 0;
    let salary = 0;
    let commission = 0;
    people.forEach((t) => {
      const s = statsFor(t);
      budget += t.baseSalary;
      salary += s.paidSalary;
      commission += s.commission;
    });
    return { budget, salary, commission, total: salary + commission };
  }, [people, statsFor]);

  const handleSaved = () => {
    setPayTarget(null);
    load();
  };

  return (
    <div className="sal-page">
      <header className="sal-header">
        <div className="sal-header__left">
          <span className="sal-header__icon">
            <Icon.Wallet />
          </span>
          <div>
            <h1>Salary</h1>
            <p>Trainers, staff and front desk salary and commission for {monthLabel(monthValue)}</p>
          </div>
        </div>

        <div className="sal-header__right">
          <input
            type="month"
            className="sal-month"
            value={monthValue}
            onChange={(e) => e.target.value && setMonthValue(e.target.value)}
            aria-label="Select month"
          />
          <button type="button" className="sal-btn sal-btn--ghost" onClick={load} disabled={loading}>
            <Icon.Refresh />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="sal-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <section className="sal-cards">
        <div className="sal-card">
          <span>Total Employees</span>
          <strong>{people.length}</strong>
        </div>
        <div className="sal-card">
          <span>Monthly Salary Budget</span>
          <strong>{money(totals.budget)}</strong>
        </div>
        <div className="sal-card">
          <span>Salary Paid</span>
          <strong>{money(totals.salary)}</strong>
        </div>
        <div className="sal-card">
          <span>Commission Paid</span>
          <strong>{money(totals.commission)}</strong>
        </div>
        <div className="sal-card sal-card--accent">
          <span>Total Paid</span>
          <strong>{money(totals.total)}</strong>
        </div>
      </section>

      <section className="sal-toolbar">
        <div className="sal-search">
          <Icon.Search />
          <input
            type="search"
            placeholder="Search by name, phone, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search employees"
          />
        </div>
      </section>

      <div className="sal-table-wrap">
        {loading ? (
          <div className="sal-empty">
            <h3>Loading salary data...</h3>
            <p>Please wait while the data loads.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sal-empty">
            <h3>No employees found</h3>
            <p>Add trainers, staff or front desk from the Employees page to see them here.</p>
          </div>
        ) : (
          <table className="sal-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Monthly Salary</th>
                <th>Salary Paid</th>
                <th>Commission</th>
                <th>Total Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th className="sal-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const s = statsFor(t);
                return (
                  <tr key={t.key}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="sal-name">
                        <strong>{t.name || FALLBACK}</strong>
                        {/* BADLA HUA: trainer ke neeche role ke saath members count bhi dikhega */}
                        <span>
                          {show(t.role)}
                          {t.staffType === "trainer" &&
                            ` · ${t.membersCount ?? 0} ${(t.membersCount ?? 0) === 1 ? "member" : "members"}`}
                        </span>
                      </div>
                    </td>
                    <td>{t.baseSalary > 0 ? money(t.baseSalary) : FALLBACK}</td>
                    <td>{money(s.paidSalary)}</td>
                    <td>{s.commission > 0 ? money(s.commission) : FALLBACK}</td>
                    <td className="sal-strong">{money(s.totalPaid)}</td>
                    <td>{t.baseSalary > 0 ? money(s.remaining) : FALLBACK}</td>
                    <td>
                      <span className={`sal-badge sal-badge--${badgeClass(s.label)}`}>{s.label}</span>
                    </td>
                    <td>
                      <div className="sal-actions">
                        <button type="button" className="sal-btn sal-btn--sm sal-btn--outline" onClick={() => setViewTarget(t)}>
                          <Icon.Eye />
                          View
                        </button>
                        <button type="button" className="sal-btn sal-btn--sm sal-btn--primary" onClick={() => setPayTarget(t)}>
                          <Icon.Plus />
                          Pay
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="sal-footer">
          Showing {filtered.length} of {people.length} employees
        </p>
      )}

      {payTarget && (
        <PayModal
          trainer={payTarget}
          monthValue={monthValue}
          paidSalary={statsFor(payTarget).paidSalary}
          onClose={() => setPayTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {viewTarget && (
        <ViewModal
          trainer={viewTarget}
          monthValue={monthValue}
          stats={statsFor(viewTarget)}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
};

export default Salary;