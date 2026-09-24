import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Clock,
  DollarSign,
  Receipt,
  CreditCard,
  CalendarDays,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./dashboard.css";

/* ---------------------------- Types & data ---------------------------- */

interface StatCard {
  id: string;
  title: string;
  period: string;
  value: string;
  change: string;
  direction: "up" | "down";
  positive: boolean;
  variant: "red" | "green" | "blue" | "orange";
  icon: React.ReactNode;
}

interface ExpiringMember {
  id: number;
  name: string;
  plan: string;
  expiry: string;
  days_left: number;
}

interface RecentAccessory {
  id: number;
  name: string;
  category: string;
  quantity: number;
}

interface MonthlyRevenue {
  label: string;
  month: string;
  amount: number;
}

interface MonthlyGrowth {
  label: string;
  month: number;
  total: number;
}

interface RecentStaff {
  id: number;
  name: string;
  role: string;
  specialization: string;
  experience: string;
  status: string;
}

interface OwnerStats {
  activeMembers: number;
  activeTrend: number;
  newMembers: number;
  newMembersTrend: number;
  overdueAmount: number;
  overdueTrend: number;
  revenue: number;
  revenueTrend: number;
  recentAccessories: RecentAccessory[];
  monthlyRevenue: MonthlyRevenue[];
  monthlyGrowth: MonthlyGrowth[];
  expiringMembers: ExpiringMember[];
  recentStaff: RecentStaff[];
  selectedYear: number;
  availableYears: number[];
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/* ------------------------------ Helpers ------------------------------ */

const formatTick = (v: number) => (v === 0 ? "PKR 0" : `PKR ${v / 1000}K`);
const formatPKR = (v: number) => `PKR ${v.toLocaleString("en-US")}`;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatDate = (d: Date) =>
  `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${
    MONTHS[d.getMonth()]
  } ${d.getFullYear()}`;

const formatTime = (d: Date) => {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${h12}:${mm} ${h >= 12 ? "PM" : "AM"}`;
};

/* -------------------------------- Component -------------------------------- */

const BOTTOM_GAP = 24;

const Dashboard = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(new Date());

  // Year filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dynamic stats from backend
  const [ownerStats, setOwnerStats] = useState<OwnerStats>({
    activeMembers: 0,
    activeTrend: 0,
    newMembers: 0,
    newMembersTrend: 0,
    overdueAmount: 0,
    overdueTrend: 0,
    revenue: 0,
    revenueTrend: 0,
    recentAccessories: [],
    monthlyRevenue: [],
    monthlyGrowth: [],
    expiringMembers: [],
    recentStaff: [],
    selectedYear: new Date().getFullYear(),
    availableYears: [],
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch owner stats (dependent on selectedYear)
  useEffect(() => {
    const fetchOwnerStats = async () => {
      try {
        const res = await fetch(
          `${API_URL}/owner/dashboard/stats?year=${selectedYear}`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setOwnerStats({
            activeMembers: data.active_members ?? 0,
            activeTrend: data.active_trend ?? 0,
            newMembers: data.new_members ?? 0,
            newMembersTrend: data.new_members_trend ?? 0,
            overdueAmount: Number(data.overdue_amount) || 0,
            overdueTrend: data.overdue_trend ?? 0,
            revenue: Number(data.revenue) || 0,
            revenueTrend: data.revenue_trend ?? 0,
            recentAccessories: Array.isArray(data.recent_accessories)
              ? data.recent_accessories
              : [],
            monthlyRevenue: Array.isArray(data.monthly_revenue)
              ? data.monthly_revenue
              : [],
            monthlyGrowth: Array.isArray(data.monthly_growth)
              ? data.monthly_growth
              : [],
            expiringMembers: Array.isArray(data.expiring_members)
              ? data.expiring_members
              : [],
            recentStaff: Array.isArray(data.recent_staff)
              ? data.recent_staff
              : [],
            selectedYear: data.selected_year ?? selectedYear,
            availableYears: Array.isArray(data.available_years)
              ? data.available_years
              : [],
          });
        }
      } catch (err) {
        console.error("Owner stats load nahi ho sake", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchOwnerStats();
  }, [selectedYear]);

  // Make the dashboard its own scroll container regardless of the layout
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
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  /* ---- Dynamic stat cards ---- */
  const statsCards: StatCard[] = [
    {
      id: "active",
      title: "Active Members",
      period: "Right now",
      value: loadingStats
        ? "..."
        : ownerStats.activeMembers.toLocaleString("en-US"),
      change: `${Math.abs(ownerStats.activeTrend)}%`,
      direction: ownerStats.activeTrend >= 0 ? "up" : "down",
      positive: ownerStats.activeTrend >= 0,
      variant: "green",
      icon: <Users size={26} />,
    },
    {
      id: "new-members",
      title: "New Members",
      period: "This Month",
      value: loadingStats
        ? "..."
        : ownerStats.newMembers.toLocaleString("en-US"),
      change: `${Math.abs(ownerStats.newMembersTrend)}%`,
      direction: ownerStats.newMembersTrend >= 0 ? "up" : "down",
      positive: ownerStats.newMembersTrend >= 0,
      variant: "red",
      icon: <UserPlus size={26} />,
    },
    {
      id: "overdue",
      title: "Overdue Payments",
      period: "This Month",
      value: loadingStats
        ? "..."
        : `PKR ${ownerStats.overdueAmount.toLocaleString("en-US")}`,
      change: `${Math.abs(ownerStats.overdueTrend)}%`,
      direction: ownerStats.overdueTrend >= 0 ? "up" : "down",
      positive: ownerStats.overdueTrend <= 0,
      variant: "orange",
      icon: <Clock size={26} />,
    },
    {
      id: "revenue",
      title: "Revenue Collected",
      period: "This Month",
      value: loadingStats
        ? "..."
        : `PKR ${ownerStats.revenue.toLocaleString("en-US")}`,
      change: `${Math.abs(ownerStats.revenueTrend)}%`,
      direction: ownerStats.revenueTrend >= 0 ? "up" : "down",
      positive: ownerStats.revenueTrend >= 0,
      variant: "blue",
      icon: <DollarSign size={26} />,
    },
  ];

  /* ---- Monthly Revenue Bar Chart (selected year, 12 months) ---- */
  const revenueAmounts = ownerStats.monthlyRevenue.map((m) => m.amount);
  const revenueRawMax =
    revenueAmounts.length > 0 ? Math.max(...revenueAmounts) : 0;
  const revenueMax = Math.max(
    10000,
    Math.ceil(revenueRawMax / 10000) * 10000
  );

  const revenueYTicks = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((revenueMax / 5) * (5 - i));
    return val;
  });

  /* ---- Member Growth Bar Chart (selected year, 12 months) ---- */
  const growthData = ownerStats.monthlyGrowth;
  const growthTotals = growthData.map((g) => g.total);
  const growthRawMax =
    growthTotals.length > 0 ? Math.max(...growthTotals) : 0;
  const growthMax = Math.max(100, Math.ceil(growthRawMax / 100) * 100);

  const growthYTicks = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((growthMax / 5) * (5 - i));
    return val;
  });

  // Dropdown ke liye saal
  const yearOptions =
    ownerStats.availableYears.length > 0
      ? ownerStats.availableYears
      : [new Date().getFullYear()];

  return (
    <div
      className="dashboard-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Welcome back, Owner!</h1>
          <p className="dash-subtitle">
            Here's what's happening at your gym today.
          </p>
        </div>

        <div className="dash-datetime">
          <div className="dash-datetime-text">
            <span className="dash-date">{formatDate(now)}</span>
            <span className="dash-time">{formatTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards — DYNAMIC */}
      <div className="dash-stats">
        {statsCards.map((s) => (
          <div key={s.id} className={`dash-stat-card ${s.variant}`}>
            <div className={`dash-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="dash-stat-info">
              <span className="dash-stat-title">{s.title}</span>
              <span className="dash-stat-period">{s.period}</span>
              <span className="dash-stat-value">{s.value}</span>
              <span
                className={`dash-stat-change ${s.positive ? "good" : "bad"}`}
              >
                {s.direction === "up" ? (
                  <ArrowUp size={16} strokeWidth={2.5} />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.5} />
                )}
                <strong>{s.change}</strong>
              </span>
              <span className="dash-stat-vs">vs. last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: monthly revenue bar chart (70%) + last 5 inventory items (30%) */}
      <div className="dash-grid dash-grid-70-30">
        {/* Monthly Revenue Bar Chart — 12 months of selected year */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <TrendingUp size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Monthly Revenue Trend</h2>
              <p>{selectedYear} — All 12 months</p>
            </div>

            {/* Year selector */}
            <div className="dash-select-wrap">
              <select
                className="dash-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="dash-select-icon" />
            </div>
          </div>

          <div className="dash-revenue-chart">
            <div className="dash-revenue-yaxis">
              {revenueYTicks.map((t) => (
                <span key={t}>{formatTick(t)}</span>
              ))}
            </div>
            <div className="dash-revenue-bars">
              {ownerStats.monthlyRevenue.length === 0 ? (
                <div className="dash-revenue-empty">No data available</div>
              ) : (
                ownerStats.monthlyRevenue.map((m) => {
                  const height =
                    revenueMax > 0 ? (m.amount / revenueMax) * 100 : 0;
                  return (
                    <div className="dash-revenue-group" key={m.month}>
                      <div
                        className="dash-revenue-bar"
                        style={{ height: `${height}%` }}
                        title={`${m.label}: ${formatPKR(m.amount)}`}
                      >
                        {m.amount > 0 && (
                          <span className="dash-revenue-value">
                            {m.amount >= 1000
                              ? `${Math.round(m.amount / 1000)}K`
                              : m.amount}
                          </span>
                        )}
                      </div>
                      <span className="dash-revenue-label">{m.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Last 5 Inventory Items — DYNAMIC */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <CreditCard size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Inventory</h2>
            </div>
            <button
              type="button"
              className="dash-pill-btn"
              onClick={() => navigate("/admin/inventory/accessories")}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th className="right">Category</th>
                  <th className="center">Qty</th>
                </tr>
              </thead>
              <tbody>
                {ownerStats.recentAccessories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="dash-empty-cell">
                      No recent inventory items.
                    </td>
                  </tr>
                ) : (
                  ownerStats.recentAccessories.map((item) => (
                    <tr key={item.id}>
                      <td className="member-name">{item.name}</td>
                      <td className="right">
                        <span className="plan-badge">{item.category}</span>
                      </td>
                      <td className="center">{item.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Member growth trend (full width) — 12 months DYNAMIC */}
      <div className="dash-panel dash-panel-full">
        <div className="dash-panel-head">
          <div className="dash-panel-icon">
            <Users size={22} />
          </div>
          <div className="dash-panel-heading">
            <h2>Member Growth Trend</h2>
            <p>{selectedYear} — Total members at each month</p>
          </div>

          {/* Year selector */}
          <div className="dash-select-wrap">
            <select
              className="dash-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="dash-select-icon" />
          </div>
        </div>

        <div className="dash-revenue-chart dash-growth-chart">
          <div className="dash-revenue-yaxis">
            {growthYTicks.map((t) => (
              <span key={t}>{t.toLocaleString("en-US")}</span>
            ))}
          </div>
          <div className="dash-revenue-bars">
            {growthData.length === 0 ? (
              <div className="dash-revenue-empty">No data available</div>
            ) : (
              growthData.map((g) => {
                const height = growthMax > 0 ? (g.total / growthMax) * 100 : 0;
                return (
                  <div className="dash-revenue-group" key={g.month}>
                    <div
                      className="dash-revenue-bar"
                      style={{ height: `${height}%` }}
                      title={`${g.label}: ${g.total} members`}
                    >
                      {g.total > 0 && (
                        <span className="dash-revenue-value">
                          {g.total >= 1000
                            ? `${(g.total / 1000).toFixed(1)}K`
                            : g.total}
                        </span>
                      )}
                    </div>
                    <span className="dash-revenue-label">{g.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Row 2: memberships expiring soon + recent staff */}
      <div className="dash-grid dash-grid-row2">
        {/* Memberships expiring soon — DYNAMIC */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <CalendarDays size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Memberships Expiring Soon</h2>
              <p>Next 7 days</p>
            </div>
            <button
              type="button"
              className="dash-pill-btn"
              onClick={() => navigate("/admin/memberships")}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Membership Type</th>
                  <th>Expiry Date</th>
                  <th className="center">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {ownerStats.expiringMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="dash-empty-cell">
                      No memberships expiring in next 7 days.
                    </td>
                  </tr>
                ) : (
                  ownerStats.expiringMembers.map((m) => (
                    <tr key={m.id}>
                      <td className="member-name">{m.name}</td>
                      <td>{m.plan}</td>
                      <td>{m.expiry}</td>
                      <td className="center">
                        <span className="days-badge">{m.days_left}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Staff (Members) — DYNAMIC */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <Receipt size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Members</h2>
              <p>Recent trainers & front desk</p>
            </div>
            <button
              type="button"
              className="dash-pill-btn"
              onClick={() => navigate("/admin/members")}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Specialization</th>
                  <th className="center">Exp.</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {ownerStats.recentStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="dash-empty-cell">
                      No recent staff members.
                    </td>
                  </tr>
                ) : (
                  ownerStats.recentStaff.map((s) => (
                    <tr key={`${s.role}-${s.id}`}>
                      <td className="member-name">{s.name}</td>
                      <td>{s.role}</td>
                      <td>{s.specialization}</td>
                      <td className="center">{s.experience}</td>
                      <td className="center">
                        <span
                          className={`status-badge ${
                            s.status === "Active" ? "paid" : "pending"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;