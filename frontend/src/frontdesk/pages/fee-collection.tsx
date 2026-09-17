import React, { useMemo, useState } from "react";
import {
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserX,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
} from "lucide-react";
import "./fee-collection.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PackageType = "Basic" | "Standard" | "Premium";
type PlanType = "Normal" | "Normal + Trainer" | "Package Only" | "Package + Trainer";
type PaymentStatus = "Paid" | "Unpaid";
type MemberState = "Active" | "Inactive";

interface Member {
  id: number;
  name: string;
  phone: string;
  avatar: string;
  package: PackageType;
  type: PlanType;
  paymentStatus: PaymentStatus;
  memberState: MemberState;
  lastPayment: string | null; // ISO date or null if unpaid
  feeExpire: string; // ISO date
  daysToExpire: number; // negative = already expired
}

/* ------------------------------------------------------------------ */
/*  Mock data generation (swap this out for your real API call)       */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = [
  "Ahmed", "Ayesha", "Bilal", "Sara", "Usman", "Zainab", "Hassan", "Aliza",
  "Tariq", "Aqsa", "Fahad", "Mahnoor", "Hamza", "Sana", "Imran", "Rabia",
  "Saad", "Laiba", "Kashif", "Hira", "Asad", "Mehak", "Noman", "Iqra",
  "Waqas", "Anum", "Shahzad", "Nida", "Farhan", "Komal",
];
const LAST_NAMES = [
  "Khan", "Fatima", "Hussain", "Malik", "Ali", "Raza", "Sheikh", "Javed",
  "Noor", "Iqbal", "Ahmed", "Baig", "Butt", "Qureshi", "Chaudhry", "Abbasi",
  "Siddiqui", "Farooq", "Rashid", "Anwar",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date) {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function generateMembers(count: number): Member[] {
  const rand = seededRandom(42);
  const today = new Date("2025-09-01T00:00:00Z");
  const packages: PackageType[] = ["Basic", "Standard", "Premium"];
  const types: PlanType[] = [
    "Normal",
    "Normal + Trainer",
    "Package Only",
    "Package + Trainer",
  ];

  const members: Member[] = [];

  for (let i = 1; i <= count; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const pkg = packages[Math.floor(rand() * packages.length)];
    const type = types[Math.floor(rand() * types.length)];

    const isPaid = rand() < 0.75; // ~75% paid, matches the source dashboard ratio
    const isActive = rand() < 0.95; // ~5% inactive

    // days offset from "today" for fee expiry, ranges roughly -20 .. +40
    const offset = Math.floor(rand() * 60) - 20;
    const feeExpireDate = new Date(today);
    feeExpireDate.setDate(feeExpireDate.getDate() + offset);

    let lastPaymentDate: Date | null = null;
    if (isPaid) {
      lastPaymentDate = new Date(feeExpireDate);
      lastPaymentDate.setDate(lastPaymentDate.getDate() - 30);
    }

    members.push({
      id: i,
      name: `${first} ${last}`,
      phone: `03${Math.floor(rand() * 9) + 1}${pad(Math.floor(rand() * 90) + 10)}-${pad(
        Math.floor(rand() * 90) + 10
      )}${pad(Math.floor(rand() * 90) + 10)}${Math.floor(rand() * 9)}`,
      avatar: `${first[0]}${last[0]}`,
      package: pkg,
      type,
      paymentStatus: isPaid ? "Paid" : "Unpaid",
      memberState: isActive ? "Active" : "Inactive",
      lastPayment: lastPaymentDate ? formatDate(lastPaymentDate) : null,
      feeExpire: formatDate(feeExpireDate),
      daysToExpire: offset,
    });
  }

  return members;
}

/* ------------------------------------------------------------------ */
/*  Filter option constants                                            */
/* ------------------------------------------------------------------ */

type TabKey = "all" | "paid" | "unpaid" | "expiring" | "inactive";

const PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function FeeCollection() {
  // Members now live in state (not a fixed constant) so quick status
  // toggles actually stick instead of resetting on next render.
  const [members, setMembers] = useState<Member[]>(() => generateMembers(248));

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"All" | PaymentStatus>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | PackageType>("All");
  const [stateFilter, setStateFilter] = useState<"All" | MemberState>("All");
  const [expireFilter, setExpireFilter] = useState<
    "All" | "Expiring Soon" | "Expired" | "Not Expired"
  >("All");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  // Which member's details modal is currently open ("View" button)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  /* ---------------- derived stats (always computed from full data) ---------------- */

  const stats = useMemo(() => {
    const total = members.length;
    const paid = members.filter((m) => m.paymentStatus === "Paid").length;
    const unpaid = members.filter((m) => m.paymentStatus === "Unpaid").length;
    const expiringSoon = members.filter(
      (m) => m.daysToExpire >= 0 && m.daysToExpire <= 3
    ).length;
    const inactive = members.filter((m) => m.memberState === "Inactive").length;
    return { total, paid, unpaid, expiringSoon, inactive };
  }, [members]);

  /* ---------------- filtering ---------------- */

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (
        search.trim() &&
        !m.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        !m.phone.includes(search.trim())
      ) {
        return false;
      }

      if (paymentFilter !== "All" && m.paymentStatus !== paymentFilter) return false;
      if (typeFilter !== "All" && m.package !== typeFilter) return false;
      if (stateFilter !== "All" && m.memberState !== stateFilter) return false;

      if (expireFilter === "Expiring Soon" && !(m.daysToExpire >= 0 && m.daysToExpire <= 3))
        return false;
      if (expireFilter === "Expired" && m.daysToExpire >= 0) return false;
      if (expireFilter === "Not Expired" && m.daysToExpire < 0) return false;

      switch (activeTab) {
        case "paid":
          if (m.paymentStatus !== "Paid") return false;
          break;
        case "unpaid":
          if (m.paymentStatus !== "Unpaid") return false;
          break;
        case "expiring":
          if (!(m.daysToExpire >= 0 && m.daysToExpire <= 3)) return false;
          break;
        case "inactive":
          if (m.memberState !== "Inactive") return false;
          break;
        default:
          break;
      }

      return true;
    });
  }, [members, search, paymentFilter, typeFilter, stateFilter, expireFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageMembers = filteredMembers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function changeTab(tab: TabKey) {
    setActiveTab(tab);
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setPaymentFilter("All");
    setTypeFilter("All");
    setStateFilter("All");
    setExpireFilter("All");
    setActiveTab("all");
    setPage(1);
    setSelected(new Set());
  }

  function toggleSelectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageMembers.every((m) => next.has(m.id));
      if (allSelected) {
        pageMembers.forEach((m) => next.delete(m.id));
      } else {
        pageMembers.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  function toggleSelectOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Double-click on a status badge quickly flips Paid <-> Unpaid.
  // "Expiring Soon" is a computed state (Paid + close to expiry), not a
  // real status, so it's intentionally NOT toggled by double-click.
  function toggleQuickPaymentStatus(m: Member) {
    setMembers((prev) =>
      prev.map((mm) => {
        if (mm.id !== m.id) return mm;
        const nextStatus: PaymentStatus = mm.paymentStatus === "Paid" ? "Unpaid" : "Paid";
        return {
          ...mm,
          paymentStatus: nextStatus,
          lastPayment: nextStatus === "Paid" ? formatDate(new Date()) : mm.lastPayment,
        };
      })
    );
  }

  function statusBadge(m: Member) {
    if (m.paymentStatus === "Unpaid") {
      return (
        <span
          className="fc-badge fc-badge--unpaid"
          onDoubleClick={() => toggleQuickPaymentStatus(m)}
          title="Double-click to mark as Paid"
        >
          Unpaid
        </span>
      );
    }
    if (m.daysToExpire >= 0 && m.daysToExpire <= 3) {
      // Expiring Soon — not double-click toggleable on purpose.
      return <span className="fc-badge fc-badge--expiring">Expiring Soon</span>;
    }
    return (
      <span
        className="fc-badge fc-badge--paid"
        onDoubleClick={() => toggleQuickPaymentStatus(m)}
        title="Double-click to mark as Unpaid"
      >
        Paid
      </span>
    );
  }

  const pageAllSelected =
    pageMembers.length > 0 && pageMembers.every((m) => selected.has(m.id));

  /* ---------------- pagination number list ---------------- */

  const pageNumbers = useMemo(() => {
    const nums: (number | "...")[] = [];
    const window = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - window && i <= currentPage + window)
      ) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== "...") {
        nums.push("...");
      }
    }
    return nums;
  }, [totalPages, currentPage]);

  return (
    <div className="fc-page">
      {/* Header */}
      <div className="fc-header">
        <div className="fc-header__icon">
          <Users size={20} />
        </div>
        <div>
          <h1 className="fc-header__title">Fee Collection</h1>
          <p className="fc-header__subtitle">
            Track and manage member fees, payments and due amounts
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="fc-stats">
        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--green">
            <Users size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Total Members</span>
            <span className="fc-stat-card__value">{stats.total}</span>
            <span className="fc-stat-card__delta fc-stat-card__delta--up">
              ↑ 12% from last month
            </span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--teal">
            <CheckCircle2 size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Paid Members</span>
            <span className="fc-stat-card__value">{stats.paid}</span>
            <span className="fc-stat-card__delta">
              {Math.round((stats.paid / stats.total) * 100)}% of total
            </span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--red">
            <AlertCircle size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Unpaid Members</span>
            <span className="fc-stat-card__value">{stats.unpaid}</span>
            <span className="fc-stat-card__delta fc-stat-card__delta--down">
              {Math.round((stats.unpaid / stats.total) * 100)}% of total
            </span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--orange">
            <Clock size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Expiring Soon (3 Days)</span>
            <span className="fc-stat-card__value">{stats.expiringSoon}</span>
            <span className="fc-stat-card__delta fc-stat-card__delta--warn">
              {Math.round((stats.expiringSoon / stats.total) * 100)}% of total
            </span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--purple">
            <UserX size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Inactive Members</span>
            <span className="fc-stat-card__value">{stats.inactive}</span>
            <span className="fc-stat-card__delta">
              {Math.round((stats.inactive / stats.total) * 100)}% of total
            </span>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="fc-toolbar">
        <div className="fc-search">
          <Search size={16} className="fc-search__icon" />
          <input
            type="text"
            placeholder="Search Member..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="fc-select"
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value as "All" | PaymentStatus);
            setPage(1);
          }}
          aria-label="Payment Status"
        >
          <option value="All">Payment Status: All (Paid + Unpaid)</option>
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
        </select>

        <select
          className="fc-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as "All" | PackageType);
            setPage(1);
          }}
          aria-label="Membership Type"
        >
          <option value="All">Membership Type: All Types</option>
          <option value="Basic">Basic</option>
          <option value="Standard">Standard</option>
          <option value="Premium">Premium</option>
        </select>

        <select
          className="fc-select"
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value as "All" | MemberState);
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="All">Status: All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select
          className="fc-select"
          value={expireFilter}
          onChange={(e) => {
            setExpireFilter(
              e.target.value as "All" | "Expiring Soon" | "Expired" | "Not Expired"
            );
            setPage(1);
          }}
          aria-label="Fee Expire"
        >
          <option value="All">Fee Expire: All (Not Expired)</option>
          <option value="Expiring Soon">Expiring Soon (3 Days)</option>
          <option value="Expired">Already Expired</option>
          <option value="Not Expired">Not Expired</option>
        </select>
      </div>

      {/* Tabs + reset */}
      <div className="fc-tabs-row">
        <div className="fc-tabs">
          <button
            className={`fc-tab ${activeTab === "all" ? "fc-tab--active" : ""}`}
            onClick={() => changeTab("all")}
          >
            All Members ({stats.total})
          </button>
          <button
            className={`fc-tab ${activeTab === "paid" ? "fc-tab--active" : ""}`}
            onClick={() => changeTab("paid")}
          >
            Paid ({stats.paid})
          </button>
          <button
            className={`fc-tab ${activeTab === "unpaid" ? "fc-tab--active" : ""}`}
            onClick={() => changeTab("unpaid")}
          >
            Unpaid ({stats.unpaid})
          </button>
          <button
            className={`fc-tab ${activeTab === "expiring" ? "fc-tab--active" : ""}`}
            onClick={() => changeTab("expiring")}
          >
            Expiring Soon ({stats.expiringSoon})
          </button>
          <button
            className={`fc-tab ${activeTab === "inactive" ? "fc-tab--active" : ""}`}
            onClick={() => changeTab("inactive")}
          >
            Inactive ({stats.inactive})
          </button>
        </div>

        <button className="fc-reset-btn" onClick={resetFilters}>
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead>
            <tr>
              <th className="fc-th-checkbox">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleSelectAllOnPage}
                />
              </th>
              <th>#</th>
              <th>Member Name</th>
              <th>Phone</th>
              <th>Package</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Payment</th>
              <th>Fee Expire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="fc-empty">
                  No members match the current filters.
                </td>
              </tr>
            )}
            {pageMembers.map((m, idx) => (
              <tr key={m.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleSelectOne(m.id)}
                  />
                </td>
                <td className="fc-muted">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                <td>
                  <div className="fc-member">
                    <span className="fc-avatar">{m.avatar}</span>
                    <span>{m.name}</span>
                    {m.memberState === "Inactive" && (
                      <span className="fc-inactive-tag">Inactive</span>
                    )}
                  </div>
                </td>
                <td className="fc-muted">{m.phone}</td>
                <td>{m.package}</td>
                <td className="fc-muted">{m.type}</td>
                <td>{statusBadge(m)}</td>
                <td className="fc-muted">{m.lastPayment ?? "-"}</td>
                <td className="fc-muted">{m.feeExpire}</td>
                <td>
                  <div className="fc-actions">
                    <button
                      className="fc-view-btn"
                      onClick={() => setSelectedMember(m)}
                    >
                      View
                    </button>
                    <button className="fc-menu-btn" aria-label="More actions">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="fc-footer">
        <span className="fc-muted">
          Showing {pageMembers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
          {" "}
          to {(currentPage - 1) * PAGE_SIZE + pageMembers.length} of{" "}
          {filteredMembers.length} members
        </span>

        <div className="fc-pagination">
          <button
            className="fc-page-btn"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {pageNumbers.map((n, i) =>
            n === "..." ? (
              <span key={`ellipsis-${i}`} className="fc-page-ellipsis">
                ...
              </span>
            ) : (
              <button
                key={n}
                className={`fc-page-btn ${
                  n === currentPage ? "fc-page-btn--active" : ""
                }`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            )
          )}

          <button
            className="fc-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Member details modal (opened by the "View" button) */}
      {selectedMember && (
        <div
          className="fc-modal-overlay"
          onClick={() => setSelectedMember(null)}
        >
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal__header">
              <div className="fc-member">
                <span className="fc-avatar fc-avatar--lg">
                  {selectedMember.avatar}
                </span>
                <div>
                  <h2 className="fc-modal__name">{selectedMember.name}</h2>
                  <span className="fc-muted">{selectedMember.phone}</span>
                </div>
              </div>
              <button
                className="fc-modal__close"
                onClick={() => setSelectedMember(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="fc-modal__body">
              <div className="fc-modal__row">
                <span className="fc-muted">Status</span>
                {statusBadge(selectedMember)}
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Membership</span>
                <span>{selectedMember.package}</span>
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Plan Type</span>
                <span>{selectedMember.type}</span>
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Member State</span>
                <span>{selectedMember.memberState}</span>
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Last Payment</span>
                <span>{selectedMember.lastPayment ?? "Never paid"}</span>
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Fee Expires On</span>
                <span>{selectedMember.feeExpire}</span>
              </div>
              <div className="fc-modal__row">
                <span className="fc-muted">Days To Expiry</span>
                <span
                  className={
                    selectedMember.daysToExpire < 0
                      ? "fc-modal__expiry fc-modal__expiry--bad"
                      : selectedMember.daysToExpire <= 3
                      ? "fc-modal__expiry fc-modal__expiry--warn"
                      : "fc-modal__expiry"
                  }
                >
                  {selectedMember.daysToExpire >= 0
                    ? `Expires in ${selectedMember.daysToExpire} day${
                        selectedMember.daysToExpire === 1 ? "" : "s"
                      }`
                    : `Expired ${Math.abs(selectedMember.daysToExpire)} day${
                        Math.abs(selectedMember.daysToExpire) === 1 ? "" : "s"
                      } ago`}
                </span>
              </div>
            </div>

            <div className="fc-modal__footer">
              <span className="fc-muted" style={{ fontSize: 12 }}>
                Tip: double-click the status badge to toggle Paid/Unpaid
              </span>
              <button
                className="fc-modal__done-btn"
                onClick={() => setSelectedMember(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeeCollection;