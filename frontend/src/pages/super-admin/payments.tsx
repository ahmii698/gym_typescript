import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuUsers,
  LuWallet,
  LuDownload,
  LuHourglass,
  LuSearch,
  LuCircleCheck,
  LuEye,
  LuX,
  LuHistory,
  LuPencil,
} from "react-icons/lu";
import { API_URL } from "../../../config";
import Sidebar from "./sidebar";
import "./dashboard.css"; // styling for sas-layout / sas-content lives here
import "./payments.css";

/* ------------------------------------------------------------------ */
/*  BACKEND SETTINGS                                                    */
/* ------------------------------------------------------------------ */
const LIST_ENDPOINT = `${API_URL}/super-admin/payments`; // GET  -> list of companies + latest proof
const APPROVE_ENDPOINT = (proofId: number) =>
  `${API_URL}/super-admin/payments/proofs/${proofId}/approve`; // POST
const REJECT_ENDPOINT = (proofId: number) =>
  `${API_URL}/super-admin/payments/proofs/${proofId}/reject`; // POST
const MEMBERS_ENDPOINT = (companyId: number) =>
  `${API_URL}/super-admin/payments/companies/${companyId}/members`; // GET
const HISTORY_ENDPOINT = (companyId: number) =>
  `${API_URL}/super-admin/payments/companies/${companyId}/history`; // GET
const FEE_ENDPOINT = (companyId: number) =>
  `${API_URL}/super-admin/payments/companies/${companyId}/fee`; // PUT { monthly_fee }
const BLOCK_ENDPOINT = (companyId: number) =>
  `${API_URL}/super-admin/payments/companies/${companyId}/block`; // PUT { blocked: true | false }

type ProofStatus = "pending" | "approved" | "rejected";

type Proof = {
  id: number;
  amount: number;
  status: ProofStatus;
  url: string;
  created_at: string;
};

type Sub = {
  id: number; // company id
  client_name: string; // company name
  phone: string;
  plan: string;
  total_amount: number; // this company's monthly fee
  paid_amount: number;
  billing_period: string; // start date of the current cycle
  expires_at: string; // how long the subscription is valid ("" = not paid yet)
  is_blocked: boolean; // whether the super admin has blocked this company
  proof: Proof | null;
};

type PayState = "paid" | "pending" | "rejected" | "unpaid";
type PayFilter = "all" | PayState;

type Member = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

type HistoryProof = Proof & { uploaded_by: string };

type HistoryRow = {
  billing_period: string;
  total_amount: number;
  paid_amount: number;
  status: PayState;
  proofs: HistoryProof[];
};

// In-memory cache: coming back to this page shows the last data instantly
let paymentsCache: Sub[] | null = null;

const authHeaders = (token: string): HeadersInit => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

const formatPKR = (n: number) => "Rs " + Math.round(n || 0).toLocaleString("en-PK");

const formatDateTime = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d || "-";
  return dt.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getPayState = (s: Sub): PayState => {
  if (s.paid_amount >= s.total_amount) return "paid";
  if (s.proof?.status === "pending") return "pending";
  if (s.proof?.status === "rejected") return "rejected";
  return "unpaid";
};

const STATE_LABEL: Record<PayState, string> = {
  paid: "Paid",
  pending: "Pending Review",
  rejected: "Rejected",
  unpaid: "Unpaid",
};

// Reuses the existing badge colors: paid = green, partial = amber, unpaid = red
const STATE_BADGE_CLASS: Record<PayState, string> = {
  paid: "pay-badge-paid",
  pending: "pay-badge-partial",
  rejected: "pay-badge-unpaid",
  unpaid: "pay-badge-unpaid",
};

const ROLE_ORDER = ["admin", "frontdesk", "trainer", "staff"];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admins",
  frontdesk: "Front Desk",
  trainer: "Trainers",
  staff: "Staff",
};

