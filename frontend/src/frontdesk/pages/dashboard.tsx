import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Footprints,
  Clock,
  Database,
  ChevronDown,
  CalendarDays,
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
  useEffect(() => {
    const fetchStats = async () => {
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
        console.error("Dashboard stats load nahi ho sake", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  /* ---------------- Page height ---------------- */
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

  return (
    <div
      className="db-dashboard"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
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
        {/* Recent Members — AB DYNAMIC */}
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

        {/* Upcoming Fee Dues — DYNAMIC */}
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
              <p className="db-summary-empty">Is month koi payment nahi hui.</p>
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