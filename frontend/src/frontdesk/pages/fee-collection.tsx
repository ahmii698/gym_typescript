import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  Wallet,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./fee-collection.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PlanType = "Normal" | "Normal + Trainer" | "Package Only" | "Package + Trainer";
type PaymentStatus = "Paid" | "Unpaid";
type MemberState = "Active" | "Inactive";

interface Member {
  id: number;
  name: string;
  phone: string;
  avatar: string;
  package: string;
  packagePrice: number | null;
  type: PlanType;
  paymentStatus: PaymentStatus;
  memberState: MemberState;
  lastPayment: string | null;
  feeExpire: string | null;
  daysToExpire: number | null;
}

interface PackageItem {
  id: number;
  name: string;
}

interface PaymentRecord {
  id: number;
  amount: string | number;
  status: "paid" | "pending" | "partial";
  paid_on: string | null;
  method: string;
  collected_by: string | null;
  note: string | null;
  created_at: string;
}

type AlertState = { type: "error" | "success"; text: string } | null;

const memberTypeToLabel: Record<string, PlanType> = {
  normal_user: "Normal",
  normal_trainer: "Normal + Trainer",
  package_trainer: "Package + Trainer",
  package_only: "Package Only",
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function mapMember(raw: any): Member {
  return {
    id: raw.id,
    name: raw.full_name,
    phone: raw.contact_number,
    avatar: getInitials(raw.full_name || "?"),
    package: raw.package_name ?? "-",
    packagePrice: raw.package_price !== null ? Number(raw.package_price) : null,
    type: memberTypeToLabel[raw.member_type] ?? "Normal",
    paymentStatus: raw.payment_status === "Paid" ? "Paid" : "Unpaid",
    memberState: raw.is_active ? "Active" : "Inactive",
    lastPayment: raw.last_payment,
    feeExpire: raw.fee_expire,
    daysToExpire: raw.days_to_expire,
  };
}

/* ------------------------------------------------------------------ */
/*  Filter option constants                                            */
/* ------------------------------------------------------------------ */

type TabKey = "all" | "paid" | "unpaid" | "expiring" | "inactive";

const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function FeeCollection() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [members, setMembers] = useState<Member[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState>(null);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"All" | PaymentStatus>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [stateFilter, setStateFilter] = useState<"All" | MemberState>("All");
const [expireFilter, setExpireFilter] = useState<"All" | "Expiring Soon" | "Expired" | "Not Expired">("All");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [collectFor, setCollectFor] = useState<Member | null>(null);

  const showAlert = (type: "error" | "success", text: string) => {
    setAlert({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadMembers = async () => {
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`${API_URL}/members/fee-overview`, { headers: authHeaders() }),
        fetch(`${API_URL}/packages`, { headers: authHeaders() }),
      ]);
      if (mRes.ok) {
        const raw = await mRes.json();
        setMembers(raw.map(mapMember));
      } else if (mRes.status === 401) {
        showAlert("error", "Session expire ho gaya hai, dobara login karo.");
      }
      if (pRes.ok) setPackages(await pRes.json());
    } catch {
      showAlert("error", "Members load nahi ho sake. Backend chal raha hai?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  /* make the page its own scroll container, same as Members / Payments / Add Member / Attendance */
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

  /* ---------------- derived stats (always computed from full data) ---------------- */

  const stats = useMemo(() => {
    const total = members.length;
    const paid = members.filter((m) => m.paymentStatus === "Paid").length;
    const unpaid = members.filter((m) => m.paymentStatus === "Unpaid").length;
    const expiringSoon = members.filter(
      (m) => m.daysToExpire !== null && m.daysToExpire >= 0 && m.daysToExpire <= 3
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

      const days = m.daysToExpire ?? 9999;
      if (expireFilter === "Expiring Soon" && !(days >= 0 && days <= 3)) return false;
      if (expireFilter === "Expired" && days >= 0) return false;
      if (expireFilter === "Not Expired" && days < 0) return false;

      switch (activeTab) {
        case "paid":
          if (m.paymentStatus !== "Paid") return false;
          break;
        case "unpaid":
          if (m.paymentStatus !== "Unpaid") return false;
          break;
        case "expiring":
          if (!(days >= 0 && days <= 3)) return false;
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

  function statusBadge(m: Member) {
    if (m.paymentStatus === "Unpaid") {
      return <span className="fc-badge fc-badge--unpaid">Unpaid</span>;
    }
    if (m.daysToExpire !== null && m.daysToExpire >= 0 && m.daysToExpire <= 3) {
      return <span className="fc-badge fc-badge--expiring">Expiring Soon</span>;
    }
    return <span className="fc-badge fc-badge--paid">Paid</span>;
  }

  const pageAllSelected =
    pageMembers.length > 0 && pageMembers.every((m) => selected.has(m.id));

  /* ---------------- pagination number list ---------------- */

  const pageNumbers = useMemo(() => {
    const nums: (number | "...")[] = [];
    const windowSize = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - windowSize && i <= currentPage + windowSize)
      ) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== "...") {
        nums.push("...");
      }
    }
    return nums;
  }, [totalPages, currentPage]);

  /* ---------------- view modal + history ---------------- */

  const openMember = async (m: Member) => {
    setSelectedMember(m);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/members/${m.id}/payments`, {
        headers: authHeaders(),
      });
      if (res.ok) setHistory(await res.json());
    } catch {
      // silently ignore, history section will just show empty
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFeeCollected = async () => {
    setCollectFor(null);
    setSelectedMember(null);
    showAlert("success", "Fee collect ho gayi.");
    await loadMembers();
  };

  return (
    <div
      className="fc-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {alert && (
        <div className={`fc-alert fc-alert--${alert.type}`} role="alert">
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

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
              {stats.total ? Math.round((stats.paid / stats.total) * 100) : 0}% of total
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
              {stats.total ? Math.round((stats.unpaid / stats.total) * 100) : 0}% of total
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
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-card__icon fc-stat-card__icon--purple">
            <UserX size={20} />
          </div>
          <div className="fc-stat-card__body">
            <span className="fc-stat-card__label">Inactive Members</span>
            <span className="fc-stat-card__value">{stats.inactive}</span>
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
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Membership Type"
        >
          <option value="All">Membership Type: All Types</option>
          {packages.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
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
            {loading && (
              <tr>
                <td colSpan={10} className="fc-empty">
                  Loading members...
                </td>
              </tr>
            )}
            {!loading && pageMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="fc-empty">
                  No members match the current filters.
                </td>
              </tr>
            )}
            {!loading &&
              pageMembers.map((m, idx) => (
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
                  <td className="fc-muted">{m.feeExpire ?? "-"}</td>
                  <td>
                    <div className="fc-actions">
                      <button className="fc-view-btn" onClick={() => openMember(m)}>
                        View
                      </button>
                      <button
                        className="fc-menu-btn"
                        aria-label="Collect Fee"
                        title="Collect Fee"
                        onClick={() => setCollectFor(m)}
                      >
                        <Wallet size={16} />
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

      {/* Member details + payment history modal */}
      {selectedMember && (
        <div className="fc-modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-modal__header">
              <div className="fc-member">
                <span className="fc-avatar fc-avatar--lg">{selectedMember.avatar}</span>
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
                <span className="fc-muted">Package</span>
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
                <span>{selectedMember.feeExpire ?? "-"}</span>
              </div>
              {selectedMember.daysToExpire !== null && (
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
              )}

              <div className="fc-history">
                <span className="fc-history__title">Payment History</span>
                {historyLoading && <span className="fc-muted">Loading...</span>}
                {!historyLoading && history.length === 0 && (
                  <span className="fc-muted">Koi payment record nahi mila.</span>
                )}
                {!historyLoading &&
                  history.map((h) => (
                    <div key={h.id} className="fc-history-item">
                      <div className="fc-history-item__top">
                        <span className="fc-history-item__amount">
                          PKR {Number(h.amount).toLocaleString()}
                        </span>
                        <span
                          className={`fc-badge fc-badge--${
                            h.status === "paid" ? "paid" : "unpaid"
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>
                      <div className="fc-history-item__meta">
                        <span>{h.paid_on ?? "Not paid yet"}</span>
                        <span>{h.method}</span>
                        <span>By {h.collected_by ?? "-"}</span>
                      </div>
                      {h.note && <div className="fc-history-item__note">{h.note}</div>}
                    </div>
                  ))}
              </div>
            </div>

            <div className="fc-modal__footer">
              <button
                className="fc-modal__done-btn"
                style={{ background: "transparent", border: "1px solid var(--fc-panel-border)" }}
                onClick={() => setSelectedMember(null)}
              >
                Close
              </button>
              <button
                className="fc-modal__done-btn"
                onClick={() => setCollectFor(selectedMember)}
              >
                <Wallet size={14} style={{ marginRight: 6 }} />
                Collect Fee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Fee modal */}
      {collectFor && (
        <CollectFeeModal
          member={collectFor}
          onClose={() => setCollectFor(null)}
          onCollected={handleFeeCollected}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collect Fee modal                                                  */
/* ------------------------------------------------------------------ */

interface CollectFeeFormState {
  amount: string;
  status: "paid" | "pending" | "partial";
  method: "cash" | "card" | "bank_transfer" | "online";
  paidOn: string;
  note: string;
}

function CollectFeeModal({
  member,
  onClose,
  onCollected,
}: {
  member: Member;
  onClose: () => void;
  onCollected: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<CollectFeeFormState>({
    amount: member.packagePrice ? String(member.packagePrice) : "",
    status: "paid",
    method: "cash",
    paidOn: today,
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = <K extends keyof CollectFeeFormState>(
    field: K,
    value: CollectFeeFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Sahi amount likho.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: member.id,
          amount: Number(form.amount),
          status: form.status,
          method: form.method,
          paid_on: form.status === "paid" ? form.paidOn : null,
          note: form.note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.message ?? "Fee collect nahi ho saki.");
        return;
      }
      onCollected();
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fc-modal-overlay" onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="fc-modal__header">
          <div>
            <h2 className="fc-modal__name">Collect Fee</h2>
            <span className="fc-muted">{member.name}</span>
          </div>
          <button className="fc-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="fc-modal__body">
          {error && <div className="fc-form-error">{error}</div>}

          <div className="fc-form-field">
            <label>Amount (PKR)</label>
            <input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => updateField("amount", e.target.value)}
              autoFocus
            />
          </div>

          <div className="fc-form-row">
            <div className="fc-form-field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as CollectFeeFormState["status"])
                }
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div className="fc-form-field">
              <label>Method</label>
              <select
                value={form.method}
                onChange={(e) =>
                  updateField("method", e.target.value as CollectFeeFormState["method"])
                }
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          {form.status === "paid" && (
            <div className="fc-form-field">
              <label>Paid On</label>
              <input
                type="date"
                value={form.paidOn}
                onChange={(e) => updateField("paidOn", e.target.value)}
              />
            </div>
          )}

          <div className="fc-form-field">
            <label>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Monthly renewal"
              value={form.note}
              onChange={(e) => updateField("note", e.target.value)}
            />
          </div>
        </div>

        <div className="fc-modal__footer">
          <button
            className="fc-modal__done-btn"
            style={{ background: "transparent", border: "1px solid var(--fc-panel-border)" }}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="fc-modal__done-btn" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeeCollection;