import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
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
  Wallet,
  PiggyBank,
  RefreshCw,
  FileText,
  Download,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./dashboard.css";

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
  totalExpense: number;
  expenseTrend: number;
  profit: number;
  profitTrend: number;
  recentAccessories: RecentAccessory[];
  monthlyRevenue: MonthlyRevenue[];
  monthlyGrowth: MonthlyGrowth[];
  expiringMembers: ExpiringMember[];
  recentStaff: RecentStaff[];
  selectedYear: number;
  availableYears: number[];
}

interface ReportSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

type Period = "today" | "week" | "month" | "year" | "custom";
type ChartType = "bar" | "hbar" | "line" | "area" | "pie" | "donut";

interface ChartPoint {
  label: string;
  value: number;
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom" },
];

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "bar", label: "Bar Chart" },
  { id: "hbar", label: "Horizontal Bar" },
  { id: "line", label: "Line Chart" },
  { id: "area", label: "Area Chart" },
  { id: "pie", label: "Pie Chart" },
  { id: "donut", label: "Donut Chart" },
];

const PALETTE = [
  "#ff2d4a",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#8b5cf6",
  "#eab308",
];

const actionsWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginLeft: "auto",
};

const actionBtnStyle = (bg: string, disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  border: "none",
  borderRadius: 10,
  background: bg,
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  lineHeight: 1,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  appearance: "none",
  WebkitAppearance: "none",
  transition: "filter 0.15s ease, transform 0.15s ease",
});

const ACTION_CSS = `
.dash-action-btn:hover:not(:disabled) {
  filter: brightness(1.1) !important;
  transform: translateY(-1px);
}
.dash-spin {
  animation: dash-spin 0.8s linear infinite;
}
@keyframes dash-spin {
  to { transform: rotate(360deg); }
}
`;

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

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

const shortValue = (v: number) =>
  v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);

const polar = (cx: number, cy: number, r: number, a: number) => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

const arcPath = (
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
) => {
  const end = a1 - a0 >= Math.PI * 2 - 0.0001 ? a0 + Math.PI * 2 - 0.0001 : a1;
  const large = end - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, r1, a0);
  const [ox1, oy1] = polar(cx, cy, r1, end);
  const [ix1, iy1] = polar(cx, cy, r0, end);
  const [ix0, iy0] = polar(cx, cy, r0, a0);
  return `M ${ox0} ${oy0} A ${r1} ${r1} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r0} ${r0} 0 ${large} 0 ${ix0} ${iy0} Z`;
};

const escapeCsv = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const escapeHtml = (v: string | number) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const todayStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

interface ChartViewProps {
  data: ChartPoint[];
  type: ChartType;
  max: number;
  ticks: number[];
  formatAxis: (v: number) => string;
  formatFull: (v: number) => string;
}

