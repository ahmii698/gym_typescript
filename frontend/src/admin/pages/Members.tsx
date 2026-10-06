import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Dumbbell,
  Calendar,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Edit,
  DollarSign,
  History,
  RefreshCw,
  Receipt,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./Members.css";

/* ---------------------------- Types & config ---------------------------- */

type Status = "Active" | "On Leave" | "Inactive";
type Kind = "Trainer" | "Front Desk";
type Tab = "All" | "Trainers" | "Front Desk";
type StatusFilter = "All Status" | Status;
type FilterMode = "date" | "month";

interface Staff {
  id: number;
  key: string;
  name: string;
  phone: string;
  email: string;
  kind: Kind;
  role: string;
  specialization: string;
  experience: string;
  status: Status;
  base_salary: number;
  staff_type: "trainer" | "frontdesk";
}

interface SalaryPayment {
  id: number;
  staff_id: number;
  staff_type: "trainer" | "frontdesk";
  amount: number;
  month: number;
  year: number;
  paid_on: string;
  status: "paid" | "pending";
  note?: string;
  is_settled?: boolean | number;
}

interface Summary {
  total_budget: number;
  trainer_budget: number;
  frontdesk_budget: number;
  paid_this_month: number;
  pending_this_month: number;
  month: number;
  year: number;
}

// Cards ka data (date / month filter ke hisaab se)
interface PeriodStats {
  total_staff: number;
  trainers: number;
  frontdesk: number;
  budget: number;
  paid: number;
}

const TOKEN_KEY = "token";

const TABS: { key: Tab; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Trainers", label: "Trainers" },
  { key: "Front Desk", label: "Front Desk" },
];

const STATUS_OPTIONS: StatusFilter[] = ["All Status", "Active", "On Leave", "Inactive"];
const PAGE_SIZE = 10;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ------------------------------ Helpers ------------------------------ */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatDate = (d: Date) =>
  `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${
    MONTHS[d.getMonth()]
  } ${d.getFullYear()}`;

const formatTime = (d: Date) => {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${h12}:${mm} ${h >= 12 ? "PM" : "AM"}`;
};

const formatPrice = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return "Rs 0";
  return `Rs ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toMonthInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const extractList = (json: any): any[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.trainers)) return json.trainers;
  return [];
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Reset (settled) hui payment ya nahi
const isSettled = (p: SalaryPayment): boolean => Boolean(Number(p.is_settled));

// Pay Salary ke liye default month/year:
// Agar is staff ka koi month closed (refresh) ho chuka hai aur wo current month
// ya us se aage ka hai, to automatically uske agle month pe set hoga.
const getDefaultPeriod = (staffPayments: SalaryPayment[]): { month: number; year: number } => {
  const now = new Date();
  let idx = now.getFullYear() * 12 + now.getMonth(); // month 0-based

  let latestSettled = -1;
  staffPayments.forEach((p) => {
    if (!isSettled(p)) return;
    const pIdx = Number(p.year) * 12 + (Number(p.month) - 1);
    if (pIdx > latestSettled) latestSettled = pIdx;
  });

  if (latestSettled >= idx) idx = latestSettled + 1;

  return { month: (idx % 12) + 1, year: Math.floor(idx / 12) };
};

const normalizeTrainer = (t: any): Staff => {
  const raw = String(t.status ?? "Active").trim().toLowerCase();
  const flagOff =
    typeof t.is_active !== "undefined" && !(Number(t.is_active) === 1 || t.is_active === true);

  let status: Status = "Active";
  if (flagOff || raw === "inactive") status = "Inactive";
  else if (raw === "on leave") status = "On Leave";

  const years = t.experience_years;

  return {
    id: Number(t.id),
    key: `trainer-${t.id}`,
    name: t.name ?? "",
    phone: t.phone ?? "",
    email: t.email ?? "",
    kind: "Trainer",
    role: t.role || "Fitness Trainer",
    specialization: t.specialization || "—",
    experience: years === null || typeof years === "undefined" || years === "" ? "—" : `${years} yrs`,
    status,
    base_salary: Number(t.base_salary ?? 0),
    staff_type: "trainer",
  };
};

