import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  Pause,
  Calendar,
  Search,
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Eye,
} from "lucide-react";
import "./Memberships.css";

/* ----------------------------- Routes (apne routes ke hisaab se change kar lena) ----------------------------- */

const ADD_MEMBER_ROUTE = "/admin/add-member";
const viewMemberRoute = (id: number) => `/admin/memberships/${id}`;

/* ----------------------------- Types ----------------------------- */

type MembershipType = "Normal" | "Package" | "Package + Trainer";
type Plan = "Monthly" | "Quarterly" | "Yearly";
type PlanFilter = "All Plans" | Plan;
type TabKey = "All" | MembershipType;

interface MembershipRecord {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  pkg: string;
  plan: Plan;
  totalFees: number;
  paidAmount: number;
  lastPayment: Date;
  expiryDate: Date;
  membershipType: MembershipType;
}

/* ----------------------------- Helpers ----------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDateLong = (d: Date) => `${DAYS[d.getDay()]}, ${fmtDate(d)}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const fmtPKR = (n: number) => `PKR ${n.toLocaleString("en-US")}`;
const addDays = (d: Date, days: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
};

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const badgeClass = (t: MembershipType) => {
  if (t === "Package") return "ms-badge package";
  if (t === "Package + Trainer") return "ms-badge trainer";
  return "ms-badge normal";
};

/* ----------------------------- Mock data -----------------------------
   TODO: Backend ready hone par MEMBERSHIPS aur STATS ko API se replace kar dena.
---------------------------------------------------------------------- */

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const seed = (
  id: number,
  name: string,
  phone: string,
  pkg: string,
  plan: Plan,
  totalFees: number,
  paidAmount: number,
  lastPayment: Date,
  expiryDate: Date,
  membershipType: MembershipType
): MembershipRecord => ({
  id,
  name,
  phone,
  cnic: `35202-${String(1000000 + id * 104729).slice(0, 7)}-${id % 10}`,
  pkg,
  plan,
  totalFees,
  paidAmount,
  lastPayment,
  expiryDate,
  membershipType,
});

const NAMES = [
  "Ahmed Khan", "Maryam Iqbal", "Hassan Raza", "Noor Fatima", "Talha Mehmood",
  "Sana Javed", "Daniyal Sheikh", "Iqra Aslam", "Faizan Butt", "Laiba Nadeem",
  "Rehan Siddiqui", "Areeba Zafar", "Waqas Hussain", "Mahnoor Ali", "Shahid Afridi",
  "Komal Riaz", "Junaid Qureshi", "Zoya Anwar", "Adeel Chaudhry", "Hiba Tariq",
];

const PACKAGES: Array<{ pkg: string; plan: Plan; fees: number; type: MembershipType; days: number }> = [
  { pkg: "Monthly Basic", plan: "Monthly", fees: 5000, type: "Normal", days: 30 },
  { pkg: "Monthly Premium", plan: "Monthly", fees: 8000, type: "Normal", days: 30 },
  { pkg: "Quarterly", plan: "Quarterly", fees: 12000, type: "Package", days: 90 },
  { pkg: "Monthly Basic + Trainer", plan: "Monthly", fees: 8000, type: "Package + Trainer", days: 30 },
  { pkg: "Yearly", plan: "Yearly", fees: 80000, type: "Package", days: 365 },
  { pkg: "Monthly Student", plan: "Monthly", fees: 4000, type: "Normal", days: 30 },
];

const buildMockData = (): MembershipRecord[] => {
  const list: MembershipRecord[] = [
    seed(1, "Ali Raza", "0300 1234567", "Monthly Basic", "Monthly", 5000, 5000, D(2026, 9, 27), D(2026, 9, 30), "Normal"),
    seed(2, "Sara Khan", "0301 2345678", "Monthly Premium", "Monthly", 8000, 8000, D(2026, 9, 27), D(2026, 10, 2), "Normal"),
    seed(3, "Usman Tariq", "0302 3456789", "Quarterly", "Quarterly", 12000, 12000, D(2026, 9, 26), D(2026, 10, 4), "Normal"),
    seed(4, "Ayesha Malik", "0303 4567890", "Monthly Basic", "Monthly", 5000, 3000, D(2026, 9, 25), D(2026, 10, 5), "Normal"),
    seed(5, "Hamza Ali", "0304 5678901", "Monthly Premium", "Monthly", 8000, 8000, D(2026, 9, 24), D(2026, 10, 6), "Normal"),
    seed(6, "Bilal Ahmed", "0305 6789012", "Monthly Student", "Monthly", 4000, 2000, D(2026, 9, 24), D(2026, 10, 26), "Normal"),
    seed(7, "Fatima Noor", "0306 7890123", "Quarterly", "Quarterly", 15000, 15000, D(2026, 9, 23), D(2026, 12, 25), "Package"),
    seed(8, "Zain Abbas", "0307 8901234", "Monthly Basic + Trainer", "Monthly", 8000, 8000, D(2026, 9, 22), D(2026, 10, 24), "Package + Trainer"),
    seed(9, "Omar Farooq", "0308 9012345", "Yearly", "Yearly", 80000, 80000, D(2026, 9, 21), D(2027, 9, 21), "Package"),
    seed(10, "Hina Shah", "0309 0123456", "Monthly Premium", "Monthly", 8000, 4000, D(2026, 9, 20), D(2026, 10, 20), "Normal"),
  ];

  for (let i = 10; i < 128; i++) {
    const p = PACKAGES[i % PACKAGES.length];
    const last = addDays(D(2026, 9, 19), -(i - 10));
    const partial = i % 4 === 0;
    list.push({
      id: i + 1,
      name: NAMES[i % NAMES.length],
      phone: `03${pad(10 + ((i * 7) % 40))} ${1000000 + ((i * 7919) % 9000000)}`,
      cnic: `35202-${1000000 + ((i * 104729) % 9000000)}-${i % 10}`,
      pkg: p.pkg,
      plan: p.plan,
      totalFees: p.fees,
      paidAmount: partial ? Math.round(p.fees / 2) : p.fees,
      lastPayment: last,
      expiryDate: addDays(last, p.days),
      membershipType: p.type,
    });
  }

  return list;
};

