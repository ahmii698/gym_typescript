import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Search,
  RotateCcw,
  Download,
  Eye,
  X,
  Footprints,
  ClipboardList,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./attendance.css";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type PaymentStatus = "Paid" | "Unpaid";
type MemberType = "Normal" | "Normal + Trainer" | "Package Only" | "Package + Trainer";
type AttendanceStatus = "Present" | "Absent";

interface Member {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  package: string;
  type: MemberType;
  trainer: string | null;
  status: AttendanceStatus;
  checkIn: string | null;
  paymentStatus: PaymentStatus;
  feesPaidOn: string;
  feesExpiryOn: string;
  joinedOn: string;
  email: string;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
}

// Backend se jaisa data aata hai (AttendanceController@index se)
interface ApiAttendanceRow {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  package: string;
  type: MemberType;
  trainer: string | null;
  status: AttendanceStatus;
  check_in: string | null;
  payment_status: PaymentStatus;
  fees_paid_on: string | null;
  fees_expiry_on: string | null;
  joined_on: string | null;
  email: string;
  avatar: string | null;
  cnic_front_url: string | null;
  cnic_back_url: string | null;
}

// AttendanceController@toggle ka response shape
interface ApiToggleResponse {
  status: AttendanceStatus;
  check_in: string | null;
}

// AttendanceController@history ka response shape
interface HistoryMonth {
  month: string; // "2026-09"
  label: string; // "September 2026"
  present: number;
  absent: number;
  total_days: number;
  percentage: number;
}

interface HistoryDay {
  date: string; // "2026-09-23"
  day: string; // "Wed"
  status: AttendanceStatus;
  check_in: string | null;
}

interface HistorySummary {
  present: number;
  absent: number;
  total_days: number;
  percentage: number;
}

interface ApiHistoryResponse {
  member: { id: number; name: string; tracking_from: string };
  selected_month: string;
  months: HistoryMonth[];
  summary: HistorySummary;
  overall: HistorySummary;
  days: HistoryDay[];
}

const TRAINERS = ["Ali Raza", "Usman Ali", "Bilal Khan"];
const MEMBER_TYPES: MemberType[] = [
  "Normal",
  "Normal + Trainer",
  "Package Only",
  "Package + Trainer",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ------------------------------------------------------------------ */
/* API helpers (isi file ke andar)                                     */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return localStorage.getItem("token");
}

// Local (device) date — UTC nahi, taake Pakistan mein raat ko date galat na ho
function getLocalDateString(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Image ko naye tab mein kholna
function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function mapApiToMember(m: ApiAttendanceRow): Member {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    cnic: m.cnic,
    package: m.package,
    type: m.type,
    trainer: m.trainer,
    status: m.status,
    checkIn: m.check_in,
    paymentStatus: m.payment_status,
    feesPaidOn: m.fees_paid_on ?? "-",
    feesExpiryOn: m.fees_expiry_on ?? "-",
    joinedOn: m.joined_on ?? "-",
    email: m.email,
    cnicFrontUrl: m.cnic_front_url,
    cnicBackUrl: m.cnic_back_url,
  };
}

