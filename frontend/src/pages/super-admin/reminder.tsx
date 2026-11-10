import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuBell, LuSearch, LuClock, LuTriangleAlert, LuCircleCheck, LuMessageCircle } from "react-icons/lu";
import { API_URL } from "../../../config";
import Sidebar from "./sidebar";
import "./dashboard.css";
import "./reminder.css";

/* Same endpoint Payments.tsx uses */
const LIST_ENDPOINT = `${API_URL}/super-admin/payments`;

type Row = {
  id: number;
  client_name: string;
  phone: string;
  plan: string;
  total_amount: number;
  paid_amount: number;
  /** Start of the last fully paid cycle (YYYY-MM-DD) or "" if never paid */
  paid_from: string;
  /** Subscription valid until (YYYY-MM-DD) or "" if never paid */
  paid_until: string;
};

type RemState = "expired" | "today" | "d1" | "d2" | "d3" | "active" | "nopay";
type RemFilter = "all" | "due" | RemState;

// In-memory cache: coming back to this page shows the last data instantly
let reminderCache: Row[] | null = null;

const authHeaders = (token: string): HeadersInit => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

/* ---------------- date helpers ---------------- */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* "2026-12-07" -> local Date, "" -> null */
const parseISO = (s?: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const MS_DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_DAY);

const formatPKR = (n: number) => "Rs " + Math.round(n || 0).toLocaleString("en-PK");

/* 0332... -> 92332... for WhatsApp link */
const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  return digits;
};

/* ---------------- state logic ---------------- */
const getState = (daysLeft: number | null): RemState => {
  if (daysLeft === null) return "nopay";
  if (daysLeft < 0) return "expired"; // expired -> reminder every day
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "d1";
  if (daysLeft === 2) return "d2";
  if (daysLeft === 3) return "d3";
  return "active";
};

const STATE_LABEL: Record<RemState, string> = {
  expired: "Expired",
  today: "Expires Today",
  d1: "1 Day Left",
  d2: "2 Days Left",
  d3: "3 Days Left",
  active: "Active",
  nopay: "No Payment",
};

const STATE_CLASS: Record<RemState, string> = {
  expired: "rem-badge-red",
  today: "rem-badge-red",
  d1: "rem-badge-orange",
  d2: "rem-badge-amber",
  d3: "rem-badge-amber",
  active: "rem-badge-green",
  nopay: "rem-badge-gray",
};

const DUE_STATES: RemState[] = ["d3", "d2", "d1", "today", "expired"];

const normalize = (json: any): Row[] => {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: any) => ({
    id: Number(r.id),
    client_name: r.client_name ?? r.name ?? "-",
    phone: r.phone ?? "",
    plan: r.plan ?? "-",
    total_amount: Number(r.total_amount ?? 0),
    paid_amount: Number(r.paid_amount ?? 0),
    paid_from: r.paid_from ?? "",
    paid_until: r.paid_until ?? "",
  }));
};

export default function Reminder() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");

  const [rows, setRows] = useState<Row[]>(() => reminderCache ?? []);
  const [loading, setLoading] = useState(() => !reminderCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RemFilter>("due");

  // Used to cancel an older request when a newer one starts
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) navigate("/super-admin/login", { replace: true });
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/super-admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
    } catch {
      /* ignore */
    }
    reminderCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  /**
   * If cached data exists it is shown right away and refreshed silently,
   * so the "Loading..." state only appears on the very first visit.
   */
  const load = useCallback(async () => {
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (reminderCache !== null) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch(LIST_ENDPOINT, {
        headers: authHeaders(token),
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        reminderCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const list = normalize(await res.json());
      reminderCache = list;
      setRows(list);
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
  }, [token, navigate]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort(); // cancel the request when leaving the page
    };
  }, [load]);

  /* Attach paid date, expiry date, days left and state to each row */
  const items = useMemo(() => {
    const today = new Date();
    return rows.map((r) => {
      const paidDate = parseISO(r.paid_from);
      const expires = parseISO(r.paid_until);
      const daysLeft = expires ? daysBetween(today, expires) : null;
      const state = getState(daysLeft);
      return { ...r, paidDate, expires, daysLeft, state };
    });
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<RemState, number> = { expired: 0, today: 0, d1: 0, d2: 0, d3: 0, active: 0, nopay: 0 };
    items.forEach((i) => (c[i.state] += 1));
    return c;
  }, [items]);

  const dueCount = DUE_STATES.reduce((a, s) => a + counts[s], 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => {
        const matchSearch =
          !q ||
          i.client_name.toLowerCase().includes(q) ||
          i.phone.toLowerCase().includes(q) ||
          i.plan.toLowerCase().includes(q);
        const matchFilter =
          filter === "all" ? true : filter === "due" ? DUE_STATES.includes(i.state) : i.state === filter;
        return matchSearch && matchFilter;
      })
      // most urgent first (expired -> today -> 1 day ...)
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  }, [items, search, filter]);

  const message = (i: (typeof items)[number]) => {
    switch (i.state) {
      case "d3":
      case "d2":
      case "d1":
        return `Your subscription expires in ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"}. Please pay your fee.`;
      case "today":
        return "Your subscription expires today. Please pay your fee.";
      case "expired":
        return `Your subscription expired ${Math.abs(i.daysLeft!)} day${Math.abs(i.daysLeft!) === 1 ? "" : "s"} ago. Please pay now.`;
      default:
        return "";
    }
  };

  const whatsappLink = (i: (typeof items)[number]) =>
    `https://wa.me/${waNumber(i.phone)}?text=${encodeURIComponent(
      `Assalam o Alaikum ${i.client_name}, ${message(i)}`
    )}`;

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="rem-page">
          <div className="rem-header">
            <h1 className="rem-title">Reminders</h1>
            <p className="rem-subtitle">
              Subscription runs 1 month from the payment date. Reminders at 3, 2, 1 day left, on the expiry day, and
              every day after it expires
            </p>
          </div>

          {error && (
            <div className="rem-alert">
              {error}. Could not load reminders.
              <button className="rem-alert-btn" onClick={load}>Retry</button>
            </div>
          )}

          <div className="rem-cards">
            <div className="rem-card">
              <div className="rem-icon rem-icon-amber"><LuBell size={22} /></div>
              <div>
                <span className="rem-card-label">Reminders Due</span>
                <span className="rem-card-value">{dueCount}</span>
              </div>
            </div>
            <div className="rem-card">
              <div className="rem-icon rem-icon-orange"><LuClock size={22} /></div>
              <div>
                <span className="rem-card-label">Expiring (1-3 days)</span>
                <span className="rem-card-value">{counts.d1 + counts.d2 + counts.d3}</span>
              </div>
            </div>
            <div className="rem-card">
              <div className="rem-icon rem-icon-red"><LuTriangleAlert size={22} /></div>
              <div>
                <span className="rem-card-label">Expired / Today</span>
                <span className="rem-card-value rem-red">{counts.expired + counts.today}</span>
              </div>
            </div>
            <div className="rem-card">
              <div className="rem-icon rem-icon-green"><LuCircleCheck size={22} /></div>
              <div>
                <span className="rem-card-label">Active</span>
                <span className="rem-card-value rem-green">{counts.active}</span>
              </div>
            </div>
          </div>

          <div className="rem-panel">
            <div className="rem-panel-head">
              <div>
                <h2 className="rem-panel-title">Companies ({filtered.length})</h2>
                <p className="rem-panel-sub">
                  {refreshing ? "Refreshing..." : "Filter by how many days are left"}
                </p>
              </div>
              <div className="rem-search-wrap">
                <LuSearch size={16} />
                <input
                  className="rem-search"
                  type="text"
                  placeholder="Search company, phone, plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="rem-filters">
              {(
                [
                  ["due", `Reminders Due (${dueCount})`],
                  ["all", `All (${items.length})`],
                  ["d3", `3 Days (${counts.d3})`],
                  ["d2", `2 Days (${counts.d2})`],
                  ["d1", `1 Day (${counts.d1})`],
                  ["today", `Expires Today (${counts.today})`],
                  ["expired", `Expired (${counts.expired})`],
                  ["active", `Active (${counts.active})`],
                  ["nopay", `No Payment (${counts.nopay})`],
                ] as [RemFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`rem-chip ${filter === key ? "rem-chip-active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rem-table-wrap">
              <table className="rem-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Billing Period (Paid On)</th>
                    <th>Expires</th>
                    <th>Days Left</th>
                    <th>Status</th>
                    <th>Remind</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 ? (
                    <tr><td colSpan={9} className="rem-empty">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="rem-empty">No records found</td></tr>
                  ) : (
                    filtered.map((i, idx) => (
                      <tr key={i.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className="rem-name">{i.client_name}</div>
                          <div className="rem-phone">{i.phone}</div>
                        </td>
                        <td>{i.plan}</td>
                        <td>{formatPKR(i.total_amount)}</td>
                        <td>{i.paidDate ? fmtDate(i.paidDate) : "-"}</td>
                        <td>{i.expires ? fmtDate(i.expires) : "-"}</td>
                        <td
                          className={
                            i.daysLeft === null ? "" : i.daysLeft <= 0 ? "rem-red rem-bold" : i.daysLeft <= 3 ? "rem-amber rem-bold" : ""
                          }
                        >
                          {i.daysLeft === null
                            ? "-"
                            : i.daysLeft < 0
                            ? `${Math.abs(i.daysLeft)} overdue`
                            : i.daysLeft === 0
                            ? "Today"
                            : i.daysLeft}
                        </td>
                        <td>
                          <span className={`rem-badge ${STATE_CLASS[i.state]}`}>{STATE_LABEL[i.state]}</span>
                        </td>
                        <td>
                          {DUE_STATES.includes(i.state) && i.phone ? (
                            <a className="rem-wa-btn" href={whatsappLink(i)} target="_blank" rel="noreferrer">
                              <LuMessageCircle size={14} />
                              WhatsApp
                            </a>
                          ) : (
                            <span className="rem-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}