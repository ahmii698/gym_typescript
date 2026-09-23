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
} from "lucide-react";
// TODO: path apne project ke hisaab se theek karo (jahan baaki pages config import karte hain)
import { API_URL } from "../../../config";
import "./Members.css";

/* ---------------------------- Types & config ---------------------------- */

type Status = "Active" | "On Leave" | "Inactive";
type Kind = "Trainer" | "Front Desk";
type Tab = "All" | "Trainers" | "Front Desk";
type StatusFilter = "All Status" | Status;

interface Staff {
  key: string;
  name: string;
  phone: string;
  email: string;
  kind: Kind;
  role: string;
  specialization: string;
  experience: string;
  status: Status;
}

// TODO: agar tumhari app mein token ki localStorage key alag hai to yahan change karo
const TOKEN_KEY = "token";

const TABS: { key: Tab; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Trainers", label: "Trainers" },
  { key: "Front Desk", label: "Front Desk" },
];

const STATUS_OPTIONS: StatusFilter[] = ["All Status", "Active", "On Leave", "Inactive"];
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

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

// Laravel: [..] ya { data: [..] } ya { data: { data: [..] } } teeno chalenge
const extractList = (json: any): any[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.trainers)) return json.trainers;
  return [];
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
    key: `trainer-${t.id}`,
    name: t.name ?? "",
    phone: t.phone ?? "",
    email: t.email ?? "",
    kind: "Trainer",
    role: t.role || "Fitness Trainer",
    specialization: t.specialization || "—",
    experience: years === null || typeof years === "undefined" || years === "" ? "—" : `${years} yrs`,
    status,
  };
};

const normalizeFrontdesk = (u: any): Staff => ({
  key: `frontdesk-${u.id}`,
  name: u.name ?? "",
  phone: u.phone ?? "",
  email: u.email ?? "",
  kind: "Front Desk",
  role: "Front Desk",
  specialization: "—",
  experience: "—",
  status: "Active",
});

/* ------------------------------ Component ------------------------------ */

const BOTTOM_GAP = 24;

const Members = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All Status");
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

  // Trainers (/trainers) + Front desk (/staff/frontdesk) load karo
  const loadStaff = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const options = {
        signal,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };

      const [trainersRes, frontdeskRes] = await Promise.all([
        fetch(`${API_URL}/trainers`, options),
        fetch(`${API_URL}/staff/frontdesk`, options),
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

  useEffect(() => {
    const controller = new AbortController();
    loadStaff(controller.signal);
    return () => controller.abort();
  }, [loadStaff, reloadKey]);

  // Back to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, query, statusFilter]);

  /* ---- Stats (derived from data) ---- */
  const stats = useMemo(() => {
    const trainers = staff.filter((s) => s.kind === "Trainer").length;
    const frontdesk = staff.filter((s) => s.kind === "Front Desk").length;
    const notActive = staff.filter((s) => s.status !== "Active").length;

    return [
      {
        id: "total",
        title: "Total Staff",
        period: "Trainers + Front Desk",
        value: String(staff.length),
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
        id: "notactive",
        title: "On Leave / Inactive",
        period: "Right now",
        value: String(notActive),
        variant: "orange",
        icon: <UserX size={26} />,
      },
    ];
  }, [staff]);

  /* ---- Filtering + pagination ---- */
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
          <p className="mem-subtitle">View all trainers and front desk staff.</p>
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
                <th>Experience</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="mem-empty">
                    Loading staff...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="mem-empty mem-error">
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
                  <td colSpan={8} className="mem-empty">
                    No staff found.
                  </td>
                </tr>
              ) : (
                rows.map((s, i) => (
                  <tr key={s.key}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{s.name}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.email || "—"}</td>
                    <td>{s.role}</td>
                    <td>{s.specialization}</td>
                    <td>{s.experience}</td>
                    <td className="center">
                      <span className={`mem-status ${s.status.toLowerCase().replace(" ", "-")}`}>
                        {s.status}
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