import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Calendar,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import "./Members.css";

/* ---------------------------- Types & data ---------------------------- */

type Status = "Active" | "Inactive";
type Tab = "All" | "Active" | "Inactive";
type PlanFilter = "All Plans" | "Monthly" | "Quarterly" | "Yearly";

interface Member {
  id: number;
  name: string;
  phone: string;
  pkg: string;
  plan: "Monthly" | "Quarterly" | "Yearly";
  joined: string; // ISO date: YYYY-MM-DD
  expiry: string; // ISO date: YYYY-MM-DD
  status: Status;
}

const MEMBERS: Member[] = [
  { id: 1, name: "Ali Raza", phone: "0300 1234567", pkg: "Monthly Basic", plan: "Monthly", joined: "2026-08-30", expiry: "2026-09-30", status: "Active" },
  { id: 2, name: "Sara Khan", phone: "0301 2345678", pkg: "Monthly Premium", plan: "Monthly", joined: "2026-09-02", expiry: "2026-10-02", status: "Active" },
  { id: 3, name: "Usman Tariq", phone: "0302 3456789", pkg: "Quarterly", plan: "Quarterly", joined: "2026-07-04", expiry: "2026-10-04", status: "Active" },
  { id: 4, name: "Ayesha Malik", phone: "0303 4567890", pkg: "Monthly Basic", plan: "Monthly", joined: "2026-09-05", expiry: "2026-10-05", status: "Active" },
  { id: 5, name: "Hamza Ali", phone: "0304 5678901", pkg: "Monthly Premium", plan: "Monthly", joined: "2026-09-06", expiry: "2026-10-06", status: "Active" },
  { id: 6, name: "Bilal Ahmed", phone: "0305 6789012", pkg: "Monthly Student", plan: "Monthly", joined: "2026-09-26", expiry: "2026-10-26", status: "Active" },
  { id: 7, name: "Fatima Noor", phone: "0306 7890123", pkg: "Quarterly", plan: "Quarterly", joined: "2026-09-25", expiry: "2026-12-25", status: "Active" },
  { id: 8, name: "Zain Abbas", phone: "0307 8901234", pkg: "Monthly Basic", plan: "Monthly", joined: "2026-09-24", expiry: "2026-10-24", status: "Active" },
  { id: 9, name: "Hina Shah", phone: "0308 9012345", pkg: "Yearly Premium", plan: "Yearly", joined: "2026-09-23", expiry: "2027-09-23", status: "Active" },
  { id: 10, name: "Omar Farooq", phone: "0309 0123456", pkg: "Monthly Premium", plan: "Monthly", joined: "2026-09-22", expiry: "2026-10-22", status: "Active" },
  { id: 11, name: "Danish Iqbal", phone: "0310 1234567", pkg: "Monthly Student", plan: "Monthly", joined: "2026-08-10", expiry: "2026-09-10", status: "Inactive" },
  { id: 12, name: "Maryam Siddiqui", phone: "0311 2345678", pkg: "Quarterly", plan: "Quarterly", joined: "2026-06-01", expiry: "2026-09-01", status: "Inactive" },
  { id: 13, name: "Kashif Hussain", phone: "0312 3456789", pkg: "Monthly Basic", plan: "Monthly", joined: "2026-08-15", expiry: "2026-09-15", status: "Inactive" },
  { id: 14, name: "Noor Fatima", phone: "0313 4567890", pkg: "Yearly Premium", plan: "Yearly", joined: "2026-01-12", expiry: "2027-01-12", status: "Active" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Active", label: "Active" },
  { key: "Inactive", label: "Inactive" },
];

const PLAN_OPTIONS: PlanFilter[] = ["All Plans", "Monthly", "Quarterly", "Yearly"];
const PAGE_SIZE = 10;

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

// "2026-09-02" -> "02 Sep 2026"
const formatISO = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

/* ------------------------------ Component ------------------------------ */

const BOTTOM_GAP = 24;

const Members = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<Tab>("All");
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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Back to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, query, plan]);

  /* ---- Stats (derived from data) ---- */
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const stats = useMemo(() => {
    const count = (s: Status) => MEMBERS.filter((m) => m.status === s).length;
    const newThisMonth = MEMBERS.filter((m) => m.joined.startsWith(currentMonthKey)).length;

    return [
      {
        id: "total",
        title: "Total Members",
        period: "All time",
        value: String(MEMBERS.length),
        change: "+8%",
        up: true,
        good: true,
        vs: "vs. last month",
        variant: "red",
        icon: <Users size={26} />,
      },
      {
        id: "active",
        title: "Active Members",
        period: "Right now",
        value: String(count("Active")),
        change: "+6%",
        up: true,
        good: true,
        vs: "vs. last month",
        variant: "green",
        icon: <UserCheck size={26} />,
      },
      {
        id: "new",
        title: "New Members",
        period: "This Month",
        value: String(newThisMonth),
        change: "+18%",
        up: true,
        good: true,
        vs: "vs. last month",
        variant: "amber",
        icon: <UserPlus size={26} />,
      },
      {
        id: "inactive",
        title: "Inactive Members",
        period: "Right now",
        value: String(count("Inactive")),
        change: "-12%",
        up: false,
        good: true,
        vs: "vs. last month",
        variant: "orange",
        icon: <UserX size={26} />,
      },
    ];
  }, [currentMonthKey]);

  /* ---- Filtering + pagination ---- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MEMBERS.filter((m) => {
      if (tab !== "All" && m.status !== tab) return false;
      if (plan !== "All Plans" && m.plan !== plan) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.pkg.toLowerCase().includes(q)
      );
    });
  }, [tab, query, plan]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  return (
    <div
      className="members-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="mem-header">
        <div>
          <h1 className="mem-title">Members</h1>
          <p className="mem-subtitle">View and manage all gym members.</p>
        </div>

        <div className="mem-datetime">
          <div className="mem-datetime-text">
            <span className="mem-date">{formatDate(now)}</span>
            <span className="mem-time">{formatTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mem-stats">
        {stats.map((s) => (
          <div key={s.id} className="mem-stat-card">
            <div className={`mem-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="mem-stat-info">
              <span className="mem-stat-title">{s.title}</span>
              <span className="mem-stat-period">{s.period}</span>
              <span className="mem-stat-value">{s.value}</span>
              <span className={`mem-stat-change ${s.good ? "good" : "bad"}`}>
                {s.up ? (
                  <ArrowUp size={16} strokeWidth={2.5} />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.5} />
                )}
                <strong>{s.change}</strong>
              </span>
              <span className="mem-stat-vs">{s.vs}</span>
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
                placeholder="Search by name, phone or package..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="mem-select-wrap">
              <select
                className="mem-select"
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanFilter)}
              >
                {PLAN_OPTIONS.map((p) => (
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
                <th>Member Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Join Date</th>
                <th>Expiry Date</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mem-empty">
                    No members found.
                  </td>
                </tr>
              ) : (
                rows.map((m, i) => (
                  <tr key={m.id}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{m.name}</td>
                    <td>{m.phone}</td>
                    <td>{m.pkg}</td>
                    <td>{formatISO(m.joined)}</td>
                    <td>{formatISO(m.expiry)}</td>
                    <td className="center">
                      <span className={`mem-status ${m.status.toLowerCase()}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))
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
    </div>
  );
};

export default Members;