import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Wallet,
  Calendar,
  Search,
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Coins,
  TrendingUp,
  Clock,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./Memberships.css";

/* ----------------------------- Types ----------------------------- */

type MembershipType = "Normal" | "Normal + Trainer" | "Package Only" | "Package + Trainer";
type PaymentStatus = "Paid" | "Unpaid";
type TabKey = "All" | MembershipType;

interface MonthlyFee {
  id: number;
  member_id: number;
  month_number: number;
  fee_amount: number;
  valid_from: string;
  valid_till: string;
  status: "paid" | "pending";
  paid_on?: string | null;
  note?: string | null;
}

interface ApiRow {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  package: string;
  type: MembershipType;
  trainer: string | null;
  payment_status: PaymentStatus;
  fees_paid_on: string | null;
  fees_expiry_on: string | null;
  joined_on: string | null;
  email: string;
  cnic_front_url: string | null;
  cnic_back_url: string | null;
  monthly_fees?: MonthlyFee[];
}

interface MembershipRecord {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  email: string;
  pkg: string;
  plan: string;
  trainer: string;
  membershipType: MembershipType;
  paymentStatus: PaymentStatus;
  joinedOn: string;
  feesPaidOn: string;
  expiryDate: string;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
  monthlyFees: MonthlyFee[];
}

/* ----------------------------- Helpers ----------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDateLong = (d: Date) =>
  `${DAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toISO = (v: unknown): string => {
  if (!v || v === "-") return "";
  return String(v).slice(0, 10);
};

const fmtISO = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};

const dash = (v: unknown) =>
  v !== null && typeof v !== "undefined" && String(v).trim() !== "" ? String(v) : "—";

const formatPrice = (n: number | string): string => {
  const num = Number(n);
  if (isNaN(num)) return "Rs 0";
  return `Rs ${num.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
};

const daysBetween = (a: string, b: string) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
};

const planOf = (start: string, end: string): string => {
  const days = daysBetween(start, end);
  if (days <= 0) return "—";
  if (days <= 35) return "Monthly";
  if (days >= 80 && days <= 100) return "Quarterly";
  if (days >= 350 && days <= 380) return "Yearly";
  return `${Math.max(1, Math.round(days / 30))} Months`;
};

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const typeClass = (t: MembershipType) => {
  if (t === "Package Only") return "ms-badge package";
  if (t === "Package + Trainer") return "ms-badge trainer";
  if (t === "Normal + Trainer") return "ms-badge normal-trainer";
  return "ms-badge normal";
};

const extractList = (json: any): ApiRow[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
};

const mapRow = (m: ApiRow): MembershipRecord => {
  const joinedOn = toISO(m.joined_on);
  const expiryDate = toISO(m.fees_expiry_on);

  return {
    id: m.id,
    name: m.name ?? "",
    phone: m.phone ?? "",
    cnic: m.cnic ?? "",
    email: m.email ?? "",
    pkg: m.package || "—",
    plan: planOf(joinedOn, expiryDate),
    trainer: m.trainer ?? "",
    membershipType: m.type ?? "Normal",
    paymentStatus: m.payment_status ?? "Unpaid",
    joinedOn,
    feesPaidOn: toISO(m.fees_paid_on),
    expiryDate,
    cnicFrontUrl: m.cnic_front_url ?? null,
    cnicBackUrl: m.cnic_back_url ?? null,
    monthlyFees: Array.isArray(m.monthly_fees) ? m.monthly_fees : [],
  };
};

/* Helper: Naye monthlyFees ke hisaab se expiry date nikaalein */
const computeExpiryFromMonthlyFees = (fees: MonthlyFee[], fallback: string): string => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.valid_till;
    }
  }

  const sorted = [...fees].sort((a, b) => a.month_number - b.month_number);
  const nextPending = sorted.find((mf) => mf.status === "pending");
  if (nextPending) return nextPending.valid_till;

  return sorted[sorted.length - 1]?.valid_till ?? fallback;
};

/* Helper: Rolling window ke hisaab se payment status */
const computePaymentStatusFromMonthlyFees = (
  fees: MonthlyFee[],
  fallback: PaymentStatus
): PaymentStatus => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.status === "paid" ? "Paid" : "Unpaid";
    }
  }

  return "Unpaid";
};