const normalizeFrontdesk = (u: any): Staff => {
  const raw = String(u.status ?? "Active").trim().toLowerCase();
  const flagOff =
    typeof u.is_active !== "undefined" && !(Number(u.is_active) === 1 || u.is_active === true);

  let status: Status = "Active";
  if (flagOff || raw === "inactive") status = "Inactive";
  else if (raw === "on leave") status = "On Leave";

  return {
    id: Number(u.id),
    key: `frontdesk-${u.id}`,
    name: u.name ?? u.full_name ?? "",
    phone: u.phone ?? u.contact_number ?? "",
    email: u.email ?? "",
    kind: "Front Desk",
    role: "Front Desk",
    specialization: "—",
    experience: "—",
    status,
    base_salary: Number(u.base_salary ?? 0),
    staff_type: "frontdesk",
  };
};

/* ------------------------------ Component ------------------------------ */

const BOTTOM_GAP = 24;

const Members = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All Status");
  const [page, setPage] = useState(1);

  // Cards ka date / month filter
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [filterDate, setFilterDate] = useState(toDateInput(new Date()));
  const [filterMonth, setFilterMonth] = useState(toMonthInput(new Date()));
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);

  // Modals
  const [editSalaryFor, setEditSalaryFor] = useState<Staff | null>(null);
  const [payFor, setPayFor] = useState<Staff | null>(null);
  const [historyFor, setHistoryFor] = useState<Staff | null>(null);
  const [totalRecordFor, setTotalRecordFor] = useState<Staff | null>(null);

  // Refresh state
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);

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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  /* ---------- Load Staff ---------- */
  const loadStaff = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [trainersRes, frontdeskRes] = await Promise.all([
        fetch(`${API_URL}/trainers`, { signal, headers: authHeaders() }),
        fetch(`${API_URL}/staff/frontdesk`, { signal, headers: authHeaders() }),
      ]);

      if (trainersRes.status === 401 || frontdeskRes.status === 401) {
        throw new Error("Session expire ho gaya, dobara login karo.");
      }
      if (!trainersRes.ok) throw new Error(`Trainers load nahi huay (${trainersRes.status}).`);
      if (!frontdeskRes.ok) throw new Error(`Front desk load nahi hua (${frontdeskRes.status}).`);

      const trainers = extractList(await trainersRes.json()).map(normalizeTrainer);
      const frontdesk = extractList(await frontdeskRes.json()).map(normalizeFrontdesk);

      const all = [...trainers, ...frontdesk].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setStaff(all);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Kuch ghalat ho gaya.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  /* ---------- Load Payments & Summary ---------- */
  const loadPayments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/salary-payments`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setPayments(json.data ?? []);
    } catch {}
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/salary-summary`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setSummary(json.data);
    } catch {}
  }, []);

  /* ---------- Load Cards Stats (date / month filter) ---------- */
  const loadStats = useCallback(async () => {
    try {
      const qs =
        filterMode === "date"
          ? `mode=date&date=${filterDate}`
          : `mode=month&month=${filterMonth}`;
      const res = await fetch(`${API_URL}/staff-stats?${qs}`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setPeriodStats(json.data);
    } catch {}
  }, [filterMode, filterDate, filterMonth]);

  useEffect(() => {
    const controller = new AbortController();
    loadStaff(controller.signal);
    loadPayments();
    loadSummary();
    return () => controller.abort();
  }, [loadStaff, loadPayments, loadSummary, reloadKey]);

  useEffect(() => {
    loadStats();
  }, [loadStats, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, statusFilter]);

  /* ---------- Stats Cards ---------- */
  const stats = useMemo(() => {
    const [y, m, d] = (filterMode === "date" ? filterDate : `${filterMonth}-01`)
      .split("-")
      .map(Number);

    const periodLabel =
      filterMode === "date"
        ? `${d} ${MONTH_NAMES[m - 1]} ${y}`
        : `${MONTH_NAMES[m - 1]} ${y}`;

    const totalStaff = periodStats?.total_staff ?? 0;
    const trainers = periodStats?.trainers ?? 0;
    const frontdesk = periodStats?.frontdesk ?? 0;

    return [
      {
        id: "total",
        title: "Total Staff",
        period: "Trainers + Front Desk",
        value: String(totalStaff),
        variant: "red",
        icon: <Users size={26} />,
      },
      {
        id: "trainers",
        title: "Trainers",
        period: "Fitness team",
        value: String(trainers),
        variant: "green",
        icon: <Dumbbell size={26} />,
      },
      {
        id: "frontdesk",
        title: "Front Desk",
        period: "Reception team",
        value: String(frontdesk),
        variant: "amber",
        icon: <UserCheck size={26} />,
      },
      {
        id: "budget",
        title: "Monthly Budget",
        period: "Total Salary",
        value: formatPrice(periodStats?.budget ?? 0),
        variant: "red",
        icon: <Wallet size={26} />,
      },
      {
        id: "paid",
        title: filterMode === "date" ? "Paid Till Date" : "Paid This Month",
        period: periodLabel,
        value: formatPrice(periodStats?.paid ?? 0),
        variant: "green",
        icon: <DollarSign size={26} />,
      },
    ];
  }, [periodStats, filterMode, filterDate, filterMonth]);

  /* ---------- Helper: is month ki paid salary (settled + unsettled, sab) ---------- */
  const getPaidThisMonth = useCallback(
    (staffId: number, staffType: "trainer" | "frontdesk") => {
      const currentMonth = summary?.month ?? new Date().getMonth() + 1;
      const currentYear = summary?.year ?? new Date().getFullYear();

      return payments
        .filter(
          (p) =>
            p.staff_id === staffId &&
            p.staff_type === staffType &&
            p.month === currentMonth &&
            p.year === currentYear &&
            p.status === "paid"
        )
        .reduce((sum, p) => sum + Number(p.amount), 0);
    },
    [payments, summary]
  );

  /* ---------- Filtering + pagination ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (tab === "Trainers" && s.kind !== "Trainer") return false;
      if (tab === "Front Desk" && s.kind !== "Front Desk") return false;
      if (statusFilter !== "All Status" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.specialization.toLowerCase().includes(q)
      );
    });
  }, [staff, tab, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  /* ---------- Save Base Salary ---------- */
  const saveBaseSalary = async (staffId: number, type: "trainer" | "frontdesk", amount: number) => {
    const res = await fetch(`${API_URL}/salary-base/update`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ staff_id: staffId, staff_type: type, base_salary: amount }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? "Salary update nahi ho saki");
    setReloadKey((k) => k + 1);
  };

  /* ---------- Record Payment ---------- */
  const recordPayment = async (payload: {
    staff_id: number;
    staff_type: "trainer" | "frontdesk";
    amount: number;
    month: number;
    year: number;
    paid_on: string;
    status: "paid" | "pending";
    note?: string;
  }) => {
    const res = await fetch(`${API_URL}/salary-payments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? "Payment record nahi ho saki");
    await Promise.all([loadPayments(), loadSummary(), loadStats()]);
  };

  /* ---------- Delete Payment ---------- */
  const deletePayment = async (id: number) => {
    if (!window.confirm("Yeh payment delete karni hai?")) return;
    const res = await fetch(`${API_URL}/salary-payments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) return alert("Delete nahi ho saki");
    await Promise.all([loadPayments(), loadSummary(), loadStats()]);
  };

  /* ---------- Refresh Salary (current month reset — record safe rehta hai) ---------- */
  const refreshSalary = async (s: Staff) => {
    const confirmed = window.confirm(
      `${s.name} ki is month ki salary reset karni hai? (Purana record Total Record mein safe rahega)`
    );
    if (!confirmed) return;

    setRefreshingKey(s.key);
    try {
      const res = await fetch(`${API_URL}/salary-refresh`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ staff_id: s.id, staff_type: s.staff_type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Refresh nahi ho saka");

      await Promise.all([loadPayments(), loadSummary(), loadStats()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refresh nahi ho saka");
    } finally {
      setRefreshingKey(null);
    }
  };

  return (
    <div
      className="members-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="mem-header">
        <div>
          <h1 className="mem-title">Staff</h1>
          <p className="mem-subtitle">View all trainers and front desk staff with salary management.</p>
        </div>

        <div className="mem-datetime">
          <div className="mem-datetime-text">
            <span className="mem-date">{formatDate(now)}</span>
            <span className="mem-time">{formatTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Date / Month filter (cards ke liye) */}
      <div className="mem-filter-bar">
        <div className="mem-filter-toggle">
          <button
            type="button"
            className={`mem-filter-btn ${filterMode === "date" ? "active" : ""}`}
            onClick={() => setFilterMode("date")}
          >
            Sort by Date
          </button>
          <button
            type="button"
            className={`mem-filter-btn ${filterMode === "month" ? "active" : ""}`}
            onClick={() => setFilterMode("month")}
          >
            Sort by Month
          </button>
        </div>

        {filterMode === "date" ? (
          <input
            type="date"
            className="mem-filter-input"
            value={filterDate}
            onChange={(e) => e.target.value && setFilterDate(e.target.value)}
          />
        ) : (
          <input
            type="month"
            className="mem-filter-input"
            value={filterMonth}
            onChange={(e) => e.target.value && setFilterMonth(e.target.value)}
          />
        )}

        <button
          type="button"
          className="mem-filter-btn"
          onClick={() => {
            setFilterDate(toDateInput(new Date()));
            setFilterMonth(toMonthInput(new Date()));
            setFilterMode("month");
          }}
        >
          Current Month
        </button>
      </div>

      {/* Stat cards */}
      <div className="mem-stats">
        {stats.map((s) => (
          <div key={s.id} className="mem-stat-card">
            <div className={`mem-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="mem-stat-info">
              <span className="mem-stat-title">{s.title}</span>
              <span className="mem-stat-period">{s.period}</span>
              <span className="mem-stat-value">{loading ? "—" : s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="mem-panel">
        {/* Toolbar */}
        <div className="mem-toolbar">
          <div className="mem-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`mem-tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mem-toolbar-right">
            <div className="mem-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone, email or specialization..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="mem-select-wrap">
              <select
                className="mem-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                {STATUS_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="mem-select-icon" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mem-table-wrap">
          <table className="mem-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Role</th>
                <th>Specialization</th>
                <th className="center">Salary</th>
                <th className="center">Remaining</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="mem-empty">
                    Loading staff...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="mem-empty mem-error">
                    <div>{error}</div>
                    <button
                      type="button"
                      className="mem-retry"
                      onClick={() => setReloadKey((k) => k + 1)}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="mem-empty">
                    No staff found.
                  </td>
                </tr>
              ) : (
                rows.map((s, i) => {
                  const paid = getPaidThisMonth(s.id, s.staff_type);
                  const remaining = Math.max(0, s.base_salary - paid);
                  const isFullyPaid = s.base_salary > 0 && remaining === 0;
                  const isRefreshing = refreshingKey === s.key;

                  return (
                    <tr key={s.key}>
                      <td className="muted">{startIdx + i + 1}</td>
                      <td className="member-name">{s.name}</td>
                      <td>{s.phone || "—"}</td>
                      <td>{s.email || "—"}</td>
                      <td>{s.role}</td>
                      <td>{s.specialization}</td>
                      <td className="center salary-cell">{formatPrice(s.base_salary)}</td>
                      <td className={`center remaining-cell ${isFullyPaid ? "paid" : ""}`}>
                        {isFullyPaid ? "Fully Paid" : formatPrice(remaining)}
                      </td>
                      <td className="center">
                        <span className={`mem-status ${s.status.toLowerCase().replace(" ", "-")}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="center">
                        <div className="mem-actions">
                          <button
                            type="button"
                            className="mem-action-btn"
                            onClick={() => setEditSalaryFor(s)}
                            title="Edit Salary"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="mem-action-btn pay"
                            onClick={() => setPayFor(s)}
                            title="Pay Salary"
                          >
                            <DollarSign size={15} />
                          </button>
                          <button
                            type="button"
                            className="mem-action-btn"
                            onClick={() => setHistoryFor(s)}
                            title="Salary History (Current Month)"
                          >
                            <History size={15} />
                          </button>
                          <button
                            type="button"
                            className="mem-action-btn total"
                            onClick={() => setTotalRecordFor(s)}
                            title="Total Record (Lifetime)"
                          >
                            <Receipt size={15} />
                          </button>
                          <button
                            type="button"
                            className={`mem-action-btn refresh ${isRefreshing ? "spinning" : ""}`}
                            onClick={() => refreshSalary(s)}
                            disabled={isRefreshing}
                            title="Refresh (Reset current month salary)"
                          >
                            <RefreshCw size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="mem-footer">
          <span className="mem-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </span>

          <div className="mem-pagination">
            <button
              type="button"
              className="mem-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="mem-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`mem-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="mem-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {editSalaryFor && (
        <EditSalaryModal
          staff={editSalaryFor}
          onClose={() => setEditSalaryFor(null)}
          onSave={saveBaseSalary}
        />
      )}

      {payFor && (
        <PaySalaryModal
          staff={payFor}
          payments={payments.filter(
            (p) => p.staff_id === payFor.id && p.staff_type === payFor.staff_type
          )}
          onClose={() => setPayFor(null)}
          onSave={recordPayment}
        />
      )}

      {/* History Modal — Monthly (sirf current/unsettled payments) */}
      {historyFor && (
        <HistoryModal
          staff={historyFor}
          payments={payments.filter(
            (p) =>
              p.staff_id === historyFor.id &&
              p.staff_type === historyFor.staff_type &&
              !isSettled(p)
          )}
          onClose={() => setHistoryFor(null)}
          onDelete={deletePayment}
        />
      )}

      {/* Total Record Modal — Lifetime (settled + unsettled, sab kuch) */}
      {totalRecordFor && (
        <TotalRecordModal
          staff={totalRecordFor}
          payments={payments.filter(
            (p) => p.staff_id === totalRecordFor.id && p.staff_type === totalRecordFor.staff_type
          )}
          onClose={() => setTotalRecordFor(null)}
          onDelete={deletePayment}
        />
      )}
    </div>
  );
};

export default Members;

/* =========================================================
   Sub-Components (Modals)
   ========================================================= */

/* ---------- Edit Salary Modal ---------- */
function EditSalaryModal({
  staff,
  onClose,
  onSave,
}: {
  staff: Staff;
  onClose: () => void;
  onSave: (id: number, type: "trainer" | "frontdesk", amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(staff.base_salary));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (isNaN(value) || value < 0) {
      setError("Valid amount likhein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(staff.id, staff.staff_type, value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save nahi ho saka");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mem-modal-overlay" onClick={onClose}>
      <div className="mem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mem-modal-head">
          <h2>Edit Salary — {staff.name}</h2>
          <button type="button" onClick={onClose} className="mem-icon-btn">
            <X size={16} />
          </button>
        </div>
        <form className="mem-modal-body" onSubmit={submit}>
          {error && <div className="mem-modal-error">{error}</div>}
          <div className="mem-field">
            <label>Base Salary (PKR per month)</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mem-modal-foot">
            <button type="button" className="mem-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mem-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Pay Salary Modal ---------- */
function PaySalaryModal({
  staff,
  payments,
  onClose,
  onSave,
}: {
  staff: Staff;
  payments: SalaryPayment[];
  onClose: () => void;
  onSave: (payload: {
    staff_id: number;
    staff_type: "trainer" | "frontdesk";
    amount: number;
    month: number;
    year: number;
    paid_on: string;
    status: "paid" | "pending";
    note?: string;
  }) => Promise<void>;
}) {
  const today = new Date();
  // Closed (refresh) month ke baad automatically agla month default hoga
  const defaultPeriod = getDefaultPeriod(payments);

  const [amount, setAmount] = useState(String(staff.base_salary));
  const [month, setMonth] = useState(defaultPeriod.month);
  const [year, setYear] = useState(defaultPeriod.year);
  const [paidOn, setPaidOn] = useState(today.toISOString().slice(0, 10));
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (isNaN(value) || value < 0) {
      setError("Valid amount likhein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        staff_id: staff.id,
        staff_type: staff.staff_type,
        amount: value,
        month,
        year,
        paid_on: paidOn,
        status,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Record nahi ho saka");
    } finally {
      setSaving(false);
    }
  };

  // Pichle 4 saal + agla saal (Dec ke baad Jan ke liye)
  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() + 1 - i);
  if (!years.includes(defaultPeriod.year)) years.unshift(defaultPeriod.year);

  return (
    <div className="mem-modal-overlay" onClick={onClose}>
      <div className="mem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mem-modal-head">
          <h2>Pay Salary — {staff.name}</h2>
          <button type="button" onClick={onClose} className="mem-icon-btn">
            <X size={16} />
          </button>
        </div>
        <form className="mem-modal-body" onSubmit={submit}>
          {error && <div className="mem-modal-error">{error}</div>}

          <div className="mem-form-row">
            <div className="mem-field">
              <label>Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="mem-field">
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mem-field">
            <label>Amount (PKR)</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="mem-form-row">
            <div className="mem-field">
              <label>Paid On</label>
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <div className="mem-field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "paid" | "pending")}
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="mem-field">
            <label>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bonus included"
            />
          </div>

          <div className="mem-modal-foot">
            <button type="button" className="mem-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mem-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- History Modal (monthly — current/unsettled payments) ---------- */
function HistoryModal({
  staff,
  payments,
  onClose,
  onDelete,
}: {
  staff: Staff;
  payments: SalaryPayment[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const sorted = [...payments].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return b.id - a.id;
  });

  return (
    <div className="mem-modal-overlay" onClick={onClose}>
      <div className="mem-modal mem-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="mem-modal-head">
          <h2>Salary History — {staff.name}</h2>
          <button type="button" onClick={onClose} className="mem-icon-btn">
            <X size={16} />
          </button>
        </div>
        <div className="mem-modal-body">
          {sorted.length === 0 ? (
            <p className="mem-empty" style={{ padding: "20px 0" }}>
              Abhi tak koi salary record nahi hai.
            </p>
          ) : (
            <div className="mem-history-wrap">
              <table className="mem-history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Month</th>
                    <th>Year</th>
                    <th className="center">Amount</th>
                    <th className="center">Paid On</th>
                    <th className="center">Status</th>
                    <th className="center">Note</th>
                    <th className="center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr key={p.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{MONTH_NAMES[p.month - 1]}</td>
                      <td>{p.year}</td>
                      <td className="center salary-cell">{formatPrice(p.amount)}</td>
                      <td className="center">{p.paid_on?.slice(0, 10)}</td>
                      <td className="center">
                        <span className={`mem-status ${p.status === "paid" ? "active" : "on-leave"}`}>
                          {p.status === "paid" ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="center muted">{p.note || "—"}</td>
                      <td className="center">
                        <button
                          type="button"
                          className="mem-action-btn"
                          onClick={() => onDelete(p.id)}
                          title="Delete"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Total Record Modal (Lifetime — reset wali payments bhi) ---------- */
function TotalRecordModal({
  staff,
  payments,
  onClose,
  onDelete,
}: {
  staff: Staff;
  payments: SalaryPayment[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const sorted = [...payments].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return b.id - a.id;
  });

  const totalPaid = sorted
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalPending = sorted
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const grandTotal = totalPaid + totalPending;

  // Month-wise totals calculate karein
  const monthTotals: Record<string, { month: number; year: number; paid: number; pending: number }> = {};
  sorted.forEach((p) => {
    const key = `${p.year}-${p.month}`;
    if (!monthTotals[key]) {
      monthTotals[key] = { month: p.month, year: p.year, paid: 0, pending: 0 };
    }
    if (p.status === "paid") {
      monthTotals[key].paid += Number(p.amount);
    } else {
      monthTotals[key].pending += Number(p.amount);
    }
  });

  return (
    <div className="mem-modal-overlay" onClick={onClose}>
      <div className="mem-modal mem-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="mem-modal-head">
          <h2>Total Salary Record — {staff.name}</h2>
          <button type="button" onClick={onClose} className="mem-icon-btn">
            <X size={16} />
          </button>
        </div>
        <div className="mem-modal-body">
          {/* Summary Cards */}
          <div className="mem-summary-row">
            <div className="mem-summary-box">
              <span className="mem-summary-label">Total Paid</span>
              <span className="mem-summary-value paid">{formatPrice(totalPaid)}</span>
            </div>
            <div className="mem-summary-box">
              <span className="mem-summary-label">Total Pending</span>
              <span className="mem-summary-value pending">{formatPrice(totalPending)}</span>
            </div>
            <div className="mem-summary-box">
              <span className="mem-summary-label">Grand Total</span>
              <span className="mem-summary-value total">{formatPrice(grandTotal)}</span>
            </div>
            <div className="mem-summary-box">
              <span className="mem-summary-label">Base Salary</span>
              <span className="mem-summary-value">{formatPrice(staff.base_salary)}</span>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p className="mem-empty" style={{ padding: "20px 0" }}>
              Abhi tak koi salary record nahi hai.
            </p>
          ) : (
            <>
              {/* Month-wise Summary */}
              <h3 className="mem-history-title">Month-wise Summary</h3>
              <div className="mem-history-wrap" style={{ marginBottom: 20 }}>
                <table className="mem-history-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Year</th>
                      <th className="center">Paid</th>
                      <th className="center">Pending</th>
                      <th className="center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(monthTotals)
                      .sort((a, b) => {
                        if (a.year !== b.year) return b.year - a.year;
                        return b.month - a.month;
                      })
                      .map((m) => (
                        <tr key={`${m.year}-${m.month}`}>
                          <td>{MONTH_NAMES[m.month - 1]}</td>
                          <td>{m.year}</td>
                          <td className="center salary-cell">{formatPrice(m.paid)}</td>
                          <td className="center" style={{ color: "#f59e0b" }}>
                            {formatPrice(m.pending)}
                          </td>
                          <td className="center total-cell">{formatPrice(m.paid + m.pending)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed History */}
              <h3 className="mem-history-title">Detailed History</h3>
              <div className="mem-history-wrap">
                <table className="mem-history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Month</th>
                      <th>Year</th>
                      <th className="center">Amount</th>
                      <th className="center">Paid On</th>
                      <th className="center">Status</th>
                      <th className="center">Note</th>
                      <th className="center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => (
                      <tr key={p.id}>
                        <td className="muted">{i + 1}</td>
                        <td>{MONTH_NAMES[p.month - 1]}</td>
                        <td>{p.year}</td>
                        <td className="center salary-cell">{formatPrice(p.amount)}</td>
                        <td className="center">{p.paid_on?.slice(0, 10)}</td>
                        <td className="center">
                          <span className={`mem-status ${p.status === "paid" ? "active" : "on-leave"}`}>
                            {p.status === "paid" ? "Paid" : "Pending"}
                          </span>
                        </td>
                        <td className="center muted">
                          {p.note || "—"}
                          {isSettled(p) ? " (Closed)" : ""}
                        </td>
                        <td className="center">
                          <button
                            type="button"
                            className="mem-action-btn"
                            onClick={() => onDelete(p.id)}
                            title="Delete"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="mem-total-label">
                        Grand Total
                      </td>
                      <td className="center mem-total-value">{formatPrice(grandTotal)}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}