const ChartView = ({
  data,
  type,
  max,
  ticks,
  formatAxis,
  formatFull,
}: ChartViewProps) => {
  if (data.length === 0) {
    return (
      <div className="dash-revenue-chart">
        <div className="dash-revenue-bars">
          <div className="dash-revenue-empty">No data available</div>
        </div>
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div className="dash-revenue-chart">
        <div className="dash-revenue-yaxis">
          {ticks.map((t) => (
            <span key={t}>{formatAxis(t)}</span>
          ))}
        </div>
        <div className="dash-revenue-bars">
          {data.map((d, i) => {
            const height = max > 0 ? (d.value / max) * 100 : 0;
            return (
              <div className="dash-revenue-group" key={`${d.label}-${i}`}>
                <div
                  className="dash-revenue-bar"
                  style={{ height: `${height}%` }}
                  title={`${d.label}: ${formatFull(d.value)}`}
                >
                  {d.value > 0 && (
                    <span className="dash-revenue-value">
                      {shortValue(d.value)}
                    </span>
                  )}
                </div>
                <span className="dash-revenue-label">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "hbar") {
    return (
      <div className="dash-alt-chart dash-hbar-list">
        {data.map((d, i) => {
          const width = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div className="dash-hbar-row" key={`${d.label}-${i}`}>
              <span className="dash-hbar-label">{d.label}</span>
              <div className="dash-hbar-track">
                <div
                  className="dash-hbar-fill"
                  style={{ width: `${width}%` }}
                  title={`${d.label}: ${formatFull(d.value)}`}
                />
              </div>
              <span className="dash-hbar-value">{formatFull(d.value)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "line" || type === "area") {
    const W = 1000;
    const H = 260;
    const n = data.length;
    const pts = data.map((d, i) => [
      ((i + 0.5) / n) * W,
      H - (max > 0 ? (d.value / max) * H : 0),
    ]);
    const line = pts.map((p) => p.join(",")).join(" ");
    const area = `${pts[0][0]},${H} ${line} ${pts[n - 1][0]},${H}`;
    return (
      <div className="dash-alt-chart">
        <div className="dash-line-wrap">
          <div className="dash-revenue-yaxis dash-line-yaxis">
            {ticks.map((t) => (
              <span key={t}>{formatAxis(t)}</span>
            ))}
          </div>
          <div className="dash-line-main">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="dash-line-svg"
            >
              <defs>
                <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff2d4a" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ff2d4a" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((t, i) => (
                <line
                  key={`${t}-${i}`}
                  x1="0"
                  x2={W}
                  y1={(i / (ticks.length - 1)) * H}
                  y2={(i / (ticks.length - 1)) * H}
                  stroke="rgba(255,255,255,0.06)"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {type === "area" && (
                <polygon points={area} fill="url(#dashAreaFill)" />
              )}
              <polyline
                points={line}
                fill="none"
                stroke="#ff2d4a"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="dash-line-dots">
              {pts.map((p, i) => (
                <span
                  key={i}
                  className="dash-line-dot"
                  style={{
                    left: `${(p[0] / W) * 100}%`,
                    top: `${(p[1] / H) * 100}%`,
                  }}
                  title={`${data[i].label}: ${formatFull(data[i].value)}`}
                />
              ))}
            </div>
            <div className="dash-line-labels">
              {data.map((d, i) => (
                <span key={`${d.label}-${i}`}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const slices = data
    .map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }))
    .filter((d) => d.value > 0);
  const total = slices.reduce((a, b) => a + b.value, 0);

  if (total === 0) {
    return (
      <div className="dash-revenue-chart">
        <div className="dash-revenue-bars">
          <div className="dash-revenue-empty">No data available</div>
        </div>
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const paths = slices.map((s) => {
    const a0 = angle;
    const a1 = angle + (s.value / total) * Math.PI * 2;
    angle = a1;
    return {
      ...s,
      d: arcPath(100, 100, type === "donut" ? 55 : 0, 95, a0, a1),
    };
  });

  return (
    <div className="dash-alt-chart dash-pie-wrap">
      <svg viewBox="0 0 200 200" className="dash-pie-svg">
        {paths.map((p, i) => (
          <path key={`${p.label}-${i}`} d={p.d} fill={p.color}>
            <title>{`${p.label}: ${formatFull(p.value)}`}</title>
          </path>
        ))}
      </svg>
      <div className="dash-pie-legend">
        {paths.map((p, i) => (
          <div className="dash-pie-item" key={`${p.label}-${i}`}>
            <span className="dash-pie-dot" style={{ background: p.color }} />
            <span className="dash-pie-name">{p.label}</span>
            <span className="dash-pie-val">
              {formatFull(p.value)} ({((p.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ChartSelectProps {
  value: ChartType;
  onChange: (v: ChartType) => void;
}

const ChartSelect = ({ value, onChange }: ChartSelectProps) => (
  <div className="dash-select-wrap">
    <select
      className="dash-select"
      value={value}
      onChange={(e) => onChange(e.target.value as ChartType)}
    >
      {CHART_TYPES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
    <ChevronDown size={14} className="dash-select-icon" />
  </div>
);

const BOTTOM_GAP = 24;

const Dashboard = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(new Date());

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<Period>("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [revenueChartType, setRevenueChartType] = useState<ChartType>("bar");
  const [growthChartType, setGrowthChartType] = useState<ChartType>("bar");
  const [refreshKey, setRefreshKey] = useState(0);

  const [ownerStats, setOwnerStats] = useState<OwnerStats>({
    activeMembers: 0,
    activeTrend: 0,
    newMembers: 0,
    newMembersTrend: 0,
    overdueAmount: 0,
    overdueTrend: 0,
    revenue: 0,
    revenueTrend: 0,
    totalExpense: 0,
    expenseTrend: 0,
    profit: 0,
    profitTrend: 0,
    recentAccessories: [],
    monthlyRevenue: [],
    monthlyGrowth: [],
    expiringMembers: [],
    recentStaff: [],
    selectedYear: new Date().getFullYear(),
    availableYears: [],
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (period === "custom" && !fromDate) return;

    const fetchOwnerStats = async () => {
      setLoadingStats(true);
      try {
        const params = new URLSearchParams({
          year: String(selectedYear),
          period,
        });
        if (period === "custom") {
          params.set("from", fromDate);
          params.set("to", toDate || fromDate);
        }
        const res = await fetch(
          `${API_URL}/owner/dashboard/stats?${params.toString()}`,
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
            totalExpense: Number(data.total_expense) || 0,
            expenseTrend: data.expense_trend ?? 0,
            profit: Number(data.profit) || 0,
            profitTrend: data.profit_trend ?? 0,
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
        console.error("Failed to load owner stats", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchOwnerStats();
  }, [selectedYear, period, fromDate, toDate, refreshKey]);

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

  const periodLabel = (() => {
    if (period === "today") return "Today";
    if (period === "week") return "This Week";
    if (period === "month") return "This Month";
    if (period === "year") return "This Year";
    if (!fromDate) return "Custom";
    const end = toDate && toDate !== fromDate ? ` - ${toDate}` : "";
    return `${fromDate}${end}`;
  })();

  const compareLabel =
    period === "today"
      ? "vs. yesterday"
      : period === "week"
      ? "vs. last week"
      : period === "month"
      ? "vs. last month"
      : period === "year"
      ? "vs. last year"
      : "vs. previous period";

  const money = (v: number) =>
    loadingStats ? "..." : `${v < 0 ? "-" : ""}PKR ${Math.abs(v).toLocaleString("en-US")}`;

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
      period: periodLabel,
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
      period: periodLabel,
      value: money(ownerStats.overdueAmount),
      change: `${Math.abs(ownerStats.overdueTrend)}%`,
      direction: ownerStats.overdueTrend >= 0 ? "up" : "down",
      positive: ownerStats.overdueTrend <= 0,
      variant: "orange",
      icon: <Clock size={26} />,
    },
    {
      id: "revenue",
      title: "Revenue Collected",
      period: periodLabel,
      value: money(ownerStats.revenue),
      change: `${Math.abs(ownerStats.revenueTrend)}%`,
      direction: ownerStats.revenueTrend >= 0 ? "up" : "down",
      positive: ownerStats.revenueTrend >= 0,
      variant: "blue",
      icon: <DollarSign size={26} />,
    },
    {
      id: "expense",
      title: "Total Expense",
      period: periodLabel,
      value: money(ownerStats.totalExpense),
      change: `${Math.abs(ownerStats.expenseTrend)}%`,
      direction: ownerStats.expenseTrend >= 0 ? "up" : "down",
      positive: ownerStats.expenseTrend <= 0,
      variant: "orange",
      icon: <Wallet size={26} />,
    },
    {
      id: "profit",
      title: "Profit",
      period: periodLabel,
      value: money(ownerStats.profit),
      change: `${Math.abs(ownerStats.profitTrend)}%`,
      direction: ownerStats.profitTrend >= 0 ? "up" : "down",
      positive: ownerStats.profitTrend >= 0,
      variant: "green",
      icon: <PiggyBank size={26} />,
    },
  ];

  const revenueData: ChartPoint[] = ownerStats.monthlyRevenue.map((m) => ({
    label: m.label,
    value: m.amount,
  }));
  const revenueRawMax =
    revenueData.length > 0 ? Math.max(...revenueData.map((d) => d.value)) : 0;
  const revenueMax = Math.max(10000, Math.ceil(revenueRawMax / 10000) * 10000);
  const revenueYTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((revenueMax / 5) * (5 - i))
  );

  const growthData: ChartPoint[] = ownerStats.monthlyGrowth.map((g) => ({
    label: g.label,
    value: g.total,
  }));
  const growthRawMax =
    growthData.length > 0 ? Math.max(...growthData.map((d) => d.value)) : 0;
  const growthMax = Math.max(100, Math.ceil(growthRawMax / 100) * 100);
  const growthYTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((growthMax / 5) * (5 - i))
  );

  const yearOptions =
    ownerStats.availableYears.length > 0
      ? ownerStats.availableYears
      : [new Date().getFullYear()];

  const trendText = (v: number) => `${v >= 0 ? "+" : "-"}${Math.abs(v)}%`;

  const buildSections = (): ReportSection[] => [
    {
      title: `Summary (${periodLabel})`,
      headers: ["Metric", "Value", `Change ${compareLabel}`],
      rows: [
        ["Active Members", ownerStats.activeMembers, trendText(ownerStats.activeTrend)],
        ["New Members", ownerStats.newMembers, trendText(ownerStats.newMembersTrend)],
        ["Overdue Payments (PKR)", ownerStats.overdueAmount, trendText(ownerStats.overdueTrend)],
        ["Revenue Collected (PKR)", ownerStats.revenue, trendText(ownerStats.revenueTrend)],
        ["Total Expense (PKR)", ownerStats.totalExpense, trendText(ownerStats.expenseTrend)],
        ["Profit (PKR)", ownerStats.profit, trendText(ownerStats.profitTrend)],
      ],
    },
    {
      title: `Monthly Revenue Trend (${selectedYear})`,
      headers: ["Month", "Revenue (PKR)"],
      rows: revenueData.map((d) => [d.label, d.value]),
    },
    {
      title: `Member Growth Trend (${selectedYear})`,
      headers: ["Month", "Total Members"],
      rows: growthData.map((d) => [d.label, d.value]),
    },
    {
      title: "Inventory",
      headers: ["Item Name", "Category", "Quantity"],
      rows: ownerStats.recentAccessories.map((a) => [a.name, a.category, a.quantity]),
    },
    {
      title: "Memberships Expiring Soon (Next 7 Days)",
      headers: ["Member Name", "Membership Type", "Expiry Date", "Days Left"],
      rows: ownerStats.expiringMembers.map((m) => [m.name, m.plan, m.expiry, m.days_left]),
    },
    {
      title: "Staff",
      headers: ["Name", "Role", "Specialization", "Experience", "Status"],
      rows: ownerStats.recentStaff.map((s) => [
        s.name,
        s.role,
        s.specialization,
        s.experience,
        s.status,
      ]),
    },
  ];

  const handleRefresh = () => {
    if (loadingStats) return;
    setRefreshKey((k) => k + 1);
  };

  const handleExportExcel = () => {
    const lines: string[] = [
      escapeCsv("Gym Dashboard Report"),
      escapeCsv(`Generated: ${formatDate(new Date())} ${formatTime(new Date())}`),
      "",
    ];
    buildSections().forEach((section) => {
      lines.push(escapeCsv(section.title));
      lines.push(section.headers.map(escapeCsv).join(","));
      if (section.rows.length === 0) {
        lines.push(escapeCsv("No data available"));
      } else {
        section.rows.forEach((row) => lines.push(row.map(escapeCsv).join(",")));
      }
      lines.push("");
    });

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-report-${todayStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow pop-ups to export the PDF.");
      return;
    }

    const body = buildSections()
      .map((section) => {
        const head = section.headers
          .map((h) => `<th>${escapeHtml(h)}</th>`)
          .join("");
        const rows =
          section.rows.length === 0
            ? `<tr><td colspan="${section.headers.length}" class="empty">No data available</td></tr>`
            : section.rows
                .map(
                  (r) =>
                    `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
                )
                .join("");
        return `<h2>${escapeHtml(section.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join("");

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Dashboard Report ${todayStamp()}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  .empty { text-align: center; color: #777; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <h1>Gym Dashboard Report</h1>
  <div class="meta">Period: ${escapeHtml(periodLabel)} &middot; Generated: ${escapeHtml(
      formatDate(new Date())
    )} ${escapeHtml(formatTime(new Date()))}</div>
  ${body}
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div
      className="dashboard-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      <style>{ACTION_CSS}</style>

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

      <div className="dash-filter-bar">
        <div className="dash-filter-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`dash-filter-btn ${period === p.id ? "active" : ""}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="dash-filter-custom">
            <input
              type="date"
              className="dash-date-input"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (toDate && e.target.value > toDate) setToDate(e.target.value);
              }}
            />
            <span className="dash-filter-to">to</span>
            <input
              type="date"
              className="dash-date-input"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}

        <div style={actionsWrapStyle}>
          <button
            type="button"
            className="dash-action-btn"
            style={actionBtnStyle("#3b82f6", loadingStats)}
            onClick={handleRefresh}
            disabled={loadingStats}
          >
            <RefreshCw
              size={15}
              className={loadingStats ? "dash-spin" : undefined}
            />
            Refresh
          </button>
          <button
            type="button"
            className="dash-action-btn"
            style={actionBtnStyle("#22c55e", loadingStats)}
            onClick={handleExportExcel}
            disabled={loadingStats}
          >
            <FileText size={15} />
            Excel
          </button>
          <button
            type="button"
            className="dash-action-btn"
            style={actionBtnStyle("#ef4444", loadingStats)}
            onClick={handleExportPdf}
            disabled={loadingStats}
          >
            <Download size={15} />
            PDF
          </button>
        </div>
      </div>

      <div className="dash-stats dash-stats-6">
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
              <span className="dash-stat-vs">{compareLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid dash-grid-70-30">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <TrendingUp size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Monthly Revenue Trend</h2>
              <p>{selectedYear} — All 12 months</p>
            </div>

            <div className="dash-head-controls">
              <ChartSelect
                value={revenueChartType}
                onChange={setRevenueChartType}
              />
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
          </div>

          <ChartView
            data={revenueData}
            type={revenueChartType}
            max={revenueMax}
            ticks={revenueYTicks}
            formatAxis={formatTick}
            formatFull={formatPKR}
          />
        </div>

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

      <div className="dash-panel dash-panel-full">
        <div className="dash-panel-head">
          <div className="dash-panel-icon">
            <Users size={22} />
          </div>
          <div className="dash-panel-heading">
            <h2>Member Growth Trend</h2>
            <p>{selectedYear} — Total members at each month</p>
          </div>

          <div className="dash-head-controls">
            <ChartSelect
              value={growthChartType}
              onChange={setGrowthChartType}
            />
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
        </div>

        <ChartView
          data={growthData}
          type={growthChartType}
          max={growthMax}
          ticks={growthYTicks}
          formatAxis={(v) => v.toLocaleString("en-US")}
          formatFull={(v) => `${v.toLocaleString("en-US")} members`}
        />
      </div>

      <div className="dash-grid dash-grid-row2">
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
                      No memberships expiring in the next 7 days.
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

        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <Receipt size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Staff</h2>
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