/* Helper: Rolling window ke hisaab se feesPaidOn */
const computeFeesPaidOnFromMonthlyFees = (
  fees: MonthlyFee[],
  fallback: string
): string => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.status === "paid" && mf.paid_on ? mf.paid_on : "";
    }
  }

  return "";
};

/* Helper: Aaj ke date ke andar wali monthly fee dhundein */
const findCurrentMonthFee = (fees: MonthlyFee[]): MonthlyFee | null => {
  if (!fees || fees.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf;
    }
  }

  return null;
};

/* CNIC image */
const CnicImage = ({ url, label }: { url: string | null; label: string }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) return <span className="ms-detail-value">Not uploaded</span>;

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="ms-cnic-fail">
        Image load nahi hui, link kholo
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ms-cnic-link">
      <img src={url} alt={label} className="ms-cnic-img" onError={() => setFailed(true)} />
    </a>
  );
};

const TABS: TabKey[] = ["All", "Normal", "Normal + Trainer", "Package Only", "Package + Trainer"];
const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ----------------------------- Component ----------------------------- */

const Memberships = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [members, setMembers] = useState<MembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<TabKey>("All");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("All Plans");
  const [page, setPage] = useState(1);
  const [activeMember, setActiveMember] = useState<MembershipRecord | null>(null);

  const [togglingFeeId, setTogglingFeeId] = useState<number | null>(null);

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
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeMember) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMember(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMember]);

  const loadMembers = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/attendance?date=${localISO(new Date())}`, {
        signal,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) throw new Error("Session expire ho gaya, dobara login karo.");
      if (!res.ok) throw new Error(`Members load nahi huay (${res.status}).`);

      const list = extractList(await res.json()).map(mapRow);
      list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      setMembers(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Kuch ghalat ho gaya.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadMembers(controller.signal);
    return () => controller.abort();
  }, [loadMembers, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, plan]);

  /* ---- Stats ---- */
  const todayISO = localISO(now);

  const stats = useMemo(() => {
    const expired = members.filter((m) => m.expiryDate && m.expiryDate < todayISO).length;
    const unpaid = members.filter((m) => m.paymentStatus === "Unpaid").length;

    // Current month ki fees calculate karein
    let totalMonthFees = 0;
    let collectedMonthFees = 0;

    members.forEach((m) => {
      const currentFee = findCurrentMonthFee(m.monthlyFees);
      if (currentFee) {
        totalMonthFees += Number(currentFee.fee_amount);
        if (currentFee.status === "paid") {
          collectedMonthFees += Number(currentFee.fee_amount);
        }
      }
    });

    const remainingMonthFees = Math.max(0, totalMonthFees - collectedMonthFees);

    return [
      {
        id: "total",
        title: "Total Members",
        period: "All time",
        value: String(members.length),
        variant: "red",
        icon: <Users size={26} />,
      },
      {
        id: "active",
        title: "Active Members",
        period: "Fees valid",
        value: String(members.length - expired),
        variant: "green",
        icon: <UserCheck size={26} />,
      },
      {
        id: "expired",
        title: "Expired Members",
        period: "Fees expired",
        value: String(expired),
        variant: "amber",
        icon: <UserX size={26} />,
      },
      {
        id: "unpaid",
        title: "Unpaid Members",
        period: "Payment pending",
        value: String(unpaid),
        variant: "orange",
        icon: <Wallet size={26} />,
      },
      {
        id: "total-month",
        title: "This Month Fees",
        period: "Total Expected",
        value: formatPrice(totalMonthFees),
        variant: "red",
        icon: <Coins size={26} />,
      },
      {
        id: "collected-month",
        title: "Collected This Month",
        period: "Received",
        value: formatPrice(collectedMonthFees),
        variant: "green",
        icon: <TrendingUp size={26} />,
      },
      {
        id: "remaining-month",
        title: "Remaining This Month",
        period: "Pending",
        value: formatPrice(remainingMonthFees),
        variant: "amber",
        icon: <Clock size={26} />,
      },
    ];
  }, [members, todayISO]);

  const planOptions = useMemo(() => {
    const set = new Set(members.map((m) => m.plan).filter((p) => p && p !== "—"));
    return ["All Plans", ...Array.from(set).sort()];
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[\s-]/g, "");

    return members.filter((m) => {
      if (tab !== "All" && m.membershipType !== tab) return false;
      if (plan !== "All Plans" && m.plan !== plan) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.pkg.toLowerCase().includes(q) ||
        m.trainer.toLowerCase().includes(q) ||
        (qDigits.length > 0 &&
          (m.phone.replace(/\s/g, "").includes(qDigits) || m.cnic.replace(/-/g, "").includes(qDigits)))
      );
    });
  }, [members, tab, query, plan]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  const payClass = (s: PaymentStatus) => `ms-pay ${s.toLowerCase()}`;

  /* ---------- Toggle Monthly Fee (Mark Paid / Unmark) ---------- */
  const toggleMonthlyFee = async (feeId: number) => {
    setTogglingFeeId(feeId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/member-monthly-fees/${feeId}/toggle`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.message ?? "Update nahi ho saka");
        return;
      }

      if (activeMember) {
        const updatedMonthlyFees = activeMember.monthlyFees.map((mf) =>
          mf.id === feeId
            ? {
                ...mf,
                status: mf.status === "paid" ? ("pending" as const) : ("paid" as const),
                paid_on: mf.status === "paid" ? null : new Date().toISOString().slice(0, 10),
              }
            : mf
        );

        const newPaymentStatus = computePaymentStatusFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.paymentStatus
        );

        const newFeesPaidOn = computeFeesPaidOnFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.feesPaidOn
        );

        const newExpiry = computeExpiryFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.expiryDate
        );

        const updatedMember: MembershipRecord = {
          ...activeMember,
          monthlyFees: updatedMonthlyFees,
          paymentStatus: newPaymentStatus,
          expiryDate: newExpiry,
          feesPaidOn: newFeesPaidOn,
        };

        setActiveMember(updatedMember);

        setMembers((prev) =>
          prev.map((m) => (m.id === activeMember.id ? updatedMember : m))
        );
      }
    } catch {
      alert("Server se connect nahi ho saka.");
    } finally {
      setTogglingFeeId(null);
    }
  };

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
        {stats.map((s) => (
          <div key={s.id} className="ms-stat-card">
            <div className={`ms-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="ms-stat-info">
              <span className="ms-stat-title">{s.title}</span>
              <span className="ms-stat-period">{s.period}</span>
              <span className="ms-stat-value">{loading ? "—" : s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="ms-panel">
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
              <select className="ms-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {planOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="ms-select-icon" />
            </div>
          </div>
        </div>

        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>CNIC</th>
                <th>Package</th>
                <th>Plan</th>
                <th>Trainer</th>
                <th className="center">Payment</th>
                <th>Fees Paid On</th>
                <th>Expiry Date</th>
                <th className="center">Membership Type</th>
                <th className="center">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="ms-empty">
                    Loading members...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="ms-empty ms-error">
                    <div>{error}</div>
                    <button type="button" className="ms-retry" onClick={() => setReloadKey((k) => k + 1)}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="ms-empty">
                    No memberships found.
                  </td>
                </tr>
              ) : (
                rows.map((m, i) => (
                  <tr key={m.id}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{m.name}</td>
                    <td>{dash(m.phone)}</td>
                    <td>{dash(m.cnic)}</td>
                    <td>{m.pkg}</td>
                    <td>{m.plan}</td>
                    <td>{m.trainer || "—"}</td>
                    <td className="center">
                      <span className={payClass(m.paymentStatus)}>{m.paymentStatus}</span>
                    </td>
                    <td>{fmtISO(m.feesPaidOn)}</td>
                    <td>{fmtISO(m.expiryDate)}</td>
                    <td className="center">
                      <span className={typeClass(m.membershipType)}>{m.membershipType}</span>
                    </td>
                    <td className="center">
                      <button
                        type="button"
                        className="ms-view-btn"
                        aria-label={`View ${m.name}`}
                        onClick={() => setActiveMember(m)}
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

      {/* Member Details modal */}
      {activeMember && (
        <div className="ms-overlay" onClick={() => setActiveMember(null)}>
          <div
            className="ms-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ms-modal-header">
              <h2>Member Details</h2>
              <button
                type="button"
                className="ms-modal-close"
                aria-label="Close"
                onClick={() => setActiveMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ms-modal-profile">
              <div>
                <h3>{activeMember.name}</h3>
                <p>{dash(activeMember.email)}</p>
              </div>
              <div className="ms-modal-badges">
                <span className={payClass(activeMember.paymentStatus)}>{activeMember.paymentStatus}</span>
              </div>
            </div>

            <div className="ms-modal-grid">
              <div className="ms-detail">
                <span className="ms-detail-label">Phone</span>
                <span className="ms-detail-value">{dash(activeMember.phone)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">CNIC</span>
                <span className="ms-detail-value">{dash(activeMember.cnic)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Package</span>
                <span className="ms-detail-value">{activeMember.pkg}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Member Type</span>
                <span className="ms-detail-value">{activeMember.membershipType}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Plan</span>
                <span className="ms-detail-value">{activeMember.plan}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Trainer</span>
                <span className="ms-detail-value">{activeMember.trainer || "No trainer assigned"}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Joined On</span>
                <span className="ms-detail-value">{fmtISO(activeMember.joinedOn)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Fees Paid On</span>
                <span className="ms-detail-value">{fmtISO(activeMember.feesPaidOn)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Fees Expiry On</span>
                <span className="ms-detail-value ms-detail-highlight">{fmtISO(activeMember.expiryDate)}</span>
              </div>
            </div>

            {/* Monthly Fee Breakdown */}
            {activeMember.monthlyFees && activeMember.monthlyFees.length > 0 && (
              <div className="ms-monthly-breakdown">
                <h4 className="ms-breakdown-title">
                  Monthly Fee Breakdown
                  <span className="ms-breakdown-sub">
                    {activeMember.monthlyFees.length} month
                    {activeMember.monthlyFees.length > 1 ? "s" : ""} ×{" "}
                    {formatPrice(activeMember.monthlyFees[0]?.fee_amount ?? 0)} each
                  </span>
                </h4>
                <div className="ms-breakdown-table-wrap">
                  <table className="ms-breakdown-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Month</th>
                        <th className="center">Fee</th>
                        <th className="center">Valid From</th>
                        <th className="center">Valid Till</th>
                        <th className="center">Status</th>
                        <th className="center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMember.monthlyFees.map((mf) => {
                        const isToggling = togglingFeeId === mf.id;
                        const isPaid = mf.status === "paid";

                        return (
                          <tr key={mf.id}>
                            <td className="muted">{mf.month_number}</td>
                            <td className="member-name">Month {mf.month_number}</td>
                            <td className="center salary-cell">{formatPrice(mf.fee_amount)}</td>
                            <td className="center">{fmtISO(mf.valid_from)}</td>
                            <td className="center">{fmtISO(mf.valid_till)}</td>
                            <td className="center">
                              <span className={`ms-pay ${isPaid ? "paid" : "unpaid"}`}>
                                {isPaid ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="center">
                              <button
                                type="button"
                                className={`ms-toggle-fee-btn ${isPaid ? "paid" : "pending"}`}
                                onClick={() => toggleMonthlyFee(mf.id)}
                                disabled={isToggling}
                                title={isPaid ? "Mark as Pending" : "Mark as Paid"}
                              >
                                {isToggling ? "..." : isPaid ? "Unmark" : "Mark Paid"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="ms-total-label">
                          Grand Total
                        </td>
                        <td className="center ms-total-value">
                          {formatPrice(
                            activeMember.monthlyFees.reduce((s, mf) => s + Number(mf.fee_amount), 0)
                          )}
                        </td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="ms-cnic-images">
              <div className="ms-cnic-block">
                <span className="ms-detail-label">CNIC Front</span>
                <CnicImage url={activeMember.cnicFrontUrl} label="CNIC Front" />
              </div>
              <div className="ms-cnic-block">
                <span className="ms-detail-label">CNIC Back</span>
                <CnicImage url={activeMember.cnicBackUrl} label="CNIC Back" />
              </div>
            </div>

            <div className="ms-modal-footer">
              <button type="button" className="ms-btn-secondary" onClick={() => setActiveMember(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Memberships;