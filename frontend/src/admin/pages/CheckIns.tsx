import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Calendar,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from "lucide-react";
import "./CheckIns.css";

/* ---------------------------- Types ---------------------------- */

type MembershipType = "Normal Client" | "Student";
type Plan = "Monthly" | "Quarterly" | "Yearly";
type PlanFilter = "All Plans" | Plan;
type RangeKey = "today" | "week" | "month" | "custom";

interface CheckInRecord {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  pkg: string;
  checkedInAt: Date;
  membershipType: MembershipType;
  plan: Plan;
}

/* ---------------------------- Helpers ---------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDateLong = (d: Date) => `${DAYS[d.getDay()]}, ${fmtDate(d)}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${fmtTime(d)}`;
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

/* ----------------------------- Mock data -----------------------------
   TODO: Jab backend ready ho to is section ko API call se replace kar dena
   (CHECKINS ki jagah state + useEffect me fetch). Baqi UI same rahegi.
---------------------------------------------------------------------- */

const at = (dayOffset: number, h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() - dayOffset);
  return d;
};

const seed = (
  id: number,
  name: string,
  phone: string,
  pkg: string,
  membershipType: MembershipType,
  plan: Plan,
  off: number,
  h: number,
  m: number
): CheckInRecord => ({
  id,
  name,
  phone,
  cnic: `35202-${String(1000000 + id * 104729).slice(0, 7)}-${id % 10}`,
  pkg,
  membershipType,
  plan,
  checkedInAt: at(off, h, m),
});

const NAMES = [
  "Ahmed Khan", "Maryam Iqbal", "Hassan Raza", "Noor Fatima", "Talha Mehmood",
  "Sana Javed", "Daniyal Sheikh", "Iqra Aslam", "Faizan Butt", "Laiba Nadeem",
  "Rehan Siddiqui", "Areeba Zafar", "Waqas Hussain", "Mahnoor Ali", "Shahid Afridi",
  "Komal Riaz", "Junaid Qureshi", "Zoya Anwar", "Adeel Chaudhry", "Hiba Tariq",
];

const PACKAGES: Array<[string, MembershipType, Plan]> = [
  ["Monthly Basic", "Normal Client", "Monthly"],
  ["Monthly Premium", "Normal Client", "Monthly"],
  ["Quarterly", "Normal Client", "Quarterly"],
  ["Monthly Student", "Student", "Monthly"],
  ["Yearly Premium", "Normal Client", "Yearly"],
];

const buildMockData = (): CheckInRecord[] => {
  const list: CheckInRecord[] = [
    seed(1, "Ali Raza", "0300 1234567", "Monthly Basic", "Normal Client", "Monthly", 0, 9, 45),
    seed(2, "Sara Khan", "0321 4567890", "Monthly Premium", "Normal Client", "Monthly", 0, 8, 32),
    seed(3, "Usman Tariq", "0300 7890123", "Quarterly", "Normal Client", "Quarterly", 0, 6, 15),
    seed(4, "Ayesha Malik", "0315 5678901", "Monthly Basic", "Normal Client", "Monthly", 1, 11, 20),
    seed(5, "Hamza Ali", "0322 7788990", "Monthly Premium", "Normal Client", "Monthly", 1, 9, 10),
    seed(6, "Bilal Ahmed", "0333 1122334", "Monthly Student", "Student", "Monthly", 1, 7, 55),
    seed(7, "Fatima Noor", "0304 5566778", "Quarterly", "Normal Client", "Quarterly", 2, 18, 30),
    seed(8, "Zain Abbas", "0311 9988776", "Monthly Basic", "Normal Client", "Monthly", 2, 17, 12),
    seed(9, "Omar Farooq", "0324 6677889", "Monthly Premium", "Normal Client", "Monthly", 2, 15, 45),
    seed(10, "Hina Shah", "0307 4455667", "Monthly Student", "Student", "Monthly", 2, 13, 22),
  ];

  for (let i = 10; i < 324; i++) {
    const j = i - 10;
    const [pkg, type, plan] = PACKAGES[i % PACKAGES.length];
    list.push({
      id: i + 1,
      name: NAMES[i % NAMES.length],
      phone: `03${pad(10 + ((i * 7) % 40))} ${1000000 + ((i * 7919) % 9000000)}`,
      cnic: `35202-${1000000 + ((i * 104729) % 9000000)}-${i % 10}`,
      pkg,
      membershipType: type,
      plan,
      checkedInAt: at(2 + Math.floor(j / 9), 6 + ((j * 5) % 15), (j * 17) % 60),
    });
  }

  return list.sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime());
};

const CHECKINS: CheckInRecord[] = buildMockData();

/* Stat cards (mock) — API se replace kar sakte ho */
const STATS = [
  { id: "today", title: "Today's Check-ins", period: "Today", value: "48", change: "+12%", vs: "vs. yesterday", variant: "red", icon: <CalendarCheck size={26} /> },
  { id: "week", title: "Weekly Check-ins", period: "This Week", value: "236", change: "+18%", vs: "vs. last week", variant: "green", icon: <CalendarDays size={26} /> },
  { id: "month", title: "Monthly Check-ins", period: "This Month", value: "912", change: "+22%", vs: "vs. last month", variant: "amber", icon: <CalendarRange size={26} /> },
  { id: "total", title: "Total Check-ins", period: "All time", value: "5,482", change: "+17%", vs: "vs. last month", variant: "orange", icon: <Users size={26} /> },
];

