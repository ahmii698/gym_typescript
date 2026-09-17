import React, { useState, useMemo } from "react";
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
} from "lucide-react";
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
  avatar: string;
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
}

// ------------------------------------------------------------------
// Mock data (replace with API data)
// ------------------------------------------------------------------
const MOCK_MEMBERS: Member[] = [
  {
    id: 1,
    name: "Ahmed Khan",
    avatar: "https://i.pravatar.cc/80?img=12",
    phone: "0300-1234567",
    cnic: "42101-1234567-1",
    package: "Premium",
    type: "Normal",
    trainer: null,
    status: "Present",
    checkIn: "08:45 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 01, 2025",
    feesExpiryOn: "Sep 01, 2025",
    joinedOn: "Jan 12, 2024",
    email: "ahmed.khan@example.com",
  },
  {
    id: 2,
    name: "Ayesha Fatima",
    avatar: "https://i.pravatar.cc/80?img=45",
    phone: "0321-7654321",
    cnic: "42101-9876543-2",
    package: "Standard",
    type: "Normal + Trainer",
    trainer: "Ali Raza",
    status: "Present",
    checkIn: "09:12 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 05, 2025",
    feesExpiryOn: "Sep 05, 2025",
    joinedOn: "Mar 03, 2024",
    email: "ayesha.fatima@example.com",
  },
  {
    id: 3,
    name: "Bilal Hussain",
    avatar: "https://i.pravatar.cc/80?img=33",
    phone: "0305-1112233",
    cnic: "42101-5566778-3",
    package: "Basic",
    type: "Package Only",
    trainer: null,
    status: "Absent",
    checkIn: null,
    paymentStatus: "Unpaid",
    feesPaidOn: "Jul 10, 2025",
    feesExpiryOn: "Aug 10, 2025",
    joinedOn: "Jul 10, 2024",
    email: "bilal.hussain@example.com",
  },
  {
    id: 4,
    name: "Sara Khan",
    avatar: "https://i.pravatar.cc/80?img=47",
    phone: "0312-3344556",
    cnic: "42101-1122334-4",
    package: "Premium",
    type: "Normal + Trainer",
    trainer: "Usman Ali",
    status: "Present",
    checkIn: "08:58 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 02, 2025",
    feesExpiryOn: "Sep 02, 2025",
    joinedOn: "Feb 20, 2024",
    email: "sara.khan@example.com",
  },
  {
    id: 5,
    name: "Usman Ali",
    avatar: "https://i.pravatar.cc/80?img=51",
    phone: "0307-7788990",
    cnic: "42101-6677889-5",
    package: "Standard",
    type: "Normal",
    trainer: null,
    status: "Present",
    checkIn: "09:20 AM",
    paymentStatus: "Unpaid",
    feesPaidOn: "Jul 28, 2025",
    feesExpiryOn: "Aug 28, 2025",
    joinedOn: "May 15, 2024",
    email: "usman.ali@example.com",
  },
  {
    id: 6,
    name: "Zainab Malik",
    avatar: "https://i.pravatar.cc/80?img=29",
    phone: "0333-4455667",
    cnic: "42101-2233445-6",
    package: "Premium",
    type: "Package + Trainer",
    trainer: "Bilal Khan",
    status: "Present",
    checkIn: "08:40 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 08, 2025",
    feesExpiryOn: "Sep 08, 2025",
    joinedOn: "Sep 09, 2023",
    email: "zainab.malik@example.com",
  },
  {
    id: 7,
    name: "Hassan Raza",
    avatar: "https://i.pravatar.cc/80?img=15",
    phone: "0345-6677889",
    cnic: "42101-7788990-7",
    package: "Basic",
    type: "Normal",
    trainer: null,
    status: "Absent",
    checkIn: null,
    paymentStatus: "Unpaid",
    feesPaidOn: "Jul 01, 2025",
    feesExpiryOn: "Aug 01, 2025",
    joinedOn: "Nov 11, 2023",
    email: "hassan.raza@example.com",
  },
  {
    id: 8,
    name: "Aliza Sheikh",
    avatar: "https://i.pravatar.cc/80?img=24",
    phone: "0309-9988776",
    cnic: "42101-3344556-8",
    package: "Standard",
    type: "Normal + Trainer",
    trainer: "Usman Ali",
    status: "Present",
    checkIn: "09:05 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 03, 2025",
    feesExpiryOn: "Sep 03, 2025",
    joinedOn: "Apr 04, 2024",
    email: "aliza.sheikh@example.com",
  },
  {
    id: 9,
    name: "Tariq Javed",
    avatar: "https://i.pravatar.cc/80?img=8",
    phone: "0318-5566778",
    cnic: "42101-8899001-9",
    package: "Premium",
    type: "Package Only",
    trainer: null,
    status: "Present",
    checkIn: "08:52 AM",
    paymentStatus: "Paid",
    feesPaidOn: "Aug 06, 2025",
    feesExpiryOn: "Sep 06, 2025",
    joinedOn: "Dec 25, 2023",
    email: "tariq.javed@example.com",
  },
  {
    id: 10,
    name: "Nimra Iqbal",
    avatar: "https://i.pravatar.cc/80?img=38",
    phone: "0322-6677880",
    cnic: "42101-4455667-0",
    package: "Standard",
    type: "Normal",
    trainer: null,
    // was "Late" — collapsed into Absent since only Present/Absent exist now
    status: "Absent",
    checkIn: "09:32 AM",
    paymentStatus: "Unpaid",
    feesPaidOn: "Jul 15, 2025",
    feesExpiryOn: "Aug 15, 2025",
    joinedOn: "Jun 06, 2024",
    email: "nimra.iqbal@example.com",
  },
];

