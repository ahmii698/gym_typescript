import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Footprints,
  Clock,
  Database,
  ChevronDown,
  CalendarDays,
  RefreshCw,
  FileText,
  Download,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./dashboard.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StatCard {
  id: string;
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  variant: "red" | "green" | "orange" | "redSolid";
}

interface RecentMember {
  id: number;
  name: string;
  package: string;
  join_date: string;
  status: string;
}

interface UpcomingDue {
  id: number;
  name: string;
  package: string;
  due_date: string;
  days_left: number;
  amount: number;
}

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  pendingDue: number;
  feesCollected: number;
  feesTrend: number;
  membersTrend: number;
  feesByMethod: {
    cash: number;
    bank_transfer: number;
    online: number;
    card: number;
  };
  chart: {
    labels: string[];
    total: number[];
    active: number[];
  };
  upcomingDues: UpcomingDue[];
  recentMembers: RecentMember[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const formatPKR = (amount: number) => {
  return `PKR ${amount.toLocaleString("en-PK")}`;
};

const BOTTOM_GAP = 24;
/* Below this width (tablet/mobile) no fixed height is applied */
const FIXED_HEIGHT_MIN_WIDTH = 1024;

/* Escapes a value for safe use inside a CSV cell */
const csvCell = (value: string | number) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

/* Escapes a value for safe use inside HTML (PDF report) */
const escapeHtml = (value: string | number) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/*  Inline styles for the action buttons (no external CSS)             */
/* ------------------------------------------------------------------ */

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  flexShrink: 0,
};

const baseActionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 18px",
  border: "none",
  borderRadius: 10,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "inherit",
  lineHeight: 1,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const refreshBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#3b82f6",
};

const excelBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#22c55e",
};