const TABS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Date" },
];

const PLAN_OPTIONS: PlanFilter[] = ["All Plans", "Monthly", "Quarterly", "Yearly"];
const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ----------------------------- Component ----------------------------- */

const CheckIns = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(() => new Date());
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState(() => toInput(new Date()));
  const [to, setTo] = useState(() => toInput(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("All Plans");
  const [page, setPage] = useState(1);

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

  /* Close date popover on outside click */
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  /* Back to page 1 whenever a filter changes */
  useEffect(() => {
    setPage(1);
  }, [from, to, query, plan]);

  const applyPreset = (key: RangeKey) => {
    setRange(key);
    const today = new Date();
    if (key === "today") {
      setFrom(toInput(today));
      setTo(toInput(today));
      setPickerOpen(false);
    } else if (key === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setFrom(toInput(start));
      setTo(toInput(today));
      setPickerOpen(false);
    } else if (key === "month") {
      setFrom(toInput(new Date(today.getFullYear(), today.getMonth(), 1)));
      setTo(toInput(today));
      setPickerOpen(false);
    } else {
      setPickerOpen(true);
    }
  };

  const onFromChange = (value: string) => {
    if (!value) return;
    setRange("custom");
    setFrom(value);
    if (value > to) setTo(value);
  };

  const onToChange = (value: string) => {
    if (!value) return;
    setRange("custom");
    setTo(value);
    if (value < from) setFrom(value);
  };

  const filtered = useMemo(() => {
    const start = fromInput(from);
    const end = fromInput(to);
    end.setHours(23, 59, 59, 999);
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[\s-]/g, "");

    return CHECKINS.filter((r) => {
      const t = r.checkedInAt.getTime();
      if (t < start.getTime() || t > end.getTime()) return false;
      if (plan !== "All Plans" && r.plan !== plan) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (qDigits.length > 0 &&
          (r.phone.replace(/\s/g, "").includes(qDigits) || r.cnic.replace(/-/g, "").includes(qDigits)))
      );
    });
  }, [from, to, query, plan]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  const rangeLabel = `${fmtDate(fromInput(from))} - ${fmtDate(fromInput(to))}`;

  return (
    <div
      className="ci-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="ci-header">
        <div>
          <h1 className="ci-title">Check-ins</h1>
          <p className="ci-subtitle">View and manage all member check-in records.</p>
        </div>

        <div className="ci-datetime">
          <div className="ci-datetime-text">
            <span className="ci-date">{fmtDateLong(now)}</span>
            <span className="ci-time">{fmtTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="ci-stats">
        {STATS.map((s) => (
          <div key={s.id} className="ci-stat-card">
            <div className={`ci-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="ci-stat-info">
              <span className="ci-stat-title">{s.title}</span>
              <span className="ci-stat-period">{s.period}</span>
              <span className="ci-stat-value">{s.value}</span>
              <span className="ci-stat-change good">
                <ArrowUp size={16} strokeWidth={2.5} />
                <strong>{s.change}</strong>
              </span>
              <span className="ci-stat-vs">{s.vs}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="ci-panel">
        {/* Toolbar */}
        <div className="ci-toolbar">
          <div className="ci-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`ci-tab ${range === t.key ? "active" : ""}`}
                onClick={() => applyPreset(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ci-toolbar-right">
            <div className="ci-range-wrap" ref={pickerRef}>
              <button type="button" className="ci-range" onClick={() => setPickerOpen((o) => !o)}>
                <Calendar size={15} />
                <span>{rangeLabel}</span>
              </button>

              {pickerOpen && (
                <div className="ci-popover">
                  <label className="ci-popover-field">
                    <span>From</span>
                    <input type="date" value={from} max={to} onChange={(e) => onFromChange(e.target.value)} />
                  </label>
                  <label className="ci-popover-field">
                    <span>To</span>
                    <input type="date" value={to} min={from} onChange={(e) => onToChange(e.target.value)} />
                  </label>
                  <button type="button" className="ci-popover-apply" onClick={() => setPickerOpen(false)}>
                    Apply
                  </button>
                </div>
              )}
            </div>

            <div className="ci-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone or CNIC..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="ci-select-wrap">
              <select
                className="ci-select"
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanFilter)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="ci-select-icon" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="ci-table-wrap">
          <table className="ci-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Check-in Time</th>
                <th className="center">Membership Type</th>
                <th className="center">Plan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ci-empty">
                    No check-in records found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{r.name}</td>
                    <td>{r.phone}</td>
                    <td>{r.pkg}</td>
                    <td>{fmtDateTime(r.checkedInAt)}</td>
                    <td className="center">
                      <span
                        className={`ci-badge ${r.membershipType === "Student" ? "student" : "client"}`}
                      >
                        {r.membershipType}
                      </span>
                    </td>
                    <td className="center">
                      <span className="ci-badge plan">{r.plan}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="ci-footer">
          <span className="ci-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </span>

          <div className="ci-pagination">
            <button
              type="button"
              className="ci-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="ci-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`ci-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="ci-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckIns;