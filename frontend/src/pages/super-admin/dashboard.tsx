import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuDumbbell,
  LuBadgeCheck,
  LuWallet,
  LuDownload,
  LuHourglass,
  LuTrendingUp,
  LuCalendar,
} from "react-icons/lu";
import { API_URL } from "../../../config";
import Sidebar from "./sidebar";
import "./dashboard.css";

/* ------------------------------------------------------------------ */
/*  BACKEND (same endpoints the Payments page uses)                     */
/* ------------------------------------------------------------------ */
const LIST_ENDPOINT = `${API_URL}/super-admin/payments`; // subscribed companies (excludes trial users)
const HISTORY_ENDPOINT = (companyId: number) =>
  `${API_URL}/super-admin/payments/companies/${companyId}/history`;

// How many records each list shows
const TOP_DUES_LIMIT = 3;
const EXPIRING_LIMIT = 3;
const RECENT_LIMIT = 5;

// How many history requests run at the same time
const HISTORY_CONCURRENCY = 6;

// <-- CHANGED (1): sirf paid aur unpaid
type PayState = "paid" | "unpaid";

type Sub = {
  id: number;
  client_name: string;
  phone: string;
  plan: string;
  total_amount: number;
  paid_amount: number;
  billing_period: string;
  expires_at: string;
  is_blocked: boolean;
  proofStatus: string | null;
};

// One row per company per billing period
type Row = {
  key: string;
  company_id: number;
  company: string;
  date: Date;
  period: string;
  total: number;
  paid: number;
  status: PayState;
};

type Preset = "all" | "today" | "week" | "month" | "year" | "custom";
type ChartType = "line" | "area" | "bar" | "stacked" | "pie" | "donut";

// In-memory cache: coming back to the dashboard shows data instantly
let dashCache: { subs: Sub[]; rows: Row[] } | null = null;

const authHeaders = (token: string): HeadersInit => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PALETTE = [
  "#fbbf24", "#22c55e", "#a78bfa", "#2dd4bf", "#fb923c", "#f87171",
  "#60a5fa", "#f472b6", "#84cc16", "#e879f9", "#38bdf8", "#facc15",
];

const formatPKR = (n: number) => "Rs " + Math.round(n || 0).toLocaleString("en-PK");

const formatShort = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(Math.round(n));
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Turns both "07 Nov 2026" and "2026-11-07" into a Date
const parseDate = (s: string): Date | null => {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
    if (mi >= 0) return new Date(Number(m[3]), mi, Number(m[1]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const fromInput = (v: string) => {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const getRange = (preset: Preset, cFrom: string, cTo: string) => {
  const today = startOfDay(new Date());
  switch (preset) {
    case "today":
      return { start: today.getTime(), end: addDays(today, 1).getTime() };
    case "week": {
      const dow = (today.getDay() + 6) % 7; // week starts on Monday
      const s = addDays(today, -dow);
      return { start: s.getTime(), end: addDays(s, 7).getTime() };
    }
    case "month":
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1).getTime(),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime(),
      };
    case "year":
      return {
        start: new Date(today.getFullYear(), 0, 1).getTime(),
        end: new Date(today.getFullYear() + 1, 0, 1).getTime(),
      };
    case "custom": {
      const f = fromInput(cFrom);
      const t = fromInput(cTo);
      return { start: f ? f.getTime() : null, end: t ? addDays(t, 1).getTime() : null };
    }
    default:
      return { start: null, end: null };
  }
};

const PRESET_LABEL: Record<Preset, string> = {
  all: "All Time",
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom",
};

// <-- CHANGED (2): teeno maps mein sirf paid aur unpaid
const STATE_LABEL: Record<PayState, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
};

const STATE_BADGE: Record<PayState, string> = {
  paid: "dash-badge-paid",
  unpaid: "dash-badge-unpaid",
};

const STATE_COLOR: Record<PayState, string> = {
  paid: "#22c55e",
  unpaid: "#ef4444",
};

// <-- CHANGED (3): pending / rejected ab unpaid mein ginay jayenge
const getPayState = (s: Sub): PayState =>
  s.paid_amount >= s.total_amount ? "paid" : "unpaid";

const niceMax = (max: number) => {
  if (max <= 0) return 1000;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
};

/* API response -> Sub[] */
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
    proofStatus: r.proof?.status ?? null,
  }));
};

// <-- CHANGED (4): history se pending / rejected aaye to bhi unpaid ban jaye
const normalizeHistory = (json: any) => {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: any) => ({
    billing_period: r.billing_period ?? "",
    total_amount: Number(r.total_amount ?? 0),
    paid_amount: Number(r.paid_amount ?? 0),
    status: (r.status === "paid" ? "paid" : "unpaid") as PayState,
  }));
};

// The current-cycle row (available right away from the list response)
const currentRow = (s: Sub): Row => ({
  key: `${s.id}-current`,
  company_id: s.id,
  company: s.client_name,
  date: parseDate(s.billing_period) ?? new Date(),
  period: s.billing_period || "-",
  total: s.total_amount,
  paid: s.paid_amount,
  status: getPayState(s),
});

// Chart geometry
const CW = 640;
const CH = 270;
const PAD_L = 52;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 34;

const CHART_TABS: { key: ChartType; label: string }[] = [
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
  { key: "bar", label: "Bar" },
  { key: "stacked", label: "Stacked Bar" },
  { key: "pie", label: "Pie" },
  { key: "donut", label: "Donut" },
];

const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy + r * Math.sin(a),
});

const pieSlice = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const end = Math.min(a1, a0 + Math.PI * 2 - 0.0001);
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, end);
  const large = end - a0 > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Z`;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const token = localStorage.getItem("sa_token");
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("sa_user") ?? "null");
    } catch {
      return null;
    }
  })();

  const [subs, setSubs] = useState<Sub[]>(() => dashCache?.subs ?? []);
  const [rows, setRows] = useState<Row[]>(() => dashCache?.rows ?? []);
  const [loading, setLoading] = useState(() => !dashCache);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  // Used to ignore results of an older, outdated load
  const runRef = useRef(0);

  // Top date filter (cards, status, lists, table)
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Chart's own controls
  const [chartType, setChartType] = useState<ChartType>("line");
  const [chFrom, setChFrom] = useState(() => {
    const n = new Date();
    return monthKey(new Date(n.getFullYear(), n.getMonth() - 5, 1));
  });
  const [chTo, setChTo] = useState(() => monthKey(new Date()));
  const [hover, setHover] = useState<number | null>(null);

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
    dashCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  const load = useCallback(async () => {
    if (!token) return;
    const run = ++runRef.current;
    const isStale = () => run !== runRef.current;

    if (!dashCache) setLoading(true);
    setError("");

    try {
      /* Step 1: the company list. Show the dashboard as soon as it arrives. */
      const res = await fetch(LIST_ENDPOINT, { headers: authHeaders(token) });
      if (isStale()) return;
      if (res.status === 401) {
        dashCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const list = normalize(await res.json());
      if (isStale()) return;

      setSubs(list);
      setRows((prev) => {
        // Keep history we already have (cache); add current-cycle rows for the rest
        const ids = new Set(list.map((s) => s.id));
        const kept = prev.filter((r) => ids.has(r.company_id));
        const have = new Set(kept.map((r) => r.company_id));
        return [...kept, ...list.filter((s) => !have.has(s.id)).map(currentRow)];
      });
      setLoading(false);

      /* Step 2: month-by-month history, loaded in the background. */
      setHistoryLoading(true);
      const acc = new Map<number, Row[]>();
      const queue = [...list];

      const worker = async () => {
        while (queue.length > 0) {
          if (isStale()) return;
          const s = queue.shift()!;
          let companyRows: Row[];
          try {
            const r = await fetch(HISTORY_ENDPOINT(s.id), { headers: authHeaders(token) });
            if (!r.ok) throw new Error("history failed");
            const hist = normalizeHistory(await r.json());
            companyRows =
              hist.length > 0
                ? hist.map((h: any, i: number) => ({
                    key: `${s.id}-${h.billing_period}-${i}`,
                    company_id: s.id,
                    company: s.client_name,
                    date: parseDate(h.billing_period) ?? new Date(),
                    period: h.billing_period || "-",
                    total: h.total_amount,
                    paid: h.paid_amount,
                    status: h.status,
                  }))
                : [currentRow(s)];
          } catch {
            // If history fails, use the current cycle's row
            companyRows = [currentRow(s)];
          }
          if (isStale()) return;
          acc.set(s.id, companyRows);
          setRows((prev) => [...prev.filter((x) => x.company_id !== s.id), ...companyRows]);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(HISTORY_CONCURRENCY, list.length) }, worker)
      );
      if (isStale()) return;

      dashCache = { subs: list, rows: Array.from(acc.values()).flat() };
      setHistoryLoading(false);
    } catch (e: any) {
      if (isStale()) return;
      setError(e?.message || "Could not load data");
      setHistoryLoading(false);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
    return () => {
      runRef.current++; // cancel any in-flight load when leaving the page
    };
  }, [load]);

  const subById = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);

  /* ---------- Date filter ---------- */
  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const inRange = useMemo(
    () =>
      rows.filter((r) => {
        const t = r.date.getTime();
        if (range.start !== null && t < range.start) return false;
        if (range.end !== null && t >= range.end) return false;
        return true;
      }),
    [rows, range]
  );

  /* ---------- KPI stats ---------- */
  const stats = useMemo(() => {
    const totalGyms = subs.length;
    const blocked = subs.filter((s) => s.is_blocked).length;
    const active = totalGyms - blocked;
    const totalRevenue = inRange.reduce((a, r) => a + r.total, 0);
    const received = inRange.reduce((a, r) => a + r.paid, 0);
    const remaining = inRange.reduce((a, r) => a + Math.max(r.total - r.paid, 0), 0);
    const percent = totalRevenue > 0 ? Math.round((received / totalRevenue) * 100) : 0;
    const fullyPaid = inRange.filter((r) => r.status === "paid").length;
    const dueCount = inRange.filter((r) => r.total > r.paid).length;
    return { totalGyms, blocked, active, totalRevenue, received, remaining, percent, fullyPaid, dueCount };
  }, [subs, inRange]);

  /* ---------- Chart data ---------- */
  const series = useMemo(() => {
    const [fy, fm] = chFrom.split("-").map(Number);
    const [ty, tm] = chTo.split("-").map(Number);
    if (!fy || !fm || !ty || !tm) return [];
    const list: { key: string; label: string; billed: number; received: number; remaining: number }[] = [];
    let d = new Date(fy, fm - 1, 1);
    const end = new Date(ty, tm - 1, 1);
    const sameYear = fy === ty;
    while (d.getTime() <= end.getTime() && list.length < 36) {
      list.push({
        key: monthKey(d),
        label: sameYear ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        billed: 0,
        received: 0,
        remaining: 0,
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    rows.forEach((r) => {
      const m = list.find((x) => x.key === monthKey(r.date));
      if (m) {
        m.billed += r.total;
        m.received += r.paid;
        m.remaining += Math.max(r.total - r.paid, 0);
      }
    });
    return list;
  }, [rows, chFrom, chTo]);

  const cart = useMemo(() => {
    const max = niceMax(Math.max(...series.map((m) => m.billed), 0));
    const innerW = CW - PAD_L - PAD_R;
    const innerH = CH - PAD_T - PAD_B;
    const band = innerW / Math.max(series.length, 1);
    const x = (i: number) => PAD_L + band * (i + 0.5);
    const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
    const line = (key: "billed" | "received") =>
      series.map((m, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(m[key]).toFixed(1)}`).join(" ");
    const base = (PAD_T + innerH).toFixed(1);
    const area = (key: "billed" | "received") =>
      series.length === 0
        ? ""
        : `${line(key)} L${x(series.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
    const ticks = [0, 1, 2, 3, 4].map((i) => ({ v: (max / 4) * i, y: y((max / 4) * i) }));
    return { max, innerH, band, x, y, line, area, ticks };
  }, [series]);

  const chartTotals = useMemo(() => {
    const billed = series.reduce((a, m) => a + m.billed, 0);
    const received = series.reduce((a, m) => a + m.received, 0);
    const remaining = series.reduce((a, m) => a + m.remaining, 0);
    return { billed, received, remaining };
  }, [series]);

  const setQuickRange = (months: number | "year") => {
    const n = new Date();
    if (months === "year") {
      setChFrom(`${n.getFullYear()}-01`);
      setChTo(`${n.getFullYear()}-12`);
    } else {
      setChFrom(monthKey(new Date(n.getFullYear(), n.getMonth() - (months - 1), 1)));
      setChTo(monthKey(n));
    }
    setHover(null);
  };

  /* ---------- Payment status donut (follows the date filter) ---------- */
  const R = 62;
  const C = 2 * Math.PI * R;
  const statusDonut = useMemo(() => {
    const keys: PayState[] = ["paid", "unpaid"]; // <-- CHANGED (5)
    const segs = keys.map((k) => ({
      key: k,
      label: STATE_LABEL[k],
      value: inRange.filter((r) => r.status === k).length,
      color: STATE_COLOR[k],
    }));
    const total = segs.reduce((a, s) => a + s.value, 0);
    let offset = 0;
    const out = segs.map((sg) => {
      const len = total > 0 ? (sg.value / total) * C : 0;
      const item = { ...sg, len, offset };
      offset += len;
      return item;
    });
    return { segs: out, total };
  }, [inRange, C]);

  /* ---------- Lists ---------- */
  const topDues = useMemo(
    () =>
      inRange
        .map((r) => ({ r, due: r.total - r.paid }))
        .filter((x) => x.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, TOP_DUES_LIMIT),
    [inRange]
  );

  const expiringSoon = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const DAY = 24 * 60 * 60 * 1000;
    return subs
      .map((s) => {
        const e = parseDate(s.expires_at);
        const left = e ? Math.round((startOfDay(e).getTime() - today) / DAY) : null;
        return { s, left };
      })
      .filter((x): x is { s: Sub; left: number } => x.left !== null && x.left >= 0 && x.left <= 30)
      .sort((a, b) => a.left - b.left)
      .slice(0, EXPIRING_LIMIT);
  }, [subs]);

  const recent = useMemo(
    () => [...inRange].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, RECENT_LIMIT),
    [inRange]
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hv = hover !== null ? series[hover] : null;
  const isCart = chartType === "line" || chartType === "area" || chartType === "bar" || chartType === "stacked";

  // Pie: received amount by month
  const pieData = series
    .map((m, i) => ({ label: m.label, value: m.received, color: PALETTE[i % PALETTE.length] }))
    .filter((p) => p.value > 0);
  const pieTotal = pieData.reduce((a, p) => a + p.value, 0);

  // Donut: received vs remaining
  const donutSegs = [
    { label: "Received", value: chartTotals.received, color: "#22c55e" },
    { label: "Remaining", value: chartTotals.remaining, color: "#ef4444" },
  ];
  const donutTotal = donutSegs.reduce((a, s) => a + s.value, 0);
  const donutPercent = chartTotals.billed > 0 ? Math.round((chartTotals.received / chartTotals.billed) * 100) : 0;

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="dash-page">
          {/* Header */}
          <div className="dash-header">
            <div>
              <h1 className="dash-title">
                {getGreeting()}, {user?.name ?? "Super Admin"}
              </h1>
              <p className="dash-subtitle">A complete overview of subscriptions and revenue across all gyms</p>
              {historyLoading && (
                <p className="dash-hint" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  Updating history...
                </p>
              )}
            </div>
            <div className="dash-date">
              <LuCalendar size={16} />
              <span>{today}</span>
            </div>
          </div>

          {error && (
            <div className="dash-alert">
              {error}. Could not load dashboard data.
              <button className="dash-alert-btn" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {/* Date filter */}
          <div className="dash-filters">
            <div className="dash-chips">
              {(["today", "week", "month", "year", "all", "custom"] as Preset[]).map((p) => (
                <button
                  key={p}
                  className={`dash-chip ${preset === p ? "dash-chip-active" : ""}`}
                  onClick={() => setPreset(p)}
                >
                  {PRESET_LABEL[p]}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="dash-custom">
                <label>
                  From
                  <input
                    type="date"
                    className="dash-date-input"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    className="dash-date-input"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* KPI cards */}
          <div className="dash-cards">
            <div className="dash-card">
              <div className="dash-icon dash-icon-amber">
                <LuDumbbell size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Total Gyms</span>
                <span className="dash-card-value">{loading ? "-" : stats.totalGyms}</span>
                <span className="dash-card-note">Subscribed gyms (excluding trials)</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-icon dash-icon-teal">
                <LuBadgeCheck size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Active Subscriptions</span>
                <span className="dash-card-value">{loading ? "-" : stats.active}</span>
                <span className="dash-card-note">{stats.blocked} blocked</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-icon dash-icon-purple">
                <LuWallet size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Total Revenue</span>
                <span className="dash-card-value">{formatPKR(stats.totalRevenue)}</span>
                <span className="dash-card-note">Total billed ({PRESET_LABEL[preset]})</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-icon dash-icon-green">
                <LuDownload size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Received</span>
                <span className="dash-card-value dash-green">{formatPKR(stats.received)}</span>
                <span className="dash-card-note">{stats.fullyPaid} bills fully paid</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-icon dash-icon-red">
                <LuHourglass size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Remaining</span>
                <span className="dash-card-value dash-red">{formatPKR(stats.remaining)}</span>
                <span className="dash-card-note">{stats.dueCount} bills with a balance due</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-icon dash-icon-orange">
                <LuTrendingUp size={24} />
              </div>
              <div className="dash-card-body">
                <span className="dash-card-label">Collection Rate</span>
                <span className="dash-card-value">{stats.percent}%</span>
                <div className="dash-mini-bar">
                  <div className="dash-mini-fill" style={{ width: `${stats.percent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="dash-grid-2">
            <div className="dash-panel">
              <div className="dash-panel-head">
                <div>
                  <h2 className="dash-panel-title">Revenue Overview</h2>
                  <p className="dash-panel-sub">Billed vs received by month</p>
                </div>
                <div className="dash-legend">
                  {chartType === "stacked" ? (
                    <>
                      <span><i className="dash-dot" style={{ background: "#22c55e" }} /> Received</span>
                      <span><i className="dash-dot" style={{ background: "#ef4444" }} /> Remaining</span>
                    </>
                  ) : isCart ? (
                    <>
                      <span><i className="dash-dot dash-dot-amber" /> Billed</span>
                      <span><i className="dash-dot dash-dot-green" /> Received</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Chart type tabs */}
              <div className="dash-chart-tabs">
                {CHART_TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`dash-tab ${chartType === t.key ? "dash-tab-active" : ""}`}
                    onClick={() => setChartType(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Chart month range */}
              <div className="dash-chart-filter">
                <label>
                  From
                  <input
                    type="month"
                    className="dash-date-input"
                    value={chFrom}
                    max={chTo || undefined}
                    onChange={(e) => {
                      setChFrom(e.target.value);
                      setHover(null);
                    }}
                  />
                </label>
                <label>
                  To
                  <input
                    type="month"
                    className="dash-date-input"
                    value={chTo}
                    min={chFrom || undefined}
                    onChange={(e) => {
                      setChTo(e.target.value);
                      setHover(null);
                    }}
                  />
                </label>
                <div className="dash-chips">
                  <button className="dash-chip" onClick={() => setQuickRange(6)}>6M</button>
                  <button className="dash-chip" onClick={() => setQuickRange(12)}>12M</button>
                  <button className="dash-chip" onClick={() => setQuickRange("year")}>This Year</button>
                </div>
              </div>

              {series.length === 0 ? (
                <div className="dash-empty-small">Please select a valid month range</div>
              ) : isCart ? (
                <div className="dash-chart-wrap">
                  <svg className="dash-chart" viewBox={`0 0 ${CW} ${CH}`} onMouseLeave={() => setHover(null)}>
                    <defs>
                      <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {cart.ticks.map((t, i) => (
                      <g key={i}>
                        <line x1={PAD_L} x2={CW - PAD_R} y1={t.y} y2={t.y} className="dash-grid-line" />
                        <text x={PAD_L - 8} y={t.y + 4} textAnchor="end" className="dash-axis-text">
                          {formatShort(t.v)}
                        </text>
                      </g>
                    ))}

                    {chartType === "area" && (
                      <>
                        <path d={cart.area("billed")} fill="url(#gBilled)" />
                        <path d={cart.area("received")} fill="url(#gPaid)" />
                      </>
                    )}

                    {(chartType === "line" || chartType === "area") && (
                      <>
                        <path d={cart.line("billed")} className="dash-line dash-line-amber" />
                        <path d={cart.line("received")} className="dash-line dash-line-green" />
                      </>
                    )}

                    {hover !== null && hv && (
                      <line
                        x1={cart.x(hover)}
                        x2={cart.x(hover)}
                        y1={PAD_T}
                        y2={PAD_T + cart.innerH}
                        className="dash-hover-line"
                      />
                    )}

                    {series.map((m, i) => {
                      const cx = cart.x(i);
                      const baseY = PAD_T + cart.innerH;
                      const bw = Math.min(26, cart.band * 0.32);
                      const sw = Math.min(40, cart.band * 0.5);
                      const hRec = (m.received / cart.max) * cart.innerH;
                      const hRem = (m.remaining / cart.max) * cart.innerH;
                      return (
                        <g key={m.key}>
                          {(chartType === "line" || chartType === "area") && (
                            <>
                              <circle cx={cx} cy={cart.y(m.billed)} r={hover === i ? 6 : 4} className="dash-point dash-point-amber" />
                              <circle cx={cx} cy={cart.y(m.received)} r={hover === i ? 6 : 4} className="dash-point dash-point-green" />
                            </>
                          )}

                          {chartType === "bar" && (
                            <>
                              <rect
                                x={cx - bw - 2}
                                y={cart.y(m.billed)}
                                width={bw}
                                height={Math.max(baseY - cart.y(m.billed), 0)}
                                rx={4}
                                fill="#fbbf24"
                                opacity={hover === null || hover === i ? 1 : 0.55}
                              />
                              <rect
                                x={cx + 2}
                                y={cart.y(m.received)}
                                width={bw}
                                height={Math.max(baseY - cart.y(m.received), 0)}
                                rx={4}
                                fill="#22c55e"
                                opacity={hover === null || hover === i ? 1 : 0.55}
                              />
                            </>
                          )}

                          {chartType === "stacked" && (
                            <>
                              <rect
                                x={cx - sw / 2}
                                y={baseY - hRec}
                                width={sw}
                                height={hRec}
                                rx={3}
                                fill="#22c55e"
                                opacity={hover === null || hover === i ? 1 : 0.55}
                              />
                              <rect
                                x={cx - sw / 2}
                                y={baseY - hRec - hRem}
                                width={sw}
                                height={hRem}
                                rx={3}
                                fill="#ef4444"
                                opacity={hover === null || hover === i ? 1 : 0.55}
                              />
                            </>
                          )}

                          <text x={cx} y={CH - 10} textAnchor="middle" className="dash-axis-text">
                            {m.label}
                          </text>
                          <rect
                            x={cx - cart.band / 2}
                            y={PAD_T}
                            width={cart.band}
                            height={cart.innerH}
                            fill="transparent"
                            onMouseEnter={() => setHover(i)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  <div className="dash-chart-info">
                    {hv ? (
                      <>
                        <strong>{hv.label}</strong>
                        <span>Billed: {formatPKR(hv.billed)}</span>
                        <span className="dash-green">Received: {formatPKR(hv.received)}</span>
                        <span className="dash-red">Remaining: {formatPKR(hv.remaining)}</span>
                      </>
                    ) : (
                      <span className="dash-hint">Hover over the chart to see that month's details</span>
                    )}
                  </div>
                </div>
              ) : chartType === "pie" ? (
                pieData.length === 0 ? (
                  <div className="dash-empty-small">No payments received in this range</div>
                ) : (
                  <div className="dash-donut-wrap">
                    <svg viewBox="0 0 180 180" className="dash-donut">
                      {(() => {
                        let angle = -Math.PI / 2;
                        return pieData.map((p) => {
                          const a0 = angle;
                          const a1 = angle + (p.value / pieTotal) * Math.PI * 2;
                          angle = a1;
                          return <path key={p.label} d={pieSlice(90, 90, 80, a0, a1)} fill={p.color} stroke="#111827" strokeWidth="2" />;
                        });
                      })()}
                    </svg>
                    <div className="dash-donut-legend">
                      {pieData.map((p) => (
                        <div key={p.label} className="dash-donut-row">
                          <span className="dash-donut-name">
                            <i className="dash-dot" style={{ background: p.color }} />
                            {p.label}
                          </span>
                          <span className="dash-donut-val">
                            {formatPKR(p.value)} <small>({Math.round((p.value / pieTotal) * 100)}%)</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="dash-donut-wrap">
                  <svg viewBox="0 0 180 180" className="dash-donut">
                    <circle cx="90" cy="90" r={R} className="dash-donut-bg" />
                    {(() => {
                      let off = 0;
                      return donutSegs.map((sg) => {
                        const len = donutTotal > 0 ? (sg.value / donutTotal) * C : 0;
                        const el =
                          len > 0 ? (
                            <circle
                              key={sg.label}
                              cx="90"
                              cy="90"
                              r={R}
                              fill="none"
                              stroke={sg.color}
                              strokeWidth="22"
                              strokeDasharray={`${len} ${C - len}`}
                              strokeDashoffset={-off}
                              transform="rotate(-90 90 90)"
                            />
                          ) : null;
                        off += len;
                        return el;
                      });
                    })()}
                    <text x="90" y="88" textAnchor="middle" className="dash-donut-num">
                      {donutPercent}%
                    </text>
                    <text x="90" y="106" textAnchor="middle" className="dash-donut-label">
                      Collected
                    </text>
                  </svg>
                  <div className="dash-donut-legend">
                    {donutSegs.map((sg) => (
                      <div key={sg.label} className="dash-donut-row">
                        <span className="dash-donut-name">
                          <i className="dash-dot" style={{ background: sg.color }} />
                          {sg.label}
                        </span>
                        <span className="dash-donut-val">{formatPKR(sg.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="dash-panel">
              <div className="dash-panel-head">
                <div>
                  <h2 className="dash-panel-title">Payment Status</h2>
                  <p className="dash-panel-sub">Bill status ({PRESET_LABEL[preset]})</p>
                </div>
              </div>

              <div className="dash-donut-wrap">
                <svg viewBox="0 0 180 180" className="dash-donut">
                  <circle cx="90" cy="90" r={R} className="dash-donut-bg" />
                  {statusDonut.segs.map((d) =>
                    d.value > 0 ? (
                      <circle
                        key={d.key}
                        cx="90"
                        cy="90"
                        r={R}
                        fill="none"
                        stroke={d.color}
                        strokeWidth="22"
                        strokeDasharray={`${d.len} ${C - d.len}`}
                        strokeDashoffset={-d.offset}
                        transform="rotate(-90 90 90)"
                      />
                    ) : null
                  )}
                  <text x="90" y="88" textAnchor="middle" className="dash-donut-num">
                    {statusDonut.total}
                  </text>
                  <text x="90" y="106" textAnchor="middle" className="dash-donut-label">
                    Bills
                  </text>
                </svg>

                <div className="dash-donut-legend">
                  {statusDonut.segs.map((d) => (
                    <div key={d.key} className="dash-donut-row">
                      <span className="dash-donut-name">
                        <i className="dash-dot" style={{ background: d.color }} />
                        {d.label}
                      </span>
                      <span className="dash-donut-val">
                        {d.value}{" "}
                        <small>({statusDonut.total > 0 ? Math.round((d.value / statusDonut.total) * 100) : 0}%)</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Lists row */}
          <div className="dash-grid-2 dash-grid-equal">
            <div className="dash-panel">
              <div className="dash-panel-head">
                <div>
                  <h2 className="dash-panel-title">Top Pending Dues</h2>
                  <p className="dash-panel-sub">Gyms with the highest outstanding balances</p>
                </div>
              </div>
              <div className="dash-list">
                {loading ? (
                  <div className="dash-empty-small">Loading...</div>
                ) : topDues.length === 0 ? (
                  <div className="dash-empty-small">No outstanding payments</div>
                ) : (
                  topDues.map(({ r, due }) => (
                    <div key={r.key} className="dash-list-item">
                      <div className="dash-avatar">{r.company.charAt(0).toUpperCase()}</div>
                      <div className="dash-list-info">
                        <div className="dash-list-name">{r.company}</div>
                        <div className="dash-list-sub">
                          {subById.get(r.company_id)?.plan ?? "-"} • {r.period}
                        </div>
                      </div>
                      <div className="dash-list-amount dash-red">{formatPKR(due)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dash-panel">
              <div className="dash-panel-head">
                <div>
                  <h2 className="dash-panel-title">Expiring Soon</h2>
                  <p className="dash-panel-sub">Subscriptions expiring in the next 30 days</p>
                </div>
              </div>
              <div className="dash-list">
                {loading ? (
                  <div className="dash-empty-small">Loading...</div>
                ) : expiringSoon.length === 0 ? (
                  <div className="dash-empty-small">No subscriptions expiring soon</div>
                ) : (
                  expiringSoon.map(({ s, left }) => (
                    <div key={s.id} className="dash-list-item">
                      <div className="dash-avatar dash-avatar-orange">{s.client_name.charAt(0).toUpperCase()}</div>
                      <div className="dash-list-info">
                        <div className="dash-list-name">{s.client_name}</div>
                        <div className="dash-list-sub">Expires: {s.expires_at}</div>
                      </div>
                      <span className={`dash-badge ${left <= 7 ? "dash-badge-unpaid" : "dash-badge-partial"}`}>
                        {left === 0 ? "Today" : `${left} ${left === 1 ? "day" : "days"}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent table */}
          <div className="dash-panel">
            <div className="dash-panel-head">
              <div>
                <h2 className="dash-panel-title">Recent Billing</h2>
                <p className="dash-panel-sub">Latest bills ({PRESET_LABEL[preset]})</p>
              </div>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Gym</th>
                    <th>Plan</th>
                    <th>Billing Period</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Payment</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="dash-empty-small">Loading...</td>
                    </tr>
                  ) : recent.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="dash-empty-small">No records in this range</td>
                    </tr>
                  ) : (
                    recent.map((r, i) => {
                      const sub = subById.get(r.company_id);
                      const remaining = Math.max(r.total - r.paid, 0);
                      return (
                        <tr key={r.key}>
                          <td>{i + 1}</td>
                          <td>
                            <div className="dash-client">{r.company}</div>
                            <div className="dash-phone">{sub?.phone ?? ""}</div>
                          </td>
                          <td>{sub?.plan ?? "-"}</td>
                          <td>{r.period}</td>
                          <td>{formatPKR(r.total)}</td>
                          <td className="dash-green dash-bold">{formatPKR(r.paid)}</td>
                          <td className={remaining > 0 ? "dash-red dash-bold" : ""}>{formatPKR(remaining)}</td>
                          <td>
                            <span className={`dash-badge ${STATE_BADGE[r.status] ?? "dash-badge-unpaid"}`}>
                              {STATE_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                          <td>
                            <span className={`dash-badge ${sub?.is_blocked ? "dash-badge-expired" : "dash-badge-active"}`}>
                              {sub?.is_blocked ? "Blocked" : "Active"}
                            </span>
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
    </div>
  );
}