const TRAINERS = ["Ali Raza", "Usman Ali", "Bilal Khan"];
const MEMBER_TYPES: MemberType[] = [
  "Normal",
  "Normal + Trainer",
  "Package Only",
  "Package + Trainer",
];

const PAGE_SIZE = 10;

// ------------------------------------------------------------------
// Small presentational helpers
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
const AttendancePage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(MOCK_MEMBERS);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"All" | PaymentStatus>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | MemberType>("All");
  const [trainerFilter, setTrainerFilter] = useState<"All" | string>("All");
  const [dateRange, setDateRange] = useState("Aug 23, 2025 - Aug 30, 2025");
  const [page, setPage] = useState(1);
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  // Toggle Present <-> Absent for a given member (used on badge double-click)
  const toggleStatus = (id: number) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === "Present" ? "Absent" : "Present",
              // keep check-in time in sync: clear it when marked Absent
              checkIn: m.status === "Present" ? null : m.checkIn ?? "—",
            }
          : m
      )
    );
    // keep the modal in sync if the toggled member is currently open
    setActiveMember((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: prev.status === "Present" ? "Absent" : "Present",
            checkIn: prev.status === "Present" ? null : prev.checkIn ?? "—",
          }
        : prev
    );
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
    <div className="attendance-page">
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
            <p className="stat-delta stat-delta-up">↑ 12% from last week</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="stat-label">Present Today</p>
            <p className="stat-value">{stats.present}</p>
            <p className="stat-delta stat-delta-up">↑ 8% from last week</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-red">
            <UserX size={20} />
          </div>
          <div>
            <p className="stat-label">Absent Today</p>
            <p className="stat-value">{stats.absent}</p>
            <p className="stat-delta stat-delta-down">↓ 5% from last week</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow">
            <Clock size={20} />
          </div>
          <div>
            <p className="stat-label">No Check-in (7+ Days)</p>
            <p className="stat-value">{stats.noCheckIn}</p>
            <p className="stat-delta stat-delta-down">↓ 3% from last week</p>
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
            {pageMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="no-results">
                  No members found for the selected filters.
                </td>
              </tr>
            )}
            {pageMembers.map((m, idx) => (
              <tr key={m.id}>
                <td>{pageStart + idx + 1}.</td>
                <td>
                  <div className="member-cell">
                    <img src={m.avatar} alt={m.name} />
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
                  <button
                    className="btn btn-view"
                    onClick={() => setActiveMember(m)}
                  >
                    <Eye size={14} />
                    View
                  </button>
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
              <img src={activeMember.avatar} alt={activeMember.name} />
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

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveMember(null)}>
                Close
              </button>
              <button className="btn btn-danger">Send Reminder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;