async function apiFetchAttendance(date: string): Promise<Member[]> {
  const res = await fetch(`${API_URL}/attendance?date=${date}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Attendance load nahi ho saki.");
  const data: ApiAttendanceRow[] = await res.json();
  return data.map(mapApiToMember);
}

async function apiToggleAttendance(memberId: number, date: string): Promise<ApiToggleResponse> {
  const res = await fetch(`${API_URL}/attendance/${memberId}/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error("Status update nahi ho saka.");
  return res.json();
}

async function apiFetchHistory(memberId: number, month?: string): Promise<ApiHistoryResponse> {
  const qs = month ? `?month=${month}` : "";
  const res = await fetch(`${API_URL}/attendance/${memberId}/history${qs}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Attendance history load nahi ho saki.");
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */
const StatusBadge: React.FC<{
  status: AttendanceStatus;
  onDoubleClick?: () => void;
}> = ({ status, onDoubleClick }) => (
  <span
    className={`badge badge-${status.toLowerCase()} badge-toggle`}
    onDoubleClick={onDoubleClick}
    title="Double-click to toggle Present/Absent"
  >
    {status}
  </span>
);

const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
  <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
);

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */
const AttendancePage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const todayDate = useMemo(() => getLocalDateString(), []);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"All" | PaymentStatus>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | MemberType>("All");
  const [trainerFilter, setTrainerFilter] = useState<"All" | string>("All");
  const [dateRange, setDateRange] = useState("Aug 23, 2025 - Aug 30, 2025");
  const [page, setPage] = useState(1);
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  // History modal state
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<ApiHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyReq = useRef(0);

  /* make the page its own scroll container, same as Members / Payments / Add Member */
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

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchAttendance(todayDate);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attendance load nahi ho saki.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- History ---------------- */
  const loadHistory = async (memberId: number, month?: string) => {
    const reqId = ++historyReq.current;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiFetchHistory(memberId, month);
      if (reqId !== historyReq.current) return;
      setHistory(data);
    } catch (err) {
      if (reqId !== historyReq.current) return;
      setHistoryError(err instanceof Error ? err.message : "Attendance history load nahi ho saki.");
    } finally {
      if (reqId === historyReq.current) setHistoryLoading(false);
    }
  };

  const openHistory = (m: Member) => {
    setHistory(null);
    setHistoryMember(m);
    loadHistory(m.id);
  };

  const closeHistory = () => {
    historyReq.current++;
    setHistoryMember(null);
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(false);
  };

  const monthIdx = history
    ? history.months.findIndex((mo) => mo.month === history.selected_month)
    : -1;
  const prevMonth = history && monthIdx > 0 ? history.months[monthIdx - 1] : null;
  const nextMonth =
    history && monthIdx >= 0 && monthIdx < history.months.length - 1
      ? history.months[monthIdx + 1]
      : null;
  const selectedMonthInfo = history && monthIdx >= 0 ? history.months[monthIdx] : null;

  // Calendar cells for the selected month
  const calendarCells = useMemo(() => {
    if (!history) return [];
    const [y, mo] = history.selected_month.split("-").map(Number);
    const firstWeekday = new Date(y, mo - 1, 1).getDay();
    const daysInMonth = new Date(y, mo, 0).getDate();
    const map = new Map(history.days.map((d) => [d.date, d]));

    const cells: ({ day: number; date: string; info?: HistoryDay } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${history.selected_month}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, date, info: map.get(date) });
    }
    return cells;
  }, [history]);

  // Toggle Present <-> Absent for a given member (used on badge double-click)
  const toggleStatus = async (id: number) => {
    // optimistic UI update — turant dikhta hai, table refresh nahi hota
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === "Present" ? "Absent" : "Present",
              checkIn: m.status === "Present" ? null : m.checkIn ?? "—",
            }
          : m
      )
    );
    setActiveMember((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: prev.status === "Present" ? "Absent" : "Present",
            checkIn: prev.status === "Present" ? null : prev.checkIn ?? "—",
          }
        : prev
    );

    try {
      const result = await apiToggleAttendance(id, todayDate);
      // sirf isi member ki row backend ke authoritative data se sync karein
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: result.status, checkIn: result.check_in } : m
        )
      );
      setActiveMember((prev) =>
        prev && prev.id === id
          ? { ...prev, status: result.status, checkIn: result.check_in }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update nahi ho saka.");
      // sirf error ki soorat mein poora reload karein taake sahi state wapas aa jaye
      loadAttendance();
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        search.trim() === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search) ||
        m.cnic.includes(search);

      const matchesPayment =
        paymentFilter === "All" || m.paymentStatus === paymentFilter;

      const matchesType = typeFilter === "All" || m.type === typeFilter;

      const matchesTrainer =
        trainerFilter === "All" || m.trainer === trainerFilter;

      return matchesSearch && matchesPayment && matchesType && matchesTrainer;
    });
  }, [members, search, paymentFilter, typeFilter, trainerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageMembers = filteredMembers.slice(pageStart, pageStart + PAGE_SIZE);

  const stats = useMemo(() => {
    const totalCheckIns = members.filter((m) => m.checkIn).length;
    const present = members.filter((m) => m.status === "Present").length;
    const absent = members.filter((m) => m.status === "Absent").length;
    const noCheckIn = members.filter((m) => !m.checkIn).length;
    return { totalCheckIns, present, absent, noCheckIn };
  }, [members]);

  const handleReset = () => {
    setSearch("");
    setPaymentFilter("All");
    setTypeFilter("All");
    setTrainerFilter("All");
    setDateRange("Aug 23, 2025 - Aug 30, 2025");
    setPage(1);
  };

  const handleExport = () => {
    const header = [
      "Name",
      "Phone",
      "CNIC",
      "Package",
      "Type",
      "Trainer",
      "Status",
      "Check In",
      "Payment Status",
    ];
    const rows = filteredMembers.map((m) => [
      m.name,
      m.phone,
      m.cnic,
      m.package,
      m.type,
      m.trainer ?? "-",
      m.status,
      m.checkIn ?? "-",
      m.paymentStatus,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="attendance-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="attendance-header">
        <div className="attendance-header-icon">
          <Calendar size={22} />
        </div>
        <div>
          <h1>Attendance</h1>
          <p>Track and manage member attendance</p>
        </div>
      </div>

      {error && (
        <div className="pkg-error-banner" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="attendance-filters">
        <div className="filter-group">
          <label>Date Range</label>
          <div className="filter-input">
            <Calendar size={16} />
            <input
              type="text"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Payment Status</label>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value as "All" | PaymentStatus);
              setPage(1);
            }}
          >
            <option value="All">All (Paid + Unpaid)</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Member Type</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as "All" | MemberType);
              setPage(1);
            }}
          >
            <option value="All">All Types</option>
            {MEMBER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Trainer</label>
          <select
            value={trainerFilter}
            onChange={(e) => {
              setTrainerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Trainers</option>
            {TRAINERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="attendance-toolbar">
        <div className="search-input">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, phone, CNIC..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button className="btn btn-secondary" onClick={handleReset}>
          <RotateCcw size={16} />
          Reset
        </button>
        <button className="btn btn-danger" onClick={handleExport}>
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Stat cards */}
      <div className="attendance-stats">
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <Footprints size={20} />
          </div>
          <div>
            <p className="stat-label">Total Check-ins</p>
            <p className="stat-value">{stats.totalCheckIns}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="stat-label">Present Today</p>
            <p className="stat-value">{stats.present}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-red">
            <UserX size={20} />
          </div>
          <div>
            <p className="stat-label">Absent Today</p>
            <p className="stat-value">{stats.absent}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow">
            <Clock size={20} />
          </div>
          <div>
            <p className="stat-label">No Check-in (7+ Days)</p>
            <p className="stat-value">{stats.noCheckIn}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="attendance-table-wrapper">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Member Name</th>
              <th>Phone</th>
              <th>CNIC</th>
              <th>Package</th>
              <th>Type</th>
              <th>Trainer</th>
              <th>Status</th>
              <th>Check In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="no-results">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && pageMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="no-results">
                  No members found for the selected filters.
                </td>
              </tr>
            )}
            {!loading &&
              pageMembers.map((m, idx) => (
                <tr key={m.id}>
                  <td>{pageStart + idx + 1}.</td>
                  <td>
                    <div className="member-cell">
                      <span>{m.name}</span>
                    </div>
                  </td>
                  <td>{m.phone}</td>
                  <td>{m.cnic}</td>
                  <td>{m.package}</td>
                  <td>{m.type}</td>
                  <td>{m.trainer ?? "-"}</td>
                  <td>
                    <StatusBadge
                      status={m.status}
                      onDoubleClick={() => toggleStatus(m.id)}
                    />
                  </td>
                  <td>{m.checkIn ?? "-"}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-view"
                        onClick={() => setActiveMember(m)}
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        className="btn btn-view"
                        onClick={() => openHistory(m)}
                      >
                        <HistoryIcon size={14} />
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="attendance-pagination">
        <span>
          Showing {pageMembers.length === 0 ? 0 : pageStart + 1} to{" "}
          {Math.min(pageStart + PAGE_SIZE, filteredMembers.length)} of{" "}
          {filteredMembers.length} members
        </span>
        <div className="pagination-controls">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(0, 5)
            .map((p) => (
              <button
                key={p}
                className={p === page ? "active" : ""}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          {totalPages > 5 && <span className="dots">...</span>}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* View Modal */}
      {activeMember && (
        <div className="modal-overlay" onClick={() => setActiveMember(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Member Details</h2>
              <button className="modal-close" onClick={() => setActiveMember(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-profile">
              <div>
                <h3>{activeMember.name}</h3>
                <p>{activeMember.email}</p>
              </div>
              <div className="modal-profile-badges">
                <StatusBadge
                  status={activeMember.status}
                  onDoubleClick={() => toggleStatus(activeMember.id)}
                />
                <PaymentBadge status={activeMember.paymentStatus} />
              </div>
            </div>

            <div className="modal-grid">
              <div className="modal-field">
                <span className="modal-label">Phone</span>
                <span className="modal-value">{activeMember.phone}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">CNIC</span>
                <span className="modal-value">{activeMember.cnic}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Package</span>
                <span className="modal-value">{activeMember.package}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Member Type</span>
                <span className="modal-value">{activeMember.type}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Trainer</span>
                <span className="modal-value">
                  {activeMember.trainer ?? "No trainer assigned"}
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Check-in Time</span>
                <span className="modal-value">
                  {activeMember.checkIn ?? "Not checked in"}
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Joined On</span>
                <span className="modal-value">{activeMember.joinedOn}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Fees Paid On</span>
                <span className="modal-value">{activeMember.feesPaidOn}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Fees Expiry On</span>
                <span className="modal-value modal-value-highlight">
                  {activeMember.feesExpiryOn}
                </span>
              </div>
            </div>

            {/* CNIC IMAGES */}
            <div className="modal-cnic-images">
              <div className="modal-cnic-block">
                <span className="modal-label">CNIC Front</span>
                {activeMember.cnicFrontUrl ? (
                  <div
                    role="link"
                    tabIndex={0}
                    className="modal-cnic-link"
                    onClick={() => openInNewTab(activeMember.cnicFrontUrl as string)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openInNewTab(activeMember.cnicFrontUrl as string);
                    }}
                  >
                    <img
                      src={activeMember.cnicFrontUrl}
                      alt="CNIC Front"
                      className="modal-cnic-img"
                    />
                  </div>
                ) : (
                  <span className="modal-value">Not uploaded</span>
                )}
              </div>

              <div className="modal-cnic-block">
                <span className="modal-label">CNIC Back</span>
                {activeMember.cnicBackUrl ? (
                  <div
                    role="link"
                    tabIndex={0}
                    className="modal-cnic-link"
                    onClick={() => openInNewTab(activeMember.cnicBackUrl as string)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openInNewTab(activeMember.cnicBackUrl as string);
                    }}
                  >
                    <img
                      src={activeMember.cnicBackUrl}
                      alt="CNIC Back"
                      className="modal-cnic-img"
                    />
                  </div>
                ) : (
                  <span className="modal-value">Not uploaded</span>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveMember(null)}>
                Close
              </button>
              <button className="btn btn-danger">Send Reminder</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyMember && (
        <div className="modal-overlay" onClick={closeHistory}>
          <div
            className="modal-card history-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Attendance History</h2>
              <button className="modal-close" onClick={closeHistory}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-profile">
              <div>
                <h3>{historyMember.name}</h3>
                <p>Record since: {history?.member.tracking_from ?? historyMember.joinedOn}</p>
              </div>
            </div>

            {historyError && (
              <div className="pkg-error-banner" role="alert" style={{ marginBottom: 14 }}>
                {historyError}
              </div>
            )}

            {historyLoading && !history && <p className="history-empty">Loading...</p>}

            {history && (
              <>
                {/* Overall (since registration) */}
                <div className="history-tiles">
                  <div className="history-tile">
                    <span className="modal-label">Total Present</span>
                    <span className="history-tile-value history-green">
                      {history.overall.present}
                    </span>
                  </div>
                  <div className="history-tile">
                    <span className="modal-label">Total Absent</span>
                    <span className="history-tile-value history-red">
                      {history.overall.absent}
                    </span>
                  </div>
                  <div className="history-tile">
                    <span className="modal-label">Overall Attendance</span>
                    <span className="history-tile-value">{history.overall.percentage}%</span>
                  </div>
                </div>

                {/* Month navigator */}
                <div className="history-nav">
                  <button
                    className="history-nav-btn"
                    disabled={!prevMonth || historyLoading}
                    onClick={() => prevMonth && loadHistory(historyMember.id, prevMonth.month)}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <select
                    className="history-month-select"
                    value={history.selected_month}
                    disabled={historyLoading}
                    onChange={(e) => loadHistory(historyMember.id, e.target.value)}
                  >
                    {[...history.months].reverse().map((mo) => (
                      <option key={mo.month} value={mo.month}>
                        {mo.label}
                      </option>
                    ))}
                  </select>

                  <button
                    className="history-nav-btn"
                    disabled={!nextMonth || historyLoading}
                    onClick={() => nextMonth && loadHistory(historyMember.id, nextMonth.month)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <p className="history-month-line">
                  <span className="history-green">Present {history.summary.present}</span>
                  <span className="history-dot">•</span>
                  <span className="history-red">Absent {history.summary.absent}</span>
                  <span className="history-dot">•</span>
                  <span>{history.summary.percentage}%</span>
                  <span className="history-dot">•</span>
                  <span>{history.summary.total_days} days</span>
                </p>

                {/* Calendar */}
                <div className={`history-calendar ${historyLoading ? "is-loading" : ""}`}>
                  <div className="calendar-grid calendar-head">
                    {WEEKDAYS.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="calendar-grid">
                    {calendarCells.map((cell, i) =>
                      cell === null ? (
                        <div key={`blank-${i}`} className="cal-cell cal-blank" />
                      ) : (
                        <div
                          key={cell.date}
                          className={`cal-cell ${
                            cell.info
                              ? cell.info.status === "Present"
                                ? "cal-present"
                                : "cal-absent"
                              : "cal-out"
                          } ${cell.date === todayDate ? "cal-today" : ""}`}
                          title={
                            cell.info
                              ? `${cell.date} — ${cell.info.status}${
                                  cell.info.check_in ? ` (${cell.info.check_in})` : ""
                                }`
                              : cell.date
                          }
                        >
                          <span className="cal-day">{cell.day}</span>
                          {cell.info?.status === "Present" && cell.info.check_in && (
                            <span className="cal-time">{cell.info.check_in.slice(0, 5)}</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="history-legend">
                  <span>
                    <i className="legend-dot legend-present" /> Present
                  </span>
                  <span>
                    <i className="legend-dot legend-absent" /> Absent
                  </span>
                  <span>
                    <i className="legend-dot legend-out" /> Before joining / Upcoming
                  </span>
                </div>

                {/* Monthly summary */}
                <h4 className="history-section-title">Monthly Summary</h4>
                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Days</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history.months].reverse().map((mo) => (
                        <tr
                          key={mo.month}
                          className={mo.month === selectedMonthInfo?.month ? "row-active" : ""}
                          onClick={() => loadHistory(historyMember.id, mo.month)}
                        >
                          <td>{mo.label}</td>
                          <td className="history-green">{mo.present}</td>
                          <td className="history-red">{mo.absent}</td>
                          <td>{mo.total_days}</td>
                          <td>{mo.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeHistory}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;