// Block / Unblock button (inline styles so payments.css doesn't need any changes)
const blockBtnStyle = (blocked: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${blocked ? "#16a34a" : "#dc2626"}`,
  background: blocked ? "#dcfce7" : "#fee2e2",
  color: blocked ? "#15803d" : "#b91c1c",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const mapProof = (p: any): Proof => ({
  id: Number(p.id),
  amount: Number(p.amount ?? 0),
  status: p.status as ProofStatus,
  url: p.url ?? "",
  created_at: p.created_at ?? "",
});

/* Turns the API response (array or {data: []}) into Sub[] */
const normalize = (json: any): Sub[] => {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: any) => ({
    id: Number(r.id),
    client_name: r.client_name ?? r.name ?? "-",
    phone: r.phone ?? "",
    plan: r.plan ?? "-",
    total_amount: Number(r.total_amount ?? 0),
    paid_amount: Number(r.paid_amount ?? 0),
    billing_period: r.billing_period ?? "",
    expires_at: r.expires_at ?? "",
    is_blocked: Boolean(r.is_blocked),
    proof: r.proof ? mapProof(r.proof) : null,
  }));
};

const normalizeMembers = (json: any): Member[] => {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name ?? "-",
    phone: r.phone ?? "",
    email: r.email ?? "",
    role: String(r.role ?? "staff").toLowerCase(),
  }));
};

const normalizeHistory = (json: any): HistoryRow[] => {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: any) => ({
    billing_period: r.billing_period ?? "-",
    total_amount: Number(r.total_amount ?? 0),
    paid_amount: Number(r.paid_amount ?? 0),
    status: (r.status ?? "unpaid") as PayState,
    proofs: Array.isArray(r.proofs)
      ? r.proofs.map((p: any) => ({ ...mapProof(p), uploaded_by: p.uploaded_by ?? "" }))
      : [],
  }));
};

/* Small reusable modal shell */
function Modal({
  title,
  subtitle,
  wide,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pay-overlay" onClick={onClose}>
      <div
        className={`pay-modal ${wide ? "pay-modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="pay-close" onClick={onClose} title="Close">
          <LuX size={16} />
        </button>
        <h2 className="pay-modal-title">{title}</h2>
        {subtitle && <p className="pay-modal-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export default function Payments() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");

  const [subs, setSubs] = useState<Sub[]>(() => paymentsCache ?? []);
  const [loading, setLoading] = useState(() => !paymentsCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");

  // Used to cancel an older request when a newer one starts
  const abortRef = useRef<AbortController | null>(null);

  // Proof review modal
  const [selected, setSelected] = useState<Sub | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  // Members modal
  const [membersFor, setMembersFor] = useState<Sub | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  // History modal
  const [historyFor, setHistoryFor] = useState<Sub | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Monthly fee modal (each company has its own fee)
  const [feeFor, setFeeFor] = useState<Sub | null>(null);
  const [feeValue, setFeeValue] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeError, setFeeError] = useState("");

  // Block / Unblock confirm modal
  const [blockFor, setBlockFor] = useState<Sub | null>(null);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState("");

  // No token: send the user to the login page
  useEffect(() => {
    if (!token) navigate("/super-admin/login", { replace: true });
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/super-admin/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
    } catch {
      /* log out locally even if the server is unreachable */
    }
    paymentsCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  /**
   * Loads the company list.
   * silent = true -> refresh in the background without the "Loading..." state.
   * If we already have cached data, it is shown right away and refreshed silently.
   */
  const load = useCallback(
    async (silent = false) => {
      if (!token) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const hasData = silent || paymentsCache !== null;
      if (hasData) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const res = await fetch(LIST_ENDPOINT, {
          headers: authHeaders(token),
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          paymentsCache = null;
          localStorage.removeItem("sa_token");
          navigate("/super-admin/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const list = normalize(await res.json());
        paymentsCache = list;
        setSubs(list);
      } catch (e: any) {
        if (e?.name === "AbortError") return; // a newer load took over
        setError(e?.message || "Could not load data");
        // keep showing the data we already have
      } finally {
        if (abortRef.current === ctrl) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, navigate]
  );

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort(); // cancel the request when leaving the page
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = subs.reduce((a, s) => a + s.total_amount, 0);
    const received = subs.reduce((a, s) => a + s.paid_amount, 0);
    const remaining = Math.max(total - received, 0);
    const percent = total > 0 ? Math.round((received / total) * 100) : 0;
    const cleared = subs.filter((s) => s.paid_amount >= s.total_amount).length;
    const awaitingReview = subs.filter((s) => s.proof?.status === "pending").length;
    const unpaid = subs.length - cleared;
    const blocked = subs.filter((s) => s.is_blocked).length;
    return {
      count: subs.length,
      total,
      received,
      remaining,
      percent,
      cleared,
      awaitingReview,
      unpaid,
      blocked,
    };
  }, [subs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      const matchSearch =
        !q ||
        s.client_name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.plan.toLowerCase().includes(q);
      const matchPay = payFilter === "all" || getPayState(s) === payFilter;
      return matchSearch && matchPay;
    });
  }, [subs, search, payFilter]);

  /* ---------- Proof review ---------- */
  const openProof = (s: Sub) => {
    setActionError("");
    setSelected(s);
  };

  const closeProof = () => {
    if (acting) return;
    setSelected(null);
    setActionError("");
  };

  const reviewProof = async (action: "approve" | "reject") => {
    if (!selected?.proof || !token) return;

    setActing(true);
    setActionError("");

    try {
      const url =
        action === "approve"
          ? APPROVE_ENDPOINT(selected.proof.id)
          : REJECT_ENDPOINT(selected.proof.id);

      const res = await fetch(url, { method: "POST", headers: authHeaders(token) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      setSelected(null);
      await load(true); // refresh in the background, no "Loading..." flash
    } catch (e: any) {
      setActionError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setActing(false);
    }
  };

  /* ---------- Monthly fee (edit) ---------- */
  const openFee = (s: Sub) => {
    setFeeError("");
    setFeeValue(String(Math.round(s.total_amount)));
    setFeeFor(s);
  };

  const closeFee = () => {
    if (feeSaving) return;
    setFeeFor(null);
    setFeeError("");
  };

  const saveFee = async () => {
    if (!feeFor || !token) return;

    const amount = Number(feeValue);
    if (!feeValue.trim() || isNaN(amount) || amount < 1) {
      setFeeError("Please enter a valid amount");
      return;
    }

    setFeeSaving(true);
    setFeeError("");

    try {
      const res = await fetch(FEE_ENDPOINT(feeFor.id), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ monthly_fee: amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const firstError = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
        throw new Error(firstError || data?.message || `Server error ${res.status}`);
      }

      setFeeFor(null);
      await load(true);
    } catch (e: any) {
      setFeeError(e?.message || "Could not save. Please try again.");
    } finally {
      setFeeSaving(false);
    }
  };

  /* ---------- Block / Unblock ---------- */
  const openBlock = (s: Sub) => {
    setBlockError("");
    setBlockFor(s);
  };

  const closeBlock = () => {
    if (blockSaving) return;
    setBlockFor(null);
    setBlockError("");
  };

  const confirmBlock = async () => {
    if (!blockFor || !token) return;

    const willBlock = !blockFor.is_blocked;
    const companyId = blockFor.id;

    setBlockSaving(true);
    setBlockError("");

    try {
      const res = await fetch(BLOCK_ENDPOINT(companyId), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ blocked: willBlock }),
      });

      if (res.status === 401) {
        paymentsCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      // Update the row right away so the badge/button change instantly
      setSubs((prev) => {
        const next = prev.map((s) => (s.id === companyId ? { ...s, is_blocked: willBlock } : s));
        paymentsCache = next;
        return next;
      });
      setBlockFor(null);
      load(true); // confirm with the server in the background
    } catch (e: any) {
      setBlockError(e?.message || "Could not update. Please try again.");
    } finally {
      setBlockSaving(false);
    }
  };

  /* ---------- Members (eye 1) ---------- */
  const openMembers = async (s: Sub) => {
    if (!token) return;
    setMembersFor(s);
    setMembers([]);
    setMembersError("");
    setMembersLoading(true);
    try {
      const res = await fetch(MEMBERS_ENDPOINT(s.id), { headers: authHeaders(token) });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setMembers(normalizeMembers(await res.json()));
    } catch (e: any) {
      setMembersError(e?.message || "Could not load members");
    } finally {
      setMembersLoading(false);
    }
  };

  /* ---------- Payment history (eye 2) ---------- */
  const openHistory = async (s: Sub) => {
    if (!token) return;
    setHistoryFor(s);
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const res = await fetch(HISTORY_ENDPOINT(s.id), { headers: authHeaders(token) });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setHistory(normalizeHistory(await res.json()));
    } catch (e: any) {
      setHistoryError(e?.message || "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Members grouped by role (known roles first, then any other role)
  const groupedMembers = useMemo(() => {
    const roles = Array.from(new Set([...ROLE_ORDER, ...members.map((m) => m.role)]));
    return roles
      .map((role) => ({ role, list: members.filter((m) => m.role === role) }))
      .filter((g) => g.list.length > 0);
  }, [members]);

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="pay-page">
          <div className="pay-header">
            <h1 className="pay-title">Payments</h1>
            <p className="pay-subtitle">
              See which companies have paid their subscription and review their payment proofs
            </p>
          </div>

          {error && (
            <div className="pay-alert">
              {error}. Could not load payments.
              <button className="pay-alert-btn" onClick={() => load()}>Retry</button>
            </div>
          )}

          <div className="pay-cards">
            <div className="pay-card">
              <div className="pay-icon pay-icon-amber"><LuUsers size={24} /></div>
              <div className="pay-card-body">
                <span className="pay-card-label">Subscribed Companies</span>
                <span className="pay-card-value">{stats.count}</span>
                <span className="pay-card-note">
                  {stats.cleared} fully paid · {stats.blocked} blocked
                </span>
              </div>
            </div>

            <div className="pay-card">
              <div className="pay-icon pay-icon-purple"><LuWallet size={24} /></div>
              <div className="pay-card-body">
                <span className="pay-card-label">Total Amount</span>
                <span className="pay-card-value">{formatPKR(stats.total)}</span>
                <span className="pay-card-note">Total billed</span>
              </div>
            </div>

            <div className="pay-card">
              <div className="pay-icon pay-icon-green"><LuDownload size={24} /></div>
              <div className="pay-card-body">
                <span className="pay-card-label">Received</span>
                <span className="pay-card-value pay-green">{formatPKR(stats.received)}</span>
                <div className="pay-mini-bar">
                  <div className="pay-mini-fill" style={{ width: `${stats.percent}%` }} />
                </div>
              </div>
            </div>

            <div className="pay-card">
              <div className="pay-icon pay-icon-red"><LuHourglass size={24} /></div>
              <div className="pay-card-body">
                <span className="pay-card-label">Remaining</span>
                <span className="pay-card-value pay-red">{formatPKR(stats.remaining)}</span>
                <span className="pay-card-note">
                  {stats.unpaid} unpaid · {stats.awaitingReview} awaiting review
                </span>
              </div>
            </div>
          </div>

          <div className="pay-panel">
            <div className="pay-panel-head">
              <div>
                <h2 className="pay-panel-title">Companies ({filtered.length})</h2>
                <p className="pay-panel-sub">
                  {refreshing ? "Refreshing..." : "Search or filter by payment status"}
                </p>
              </div>
              <div className="pay-tools">
                <div className="pay-search-wrap">
                  <LuSearch size={16} />
                  <input
                    className="pay-search"
                    type="text"
                    placeholder="Search company, phone, plan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="pay-select"
                  value={payFilter}
                  onChange={(e) => setPayFilter(e.target.value as PayFilter)}
                >
                  <option value="all">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending review</option>
                  <option value="rejected">Rejected</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <div className="pay-table-wrap">
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Plan</th>
                    <th>Monthly Fee</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Billing Period</th>
                    <th>Expires</th>
                    <th>Proof</th>
                    <th>Details</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && subs.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="pay-empty">Loading...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="pay-empty">No records found</td>
                    </tr>
                  ) : (
                    filtered.map((s, i) => {
                      const remaining = Math.max(s.total_amount - s.paid_amount, 0);
                      const state = getPayState(s);
                      return (
                        <tr key={s.id}>
                          <td>{i + 1}</td>
                          <td>
                            <div
                              className="pay-user"
                              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                            >
                              <span>{s.client_name}</span>
                              {s.is_blocked && (
                                <span className="pay-badge pay-badge-unpaid">Blocked</span>
                              )}
                            </div>
                            <div className="pay-phone">{s.phone}</div>
                          </td>
                          <td>{s.plan}</td>
                          <td>
                            <div className="pay-actions">
                              <span>{formatPKR(s.total_amount)}</span>
                              <button
                                className="pay-icon-btn"
                                title="Change monthly fee"
                                onClick={() => openFee(s)}
                              >
                                <LuPencil size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="pay-green pay-bold">{formatPKR(s.paid_amount)}</td>
                          <td className={remaining > 0 ? "pay-red pay-bold" : ""}>{formatPKR(remaining)}</td>
                          <td>
                            <span className={`pay-badge ${STATE_BADGE_CLASS[state]}`}>
                              {STATE_LABEL[state]}
                            </span>
                          </td>
                          <td>{s.billing_period || "-"}</td>
                          <td>{s.expires_at || "-"}</td>
                          <td>
                            {s.proof ? (
                              <button className="pay-view-btn" onClick={() => openProof(s)}>
                                <LuEye size={14} />
                                View Proof
                              </button>
                            ) : (
                              <span className="pay-noproof">No proof yet</span>
                            )}
                          </td>
                          <td>
                            <div className="pay-actions">
                              <button
                                className="pay-icon-btn"
                                title="View members"
                                onClick={() => openMembers(s)}
                              >
                                <LuUsers size={16} />
                              </button>
                              <button
                                className="pay-icon-btn"
                                title="Payment history"
                                onClick={() => openHistory(s)}
                              >
                                <LuHistory size={16} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <button
                              style={blockBtnStyle(s.is_blocked)}
                              title={s.is_blocked ? "Unblock this company" : "Block this company"}
                              onClick={() => openBlock(s)}
                            >
                              {s.is_blocked ? "Unblock" : "Block"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ---------- Block / Unblock confirm modal ---------- */}
      {blockFor && (
        <Modal
          title={blockFor.is_blocked ? "Unblock Company" : "Block Company"}
          subtitle={blockFor.client_name}
          onClose={closeBlock}
        >
          {blockFor.is_blocked ? (
            <p className="pay-img-hint" style={{ textAlign: "left", marginBottom: 12 }}>
              Unblocking this company will let all of its users (admin, front desk, trainer) log in again.
              Do you want to unblock it?
            </p>
          ) : (
            <p className="pay-img-hint" style={{ textAlign: "left", marginBottom: 12 }}>
              Blocking this company will <strong>immediately log out all of its users (admin, front desk, trainer)</strong>{" "}
              and they won't be able to log in, even with the correct email and password, until you unblock it.
              Do you want to block it?
            </p>
          )}

          {blockError && <p className="pay-action-error">{blockError}</p>}

          <div className="pay-review-row">
            <button className="pay-reject-btn" disabled={blockSaving} onClick={closeBlock}>
              Cancel
            </button>
            <button
              className="pay-approve-btn"
              disabled={blockSaving}
              onClick={confirmBlock}
              style={blockFor.is_blocked ? undefined : { background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
            >
              {blockSaving
                ? "Please wait..."
                : blockFor.is_blocked
                ? "Yes, Unblock"
                : "Yes, Block Company"}
            </button>
          </div>
        </Modal>
      )}

      {/* ---------- Monthly fee modal ---------- */}
      {feeFor && (
        <Modal
          title="Monthly Fee"
          subtitle={`${feeFor.client_name} · this company's monthly fee`}
          onClose={closeFee}
        >
          <div className="pay-search-wrap" style={{ marginBottom: 12 }}>
            <input
              className="pay-search"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="e.g. 10000"
              value={feeValue}
              onChange={(e) => setFeeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFee();
              }}
              autoFocus
            />
          </div>

          <p className="pay-img-hint" style={{ textAlign: "left", marginBottom: 12 }}>
            It's best to change this before a new cycle starts, because the paid/unpaid status of the current
            cycle is based on this fee.
          </p>

          {feeError && <p className="pay-action-error">{feeError}</p>}

          <div className="pay-review-row">
            <button className="pay-reject-btn" disabled={feeSaving} onClick={closeFee}>
              Cancel
            </button>
            <button className="pay-approve-btn" disabled={feeSaving} onClick={saveFee}>
              {feeSaving ? "Saving..." : "Save Fee"}
            </button>
          </div>
        </Modal>
      )}

      {/* ---------- Proof review modal ---------- */}
      {selected && selected.proof && (
        <Modal
          title="Payment Proof"
          subtitle={`${selected.client_name}${selected.phone ? ` · ${selected.phone}` : ""}`}
          onClose={closeProof}
        >
          <div className="pay-info-box">
            <div>
              <div className="pay-info-label">Amount</div>
              <strong className="pay-info-big">{formatPKR(selected.proof.amount)}</strong>
            </div>
            <div>
              <div className="pay-info-label">Billing Period</div>
              <strong>{selected.billing_period}</strong>
            </div>
            <div>
              <div className="pay-info-label">Submitted</div>
              <strong>{formatDateTime(selected.proof.created_at)}</strong>
            </div>
          </div>

          <div className="pay-img-box">
            <a href={selected.proof.url} target="_blank" rel="noreferrer">
              <img
                src={selected.proof.url}
                alt="Payment screenshot"
                className="pay-proof-img"
                decoding="async"
              />
            </a>
            <div className="pay-img-hint">Click the image to open it in a new tab</div>
          </div>

          {actionError && <p className="pay-action-error">{actionError}</p>}

          {selected.proof.status === "pending" ? (
            <div className="pay-review-row">
              <button
                className="pay-reject-btn"
                disabled={acting}
                onClick={() => reviewProof("reject")}
              >
                {acting ? "Please wait..." : "Reject"}
              </button>
              <button
                className="pay-approve-btn"
                disabled={acting}
                onClick={() => reviewProof("approve")}
              >
                {acting ? "Please wait..." : "Approve Payment"}
              </button>
            </div>
          ) : (
            <div
              className={`pay-review-result ${
                selected.proof.status === "approved" ? "pay-green" : "pay-red"
              }`}
            >
              <LuCircleCheck size={16} />
              This proof was {selected.proof.status}
            </div>
          )}
        </Modal>
      )}

      {/* ---------- Members modal ---------- */}
      {membersFor && (
        <Modal
          title={membersFor.client_name}
          subtitle="Admins, front desk, trainers and staff of this company"
          onClose={() => setMembersFor(null)}
        >
          {membersLoading ? (
            <p className="pay-modal-empty">Loading...</p>
          ) : membersError ? (
            <p className="pay-action-error">{membersError}</p>
          ) : groupedMembers.length === 0 ? (
            <p className="pay-modal-empty">No members found</p>
          ) : (
            groupedMembers.map((g) => (
              <div key={g.role} className="pay-group">
                <div className="pay-group-title">
                  {ROLE_LABEL[g.role] ?? g.role} ({g.list.length})
                </div>
                {g.list.map((m) => (
                  <div key={`${g.role}-${m.id}`} className="pay-member">
                    <div>
                      <div className="pay-user">{m.name}</div>
                      {m.email && <div className="pay-phone">{m.email}</div>}
                    </div>
                    <div className="pay-phone">{m.phone || "-"}</div>
                  </div>
                ))}
              </div>
            ))
          )}
        </Modal>
      )}

      {/* ---------- Payment history modal ---------- */}
      {historyFor && (
        <Modal
          title={`${historyFor.client_name} · Payment History`}
          subtitle="Month-by-month payments with their screenshots"
          wide
          onClose={() => setHistoryFor(null)}
        >
          {historyLoading ? (
            <p className="pay-modal-empty">Loading...</p>
          ) : historyError ? (
            <p className="pay-action-error">{historyError}</p>
          ) : history.length === 0 ? (
            <p className="pay-modal-empty">No history found</p>
          ) : (
            history.map((h) => (
              <div key={h.billing_period} className="pay-month">
                <div className="pay-month-head">
                  <div>
                    <div className="pay-month-title">{h.billing_period}</div>
                    <div className="pay-phone">
                      Paid {formatPKR(h.paid_amount)} of {formatPKR(h.total_amount)}
                    </div>
                  </div>
                  <span className={`pay-badge ${STATE_BADGE_CLASS[h.status]}`}>
                    {STATE_LABEL[h.status]}
                  </span>
                </div>

                {h.proofs.length === 0 ? (
                  <div className="pay-noproof">No payment proof uploaded for this month</div>
                ) : (
                  <div className="pay-proof-grid">
                    {h.proofs.map((p) => (
                      <div key={p.id} className="pay-proof-item">
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <img
                            src={p.url}
                            alt="Payment screenshot"
                            className="pay-thumb"
                            loading="lazy"
                            decoding="async"
                          />
                        </a>
                        <div className="pay-proof-meta">
                          <strong>{formatPKR(p.amount)}</strong>
                          <span className={`pay-badge ${STATE_BADGE_CLASS[p.status as PayState] ?? "pay-badge-partial"}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="pay-phone">{formatDateTime(p.created_at)}</div>
                        {p.uploaded_by && <div className="pay-phone">by {p.uploaded_by}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}