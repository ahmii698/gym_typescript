import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Wallet,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Calendar,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Download,
  Eye,
  X,
} from "lucide-react";
import "./Payments.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MemberType = "Normal Client" | "Student" | "Package + Trainer";
type PaymentMethod = "Cash" | "Online (JazzCash)" | "Online (Card)" | "Bank Transfer";
type PeriodKey = "today" | "week" | "month" | "custom";

interface Payment {
  id: number;
  memberId: string;
  name: string;
  phone: string;
  packageName: string;
  amount: number;
  date: Date;
  memberType: MemberType;
  plan: string;
  method: PaymentMethod;
  txnId: string;
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const formatShortDate = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const formatLongDate = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${formatShortDate(d)}`;
const formatTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const formatDateTime = (d: Date) => `${formatShortDate(d)}, ${formatTime(d)}`;
const toInputValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInputValue = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const formatPKR = (n: number) => `PKR ${n.toLocaleString("en-US")}`;

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

/* ------------------------------------------------------------------ */
/* Mock data (replace with your API call)                              */
/* ------------------------------------------------------------------ */

const daysAgoAt = (daysAgo: number, hours: number, minutes: number) => {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

type Seed = [
  name: string,
  phone: string,
  packageName: string,
  amount: number,
  daysAgo: number,
  hours: number,
  minutes: number,
  memberType: MemberType,
  plan: string,
  method: PaymentMethod,
];

const SEED_ROWS: Seed[] = [
  ["Ali Raza", "0300 1234567", "Monthly Basic", 5000, 0, 9, 45, "Normal Client", "Monthly", "Cash"],
  ["Sara Khan", "0321 4567890", "Monthly Premium", 8000, 0, 8, 32, "Normal Client", "Monthly", "Online (JazzCash)"],
  ["Usman Tariq", "0300 7890123", "Quarterly", 12000, 1, 18, 15, "Normal Client", "Quarterly", "Bank Transfer"],
  ["Ayesha Malik", "0315 5678901", "Monthly Basic", 5000, 1, 11, 20, "Normal Client", "Monthly", "Cash"],
  ["Hamza Ali", "0322 7788990", "Monthly Premium", 8000, 1, 9, 10, "Normal Client", "Monthly", "Online (Card)"],
  ["Bilal Ahmed", "0333 1122334", "Monthly Student", 4000, 1, 7, 55, "Student", "Monthly", "Cash"],
  ["Fatima Noor", "0304 5566778", "Quarterly", 15000, 2, 18, 30, "Normal Client", "Quarterly", "Online (JazzCash)"],
  ["Zain Abbas", "0311 9988776", "Monthly Basic", 5000, 2, 14, 40, "Normal Client", "Monthly", "Cash"],
  ["Omar Farooq", "0324 6677889", "Monthly Premium", 8000, 2, 13, 15, "Package + Trainer", "Monthly", "Bank Transfer"],
  ["Hina Shah", "0307 4455667", "Monthly Student", 4000, 2, 13, 22, "Student", "Monthly", "Cash"],
];

const EXTRA_NAMES = [
  "Ahmed Khan", "Maryam Siddiqui", "Hassan Raza", "Noor Fatima", "Talha Mehmood",
  "Areeba Iqbal", "Daniyal Sheikh", "Sana Javed", "Faizan Qureshi", "Rabia Aslam",
  "Shahzaib Ali", "Iqra Hussain", "Kamran Yousuf", "Mehwish Baig", "Adnan Rauf",
];

const EXTRA_PACKAGES: { name: string; amount: number; plan: string; type: MemberType }[] = [
  { name: "Monthly Basic", amount: 5000, plan: "Monthly", type: "Normal Client" },
  { name: "Monthly Premium", amount: 8000, plan: "Monthly", type: "Normal Client" },
  { name: "Quarterly", amount: 12000, plan: "Quarterly", type: "Normal Client" },
  { name: "Monthly Student", amount: 4000, plan: "Monthly", type: "Student" },
  { name: "Package + Trainer", amount: 10000, plan: "Monthly", type: "Package + Trainer" },
  { name: "Yearly Premium", amount: 60000, plan: "Yearly", type: "Normal Client" },
];

const PACKAGE_PICKS = [0, 1, 0, 3, 2, 1, 0, 4, 3, 1, 0, 2, 1, 0, 3, 5];
const EXTRA_METHODS: PaymentMethod[] = ["Cash", "Online (JazzCash)", "Bank Transfer", "Online (Card)"];
const TOTAL_PAYMENTS = 248;

const buildPayments = (): Payment[] => {
  const list: Payment[] = SEED_ROWS.map((row, i) => ({
    id: i + 1,
    memberId: `FZ-${1001 + i}`,
    name: row[0],
    phone: row[1],
    packageName: row[2],
    amount: row[3],
    date: daysAgoAt(row[4], row[5], row[6]),
    memberType: row[7],
    plan: row[8],
    method: row[9],
    txnId: `TXN-${String(1234 + i).padStart(6, "0")}`,
  }));

  for (let i = SEED_ROWS.length; i < TOTAL_PAYMENTS; i++) {
    const pkg = EXTRA_PACKAGES[PACKAGE_PICKS[i % PACKAGE_PICKS.length]];
    list.push({
      id: i + 1,
      memberId: `FZ-${1001 + (i % 120)}`,
      name: EXTRA_NAMES[(i * 3) % EXTRA_NAMES.length],
      phone: `03${10 + (i % 25)} ${String(1000000 + ((i * 7919) % 9000000))}`,
      packageName: pkg.name,
      amount: pkg.amount,
      date: daysAgoAt(3 + Math.floor((i - SEED_ROWS.length) * 0.9), 7 + ((i * 5) % 14), (i * 13) % 60),
      memberType: pkg.type,
      plan: pkg.plan,
      method: EXTRA_METHODS[(i * 3) % EXTRA_METHODS.length],
      txnId: `TXN-${String(1234 + i).padStart(6, "0")}`,
    });
  }

  return list;
};

const PAYMENTS = buildPayments();

/* Summary numbers: replace with values from your backend */
const STATS = [
  { id: "total", title: "Total Payments", period: "All time", value: 1245500, change: "+18%", vs: "vs. last month", variant: "red", icon: <Wallet size={26} /> },
  { id: "today", title: "Today's Payments", period: "Today", value: 42500, change: "+12%", vs: "vs. yesterday", variant: "green", icon: <CalendarCheck size={26} /> },
  { id: "week", title: "Weekly Payments", period: "This week", value: 198750, change: "+24%", vs: "vs. last week", variant: "amber", icon: <CalendarDays size={26} /> },
  { id: "month", title: "Monthly Payments", period: "This month", value: 532000, change: "+16%", vs: "vs. last month", variant: "orange", icon: <CalendarRange size={26} /> },
];

const TABS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Date" },
];

const PLAN_OPTIONS = ["All Plans", "Monthly", "Quarterly", "Yearly"];

const TYPE_CLASS: Record<MemberType, string> = {
  "Normal Client": "client",
  Student: "student",
  "Package + Trainer": "trainer",
};

const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Payments = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(() => new Date());
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customFrom, setCustomFrom] = useState(() => toInputValue(new Date()));
  const [customTo, setCustomTo] = useState(() => toInputValue(new Date()));
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("All Plans");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Payment | null>(null);

  // Make the page its own scroll container regardless of the layout
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

  /* Live clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* Close the details dialog with Escape */
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  /* Back to page 1 whenever a filter changes */
  useEffect(() => {
    setPage(1);
  }, [period, customFrom, customTo, query, plan]);

  const todayKey = toInputValue(now);

  const range = useMemo(() => {
    const today = fromInputValue(todayKey);
    if (period === "today") return { start: today, end: today };
    if (period === "week") {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { start, end: today };
    }
    if (period === "month") {
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    }
    return {
      start: customFrom ? fromInputValue(customFrom) : null,
      end: customTo ? fromInputValue(customTo) : null,
    };
  }, [period, todayKey, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\s/g, "");
    return PAYMENTS.filter((p) => {
      const day = startOfDay(p.date).getTime();
      if (range.start && day < range.start.getTime()) return false;
      if (range.end && day > range.end.getTime()) return false;
      if (plan !== "All Plans" && p.plan !== plan) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.memberId.toLowerCase().includes(q) ||
        p.txnId.toLowerCase().includes(q) ||
        p.phone.replace(/\s/g, "").includes(qDigits)
      );
    });
  }, [range, query, plan]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  const rangeLabel = `${range.start ? formatShortDate(range.start) : "Any date"} - ${
    range.end ? formatShortDate(range.end) : "Any date"
  }`;

  const handleExport = () => {
    const header = [
      "Payment ID", "Member Name", "Phone", "Package", "Amount (PKR)",
      "Payment Date", "Member Type", "Plan", "Payment Method",
    ];
    const data = filtered.map((p) => [
      p.txnId, p.name, p.phone, p.packageName, p.amount,
      formatDateTime(p.date), p.memberType, p.plan, p.method,
    ]);
    const csv = [header, ...data]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${period}-${todayKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="pay-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="pay-header">
        <div>
          <h1 className="pay-title">Payments</h1>
          <p className="pay-subtitle">View and manage all payments received from members.</p>
        </div>

        <div className="pay-datetime">
          <div className="pay-datetime-text">
            <span className="pay-date">{formatLongDate(now)}</span>
            <span className="pay-time">{formatTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="pay-stats">
        {STATS.map((s) => (
          <div key={s.id} className="pay-stat-card">
            <div className={`pay-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="pay-stat-info">
              <span className="pay-stat-title">{s.title}</span>
              <span className="pay-stat-period">{s.period}</span>
              <span className="pay-stat-value">{formatPKR(s.value)}</span>
              <span className="pay-stat-change good">
                <ArrowUp size={16} strokeWidth={2.5} />
                <strong>{s.change}</strong>
              </span>
              <span className="pay-stat-vs">{s.vs}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="pay-panel">
        {/* Toolbar */}
        <div className="pay-toolbar">
          <div className="pay-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`pay-tab ${period === t.key ? "active" : ""}`}
                onClick={() => setPeriod(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pay-toolbar-right">
            {period === "custom" ? (
              <div className="pay-range pay-range-custom">
                <Calendar size={15} />
                <input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span aria-hidden="true">-</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            ) : (
              <div className="pay-range">
                <Calendar size={15} />
                <span>{rangeLabel}</span>
              </div>
            )}

            <div className="pay-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone or member ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="pay-select-wrap">
              <select
                className="pay-select"
                aria-label="Filter by plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pay-select-icon" />
            </div>

            <button
              type="button"
              className="pay-export"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="pay-table-wrap">
          <table className="pay-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Payment Date</th>
                <th className="center">Member Type</th>
                <th>Plan</th>
                <th>Method</th>
                <th>Payment ID</th>
                <th className="center">View</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="pay-empty">
                    No payments found. Try a different date range, plan or search term.
                  </td>
                </tr>
              ) : (
                rows.map((p, i) => (
                  <tr key={p.id}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{p.name}</td>
                    <td>{p.phone}</td>
                    <td>{p.packageName}</td>
                    <td className="amount">{formatPKR(p.amount)}</td>
                    <td>{formatDateTime(p.date)}</td>
                    <td className="center">
                      <span className={`pay-badge ${TYPE_CLASS[p.memberType]}`}>{p.memberType}</span>
                    </td>
                    <td>{p.plan}</td>
                    <td>{p.method}</td>
                    <td className="muted">{p.txnId}</td>
                    <td className="center">
                      <button
                        type="button"
                        className="pay-view-btn"
                        aria-label={`View payment ${p.txnId}`}
                        onClick={() => setSelected(p)}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="pay-footer">
          <span className="pay-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </span>

          <div className="pay-pagination">
            <button
              type="button"
              className="pay-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="pay-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`pay-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="pay-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Payment details dialog */}
      {selected && (
        <div className="pay-overlay" onClick={() => setSelected(null)} role="presentation">
          <div
            className="pay-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pay-dialog-head">
              <div>
                <h2 id="pay-dialog-title">{selected.name}</h2>
                <p>{selected.txnId}</p>
              </div>
              <button
                type="button"
                className="pay-dialog-close"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="pay-dialog-amount">{formatPKR(selected.amount)}</p>

            <dl className="pay-dialog-list">
              <div><dt>Member ID</dt><dd>{selected.memberId}</dd></div>
              <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
              <div><dt>Package</dt><dd>{selected.packageName}</dd></div>
              <div><dt>Plan</dt><dd>{selected.plan}</dd></div>
              <div><dt>Member type</dt><dd>{selected.memberType}</dd></div>
              <div><dt>Payment method</dt><dd>{selected.method}</dd></div>
              <div><dt>Payment date</dt><dd>{formatDateTime(selected.date)}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;