const MEMBERSHIPS: MembershipRecord[] = buildMockData();

const STATS = [
  { id: "total", title: "Total Members", period: "All time", value: "128", change: "+12%", up: true, good: true, vs: "vs. last month", variant: "red", icon: <Users size={26} /> },
  { id: "active", title: "Active Members", period: "Current", value: "111", change: "+6%", up: true, good: true, vs: "vs. last month", variant: "green", icon: <UserCheck size={26} /> },
  { id: "expired", title: "Expired Members", period: "Last 7 days", value: "7", change: "+2%", up: true, good: false, vs: "vs. last month", variant: "amber", icon: <UserX size={26} /> },
  { id: "hold", title: "On Hold / Paused", period: "Current", value: "5", change: "-3%", up: false, good: true, vs: "vs. last month", variant: "orange", icon: <Pause size={26} /> },
];

const TABS: TabKey[] = ["All", "Normal", "Package", "Package + Trainer"];
const PLAN_OPTIONS: PlanFilter[] = ["All Plans", "Monthly", "Quarterly", "Yearly"];
const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ----------------------------- Component ----------------------------- */

const Memberships = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<TabKey>("All");
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

  /* Back to page 1 whenever a filter changes */
  useEffect(() => {
    setPage(1);
  }, [tab, query, plan]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[\s-]/g, "");

    return MEMBERSHIPS.filter((m) => {
      if (tab !== "All" && m.membershipType !== tab) return false;
      if (plan !== "All Plans" && m.plan !== plan) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (qDigits.length > 0 &&
          (m.phone.replace(/\s/g, "").includes(qDigits) || m.cnic.replace(/-/g, "").includes(qDigits)))
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
      className="ms-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="ms-header">
        <div>
          <h1 className="ms-title">Memberships</h1>
          <p className="ms-subtitle">View and manage all gym memberships and their details.</p>
        </div>

        <div className="ms-datetime">
          <div className="ms-datetime-text">
            <span className="ms-date">{fmtDateLong(now)}</span>
            <span className="ms-time">{fmtTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="ms-stats">
        {STATS.map((s) => (
          <div key={s.id} className="ms-stat-card">
            <div className={`ms-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="ms-stat-info">
              <span className="ms-stat-title">{s.title}</span>
              <span className="ms-stat-period">{s.period}</span>
              <span className="ms-stat-value">{s.value}</span>
              <span className={`ms-stat-change ${s.good ? "good" : "bad"}`}>
                {s.up ? (
                  <ArrowUp size={16} strokeWidth={2.5} />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.5} />
                )}
                <strong>{s.change}</strong>
              </span>
              <span className="ms-stat-vs">{s.vs}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="ms-panel">
        {/* Toolbar */}
        <div className="ms-toolbar">
          <div className="ms-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`ms-tab ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ms-toolbar-right">
            <div className="ms-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone or CNIC..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="ms-select-wrap">
              <LayoutGrid size={14} className="ms-select-lead" />
              <select
                className="ms-select"
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanFilter)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="ms-select-icon" />
            </div>

            <button type="button" className="ms-add-btn" onClick={() => navigate(ADD_MEMBER_ROUTE)}>
              <Plus size={16} />
              Add Member
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Plan</th>
                <th>Total Fees</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Last Payment</th>
                <th>Expiry Date</th>
                <th className="center">Membership Type</th>
                <th className="center">View</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="ms-empty">
                    No memberships found.
                  </td>
                </tr>
              ) : (
                rows.map((m, i) => {
                  const remaining = Math.max(0, m.totalFees - m.paidAmount);
                  return (
                    <tr key={m.id}>
                      <td className="muted">{startIdx + i + 1}</td>
                      <td className="member-name">{m.name}</td>
                      <td>{m.phone}</td>
                      <td>{m.pkg}</td>
                      <td>{m.plan}</td>
                      <td>{fmtPKR(m.totalFees)}</td>
                      <td>{fmtPKR(m.paidAmount)}</td>
                      <td className={remaining > 0 ? "due" : "muted"}>{fmtPKR(remaining)}</td>
                      <td>{fmtDate(m.lastPayment)}</td>
                      <td>{fmtDate(m.expiryDate)}</td>
                      <td className="center">
                        <span className={badgeClass(m.membershipType)}>{m.membershipType}</span>
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className="ms-view-btn"
                          aria-label={`View ${m.name}`}
                          onClick={() => navigate(viewMemberRoute(m.id))}
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="ms-footer">
          <span className="ms-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </span>

          <div className="ms-pagination">
            <button
              type="button"
              className="ms-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="ms-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`ms-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="ms-page-btn"
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

export default Memberships;