const pdfBtnStyle: React.CSSProperties = {
  ...baseActionBtnStyle,
  backgroundColor: "#ef4444",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    pendingDue: 0,
    feesCollected: 0,
    feesTrend: 0,
    membersTrend: 0,
    feesByMethod: { cash: 0, bank_transfer: 0, online: 0, card: 0 },
    chart: { labels: [], total: [], active: [] },
    upcomingDues: [],
    recentMembers: [],
  });
  const [loadingStats, setLoadingStats] = useState(true);

  /* ---------------- Fetch dashboard stats ---------------- */
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_URL}/dashboard/stats`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalMembers: data.total_members ?? 0,
          activeMembers: data.active_members ?? 0,
          pendingDue: data.pending_due ?? 0,
          feesCollected: Number(data.fees_collected) || 0,
          feesTrend: data.fees_trend ?? 0,
          membersTrend: data.members_trend ?? 0,
          feesByMethod: {
            cash: Number(data.fees_by_method?.cash) || 0,
            bank_transfer: Number(data.fees_by_method?.bank_transfer) || 0,
            online: Number(data.fees_by_method?.online) || 0,
            card: Number(data.fees_by_method?.card) || 0,
          },
          chart: {
            labels: data.chart?.labels ?? [],
            total: data.chart?.total ?? [],
            active: data.chart?.active ?? [],
          },
          upcomingDues: Array.isArray(data.upcoming_dues)
            ? data.upcoming_dues
            : [],
          recentMembers: Array.isArray(data.recent_members)
            ? data.recent_members
            : [],
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  /* ---------------- Page height (desktop only) ---------------- */
  useLayoutEffect(() => {
    const updateHeight = () => {
      if (!pageRef.current) return;

      // Tablet / mobile: no fixed height, let the page scroll naturally
      if (window.innerWidth <= FIXED_HEIGHT_MIN_WIDTH) {
        setPageHeight(undefined);
        return;
      }

      const top = pageRef.current.getBoundingClientRect().top + window.scrollY;
      setPageHeight(Math.max(320, window.innerHeight - top - BOTTOM_GAP));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  /* ---------------- Dynamic stat cards ---------------- */
  const statCards: StatCard[] = [
    {
      id: "total",
      title: "Total Members",
      value: loadingStats ? "..." : String(stats.totalMembers),
      trend: `${Math.abs(stats.membersTrend)}% from last month`,
      trendUp: stats.membersTrend >= 0,
      icon: <Users size={22} />,
      variant: "red",
    },
    {
      id: "active",
      title: "Active Members",
      value: loadingStats ? "..." : String(stats.activeMembers),
      trend: `${Math.abs(stats.membersTrend)}% from last month`,
      trendUp: stats.membersTrend >= 0,
      icon: <Footprints size={22} />,
      variant: "green",
    },
    {
      id: "pending",
      title: "Pending Due (This Month)",
      value: loadingStats ? "..." : String(stats.pendingDue),
      trend: `${stats.pendingDue} members pending`,
      trendUp: false,
      icon: <Clock size={22} />,
      variant: "orange",
    },
    {
      id: "fees",
      title: "Fees Collected (This Month)",
      value: loadingStats ? "..." : formatPKR(stats.feesCollected),
      trend: `${Math.abs(stats.feesTrend)}% from last month`,
      trendUp: stats.feesTrend >= 0,
      icon: <Database size={22} />,
      variant: "redSolid",
    },
  ];

  /* ---------------- Chart calculations ---------------- */
  const chartData = stats.chart;
  const allChartValues = [...chartData.total, ...chartData.active];
  const rawMax = allChartValues.length > 0 ? Math.max(...allChartValues) : 10;
  const chartMax = Math.max(10, Math.ceil(rawMax / 10) * 10);

  const yAxisSteps = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((chartMax / 5) * (5 - i));
    return val;
  });

  /* ---------------- Payment status percentages ---------------- */
  const paidPercent = stats.totalMembers
    ? Math.round((stats.activeMembers / stats.totalMembers) * 100)
    : 0;
  const pendingPercent = stats.totalMembers
    ? Math.round((stats.pendingDue / stats.totalMembers) * 100)
    : 0;
  const overduePercent = Math.max(0, 100 - paidPercent - pendingPercent);

  /* ---------------- Fee method rows ---------------- */
  const totalMethodAmount =
    stats.feesByMethod.cash +
    stats.feesByMethod.bank_transfer +
    stats.feesByMethod.online +
    stats.feesByMethod.card;

  const effectiveMethods =
    totalMethodAmount > 0
      ? stats.feesByMethod
      : {
          cash: stats.feesCollected,
          bank_transfer: 0,
          online: 0,
          card: 0,
        };

  const effectiveTotal =
    effectiveMethods.cash +
    effectiveMethods.bank_transfer +
    effectiveMethods.online +
    effectiveMethods.card;

  const methodRows = [
    { label: "Cash",                  amount: effectiveMethods.cash,          percent: effectiveTotal ? Math.round((effectiveMethods.cash / effectiveTotal) * 100) : 0 },
    { label: "Bank Transfer",         amount: effectiveMethods.bank_transfer, percent: effectiveTotal ? Math.round((effectiveMethods.bank_transfer / effectiveTotal) * 100) : 0 },
    { label: "JazzCash / Easypaisa",  amount: effectiveMethods.online,        percent: effectiveTotal ? Math.round((effectiveMethods.online / effectiveTotal) * 100) : 0 },
    { label: "Card",                  amount: effectiveMethods.card,          percent: effectiveTotal ? Math.round((effectiveMethods.card / effectiveTotal) * 100) : 0 },
  ].filter((row) => row.amount > 0);

  const topMethodPercent = methodRows.length > 0 ? methodRows[0].percent : 0;

  /* ---------------- Export: Excel (CSV, opens in Excel) ---------------- */
  const handleExportExcel = () => {
    const rows: (string | number)[][] = [];

    rows.push(["Dashboard Report"]);
    rows.push(["Generated", new Date().toLocaleString("en-US")]);
    rows.push([]);

    rows.push(["Summary"]);
    rows.push(["Total Members", stats.totalMembers]);
    rows.push(["Active Members", stats.activeMembers]);
    rows.push(["Pending Due (This Month)", stats.pendingDue]);
    rows.push(["Fees Collected (This Month)", stats.feesCollected]);
    rows.push(["Fees Trend (%)", stats.feesTrend]);
    rows.push([]);

    rows.push(["Fee Collection By Method"]);
    rows.push(["Method", "Amount", "Percent"]);
    methodRows.forEach((r) => rows.push([r.label, r.amount, `${r.percent}%`]));
    rows.push([]);

    rows.push(["Recent Members"]);
    rows.push(["#", "Name", "Package", "Join Date", "Status"]);
    stats.recentMembers.forEach((m, i) =>
      rows.push([i + 1, m.name, m.package, m.join_date, m.status])
    );
    rows.push([]);

    rows.push(["Upcoming Fee Dues"]);
    rows.push(["#", "Member Name", "Package", "Due Date", "Days Left", "Amount"]);
    stats.upcomingDues.forEach((d, i) =>
      rows.push([i + 1, d.name, d.package, d.due_date, d.days_left, Number(d.amount) || 0])
    );

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    // BOM so Excel reads UTF-8 correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---------------- Export: PDF (print dialog > Save as PDF) ---------------- */
  const handleExportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow pop-ups for this site to export the PDF.");
      return;
    }

    const memberRows = stats.recentMembers
      .map(
        (m, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.package)}</td><td>${escapeHtml(m.join_date)}</td><td>${escapeHtml(m.status)}</td></tr>`
      )
      .join("");

    const dueRows = stats.upcomingDues
      .map(
        (d, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.package)}</td><td>${escapeHtml(d.due_date)}</td><td>${d.days_left}</td><td>${escapeHtml(formatPKR(Number(d.amount) || 0))}</td></tr>`
      )
      .join("");

    const methodHtmlRows = methodRows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(formatPKR(r.amount))}</td><td>${r.percent}%</td></tr>`
      )
      .join("");

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Dashboard Report</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 24px 0 8px; font-size: 16px; }
  p.meta { margin: 0 0 16px; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  .grid { display: flex; gap: 12px; flex-wrap: wrap; }
  .card { flex: 1; min-width: 150px; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .card span { display: block; font-size: 11px; color: #666; }
  .card strong { font-size: 18px; }
</style>
</head>
<body>
  <h1>Dashboard Report</h1>
  <p class="meta">Generated ${escapeHtml(new Date().toLocaleString("en-US"))}</p>

  <div class="grid">
    <div class="card"><span>Total Members</span><strong>${stats.totalMembers}</strong></div>
    <div class="card"><span>Active Members</span><strong>${stats.activeMembers}</strong></div>
    <div class="card"><span>Pending Due (This Month)</span><strong>${stats.pendingDue}</strong></div>
    <div class="card"><span>Fees Collected (This Month)</span><strong>${escapeHtml(formatPKR(stats.feesCollected))}</strong></div>
  </div>

  <h2>Fee Collection By Method</h2>
  <table>
    <thead><tr><th>Method</th><th>Amount</th><th>Percent</th></tr></thead>
    <tbody>${methodHtmlRows || '<tr><td colspan="3">No payments were recorded this month.</td></tr>'}</tbody>
  </table>

  <h2>Recent Members</h2>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Package</th><th>Join Date</th><th>Status</th></tr></thead>
    <tbody>${memberRows || '<tr><td colspan="5">No recent members.</td></tr>'}</tbody>
  </table>

  <h2>Upcoming Fee Dues</h2>
  <table>
    <thead><tr><th>#</th><th>Member Name</th><th>Package</th><th>Due Date</th><th>Days Left</th><th>Amount</th></tr></thead>
    <tbody>${dueRows || '<tr><td colspan="6">No upcoming dues in the next 7 days.</td></tr>'}</tbody>
  </table>
</body>
</html>`);
    win.document.close();
    win.focus();
    // Give the new window a moment to render before opening the print dialog
    setTimeout(() => {
      win.print();
    }, 300);
  };

  return (
    <div
      className="db-dashboard"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Action Buttons: Refresh / Excel / PDF */}
      <div style={actionsRowStyle}>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loadingStats}
          style={{
            ...refreshBtnStyle,
            opacity: loadingStats ? 0.7 : 1,
            cursor: loadingStats ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
        <button type="button" onClick={handleExportExcel} style={excelBtnStyle}>
          <FileText size={16} />
          Excel
        </button>
        <button type="button" onClick={handleExportPdf} style={pdfBtnStyle}>
          <Download size={16} />
          PDF
        </button>
      </div>

      {/* Stat Cards */}
      <div className="db-stats-row">
        {statCards.map((card) => (
          <div key={card.id} className={`db-stat-card db-stat-${card.variant}`}>
            <div className="db-stat-icon-wrap">{card.icon}</div>
            <div className="db-stat-content">
              <span className="db-stat-title">{card.title}</span>
              <span className="db-stat-value">{card.value}</span>
              <span
                className={`db-stat-trend ${
                  card.trendUp ? "db-trend-up" : "db-trend-down"
                }`}
              >
                {card.trendUp ? "↑" : "↓"} {card.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Section: Chart + Donut */}
      <div className="db-middle-row">
        <div className="db-panel db-chart-panel">
          <div className="db-panel-header">
            <h3>Membership Overview</h3>
            <button className="db-dropdown-btn">
              <CalendarDays size={14} />
              Last 6 Months
              <ChevronDown size={14} />
            </button>
          </div>

          <div className="db-chart-legend">
            <span className="db-legend-item">
              <span className="db-legend-dot db-dot-red" /> Total Members
            </span>
            <span className="db-legend-item">
              <span className="db-legend-dot db-dot-gray" /> Active Members
            </span>
          </div>

          {/* BAR CHART */}
          <div className="db-bar-chart-wrap">
            <div className="db-chart-yaxis">
              {yAxisSteps.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
            <div className="db-bar-chart">
              {chartData.labels.length === 0 ? (
                <div className="db-bar-empty">No data available</div>
              ) : (
                chartData.labels.map((label, i) => {
                  const totalVal = chartData.total[i] ?? 0;
                  const activeVal = chartData.active[i] ?? 0;
                  const totalHeight =
                    chartMax > 0 ? (totalVal / chartMax) * 100 : 0;
                  const activeHeight =
                    chartMax > 0 ? (activeVal / chartMax) * 100 : 0;
                  return (
                    <div className="db-bar-group" key={`${label}-${i}`}>
                      <div className="db-bar-pair">
                        <div
                          className="db-bar db-bar-total"
                          style={{ height: `${totalHeight}%` }}
                          title={`Total: ${totalVal}`}
                        >
                          {totalVal > 0 && (
                            <span className="db-bar-value">{totalVal}</span>
                          )}
                        </div>
                        <div
                          className="db-bar db-bar-active"
                          style={{ height: `${activeHeight}%` }}
                          title={`Active: ${activeVal}`}
                        >
                          {activeVal > 0 && (
                            <span className="db-bar-value">{activeVal}</span>
                          )}
                        </div>
                      </div>
                      <span className="db-bar-label">{label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Donut */}
        <div className="db-panel db-donut-panel">
          <div className="db-panel-header">
            <h3>Payment Status</h3>
          </div>
          <div className="db-donut-body">
            <div className="db-donut-chart">
              <div className="db-donut-center">
                <span className="db-donut-value">
                  {loadingStats ? "..." : stats.totalMembers}
                </span>
                <span className="db-donut-label">Total Members</span>
              </div>
            </div>
            <div className="db-donut-legend">
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-green" />
                <div>
                  <p className="db-legend-title">Paid</p>
                  <p className="db-legend-sub">
                    {stats.activeMembers} ({paidPercent}%)
                  </p>
                </div>
              </div>
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-orange" />
                <div>
                  <p className="db-legend-title">Pending</p>
                  <p className="db-legend-sub">
                    {stats.pendingDue} ({pendingPercent}%)
                  </p>
                </div>
              </div>
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-red" />
                <div>
                  <p className="db-legend-title">Overdue</p>
                  <p className="db-legend-sub db-legend-sub-red">
                    0 ({overduePercent}%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="db-bottom-row">
        {/* Recent Members */}
        <div className="db-panel db-table-panel">
          <div className="db-panel-header">
            <div className="db-panel-title-group">
              <div className="db-panel-icon db-icon-red">
                <Users size={16} />
              </div>
              <div>
                <h3>Recent Members</h3>
                <p className="db-panel-subtitle">Latest 5 members added</p>
              </div>
            </div>
            <button
              className="db-view-all-btn"
              onClick={() => navigate("/frontdesk/fee-collection")}
            >
              View All
            </button>
          </div>
          <div className="db-table-scroll">
            <table className="db-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Package</th>
                  <th>Join Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="db-empty-cell">
                      No recent members.
                    </td>
                  </tr>
                ) : (
                  stats.recentMembers.map((m, idx) => (
                    <tr key={m.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="db-member-cell">
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td>{m.package}</td>
                      <td>{m.join_date}</td>
                      <td>
                        <span
                          className={`db-badge ${
                            m.status === "Active"
                              ? "db-badge-green"
                              : "db-badge-red"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Fee Dues */}
        <div className="db-panel db-table-panel">
          <div className="db-panel-header">
            <div className="db-panel-title-group">
              <div className="db-panel-icon db-icon-red">
                <CalendarDays size={16} />
              </div>
              <div>
                <h3>Upcoming Fee Dues</h3>
                <p className="db-panel-subtitle">
                  Members with fees due in next 7 days
                </p>
              </div>
            </div>
            <button
              className="db-view-all-btn"
              onClick={() => navigate("/frontdesk/fee-collection")}
            >
              View All
            </button>
          </div>
          <div className="db-table-scroll">
            <table className="db-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Package</th>
                  <th>Due In</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.upcomingDues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="db-empty-cell">
                      No upcoming dues in next 7 days.
                    </td>
                  </tr>
                ) : (
                  stats.upcomingDues.map((d, idx) => (
                    <tr key={d.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="db-member-cell">
                          <span>{d.name}</span>
                        </div>
                      </td>
                      <td>{d.package}</td>
                      <td>
                        <span className="db-due-days">
                          {d.days_left} day{d.days_left === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td>
                        <span className="db-badge db-badge-red">
                          {formatPKR(Number(d.amount) || 0)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fee Collection Summary */}
        <div className="db-panel db-summary-panel">
          <div className="db-panel-header">
            <div className="db-panel-title-group">
              <div className="db-panel-icon db-icon-red">
                <Database size={16} />
              </div>
              <div>
                <h3>Fee Collection Summary</h3>
                <p className="db-panel-subtitle">This Month</p>
              </div>
            </div>
            <span className="db-summary-trend">
              {stats.feesTrend >= 0 ? "↑" : "↓"} {Math.abs(stats.feesTrend)}%
            </span>
          </div>
          <p className="db-summary-trend-sub">vs last month</p>

          <h2 className="db-summary-total">{formatPKR(stats.feesCollected)}</h2>
          <p className="db-summary-total-label">Total Collected</p>

          <div className="db-summary-breakdown">
            {methodRows.length === 0 ? (
              <p className="db-summary-empty">No payments were recorded this month.</p>
            ) : (
              methodRows.map((row) => (
                <div className="db-summary-row" key={row.label}>
                  <span>{row.label}</span>
                  <span className="db-summary-amount">{formatPKR(row.amount)}</span>
                  <span className="db-summary-percent">{row.percent}%</span>
                </div>
              ))
            )}
          </div>

          <div className="db-summary-progress">
            <div
              className="db-summary-progress-fill"
              style={{ width: `${topMethodPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;