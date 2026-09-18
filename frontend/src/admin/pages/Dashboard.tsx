import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
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
  ChevronDown,
  TrendingUp,
} from "lucide-react";
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
  name: string;
  type: string;
  expiry: string;
  daysLeft: number;
}

interface Transaction {
  member: string;
  type: string;
  amount: number;
  date: string;
  status: "Paid" | "Pending";
}

interface RecentMembership {
  name: string;
  plan: string;
}

const STATS: StatCard[] = [
  {
    id: "active",
    title: "Active Members",
    period: "Right now",
    value: "1,240",
    change: "+6%",
    direction: "up",
    positive: true,
    variant: "green",
    icon: <Users size={26} />,
  },
  {
    id: "new-members",
    title: "New Members",
    period: "This Month",
    value: "34",
    change: "+18%",
    direction: "up",
    positive: true,
    variant: "red",
    icon: <UserPlus size={26} />,
  },
  {
    id: "overdue",
    title: "Overdue Payments",
    period: "This Month",
    value: "PKR 27,500",
    change: "-12%",
    direction: "down",
    positive: true,
    variant: "orange",
    icon: <Clock size={26} />,
  },
  {
    id: "revenue",
    title: "Revenue Collected",
    period: "This Month",
    value: "PKR 203,000",
    change: "+28%",
    direction: "up",
    positive: true,
    variant: "blue",
    icon: <DollarSign size={26} />,
  },
];

const EXPIRING: ExpiringMember[] = [
  { name: "Ali Raza", type: "Monthly", expiry: "30 Sep 2025", daysLeft: 3 },
  { name: "Sara Khan", type: "Monthly", expiry: "02 Oct 2025", daysLeft: 5 },
  { name: "Usman Tariq", type: "Quarterly", expiry: "04 Oct 2025", daysLeft: 7 },
  { name: "Ayesha Malik", type: "Monthly", expiry: "05 Oct 2025", daysLeft: 8 },
  { name: "Hamza Ali", type: "Monthly", expiry: "06 Oct 2025", daysLeft: 9 },
];

const TRANSACTIONS: Transaction[] = [
  { member: "Ali Raza", type: "Membership", amount: 5000, date: "Today", status: "Paid" },
  { member: "Sara Khan", type: "Renewal", amount: 8000, date: "Today", status: "Paid" },
  { member: "Usman Tariq", type: "Membership", amount: 12000, date: "Today", status: "Paid" },
  { member: "Ayesha Malik", type: "Renewal", amount: 5000, date: "Yesterday", status: "Paid" },
  { member: "Hamza Ali", type: "Membership", amount: 8000, date: "Yesterday", status: "Pending" },
];

const RECENT_MEMBERSHIPS: RecentMembership[] = [
  { name: "Bilal Ahmed", plan: "Monthly" },
  { name: "Fatima Noor", plan: "Quarterly" },
  { name: "Zain Abbas", plan: "Monthly" },
  { name: "Hina Shah", plan: "Yearly" },
  { name: "Omar Farooq", plan: "Monthly" },
];

type Period = "This Month" | "Last Month";

const REVENUE: Record<Period, { month: string; data: number[] }> = {
  "This Month": {
    month: "Sep",
    data: [
      38000, 44000, 50000, 60000, 68000, 60000, 52000, 60000, 70000, 72000,
      80000, 88000, 100000, 115000, 108000, 100000, 98000, 110000, 125000,
      133000, 128000, 122000, 130000, 142000, 150000, 165000, 182000, 195000,
      210000, 203000,
    ],
  },
  "Last Month": {
    month: "Aug",
    data: [
      30000, 36000, 42000, 48000, 55000, 62000, 58000, 64000, 72000, 78000,
      85000, 92000, 98000, 104000, 110000, 105000, 112000, 120000, 126000,
      132000, 138000, 134000, 142000, 150000, 158000, 166000, 172000, 180000,
      188000, 195000,
    ],
  },
};

type GrowthYear = "This Year" | "Last Year";

// Total members at each month (Jan → Dec)
const GROWTH: Record<GrowthYear, number[]> = {
  "This Year": [1220, 690, 890, 1010, 1150, 980, 1080, 1160, 1240, 1180, 1290, 1410],
  "Last Year": [640, 720, 690, 810, 760, 880, 940, 900, 1020, 980, 1100, 1180],
};

/* ------------------------------ Chart config ------------------------------ */

// Revenue line chart
const W = 600;
const H = 260;
const PAD_L = 62;
const PAD_R = 24;
const PAD_T = 14;
const PAD_B = 30;
const Y_MAX = 250000;
const DEFAULT_INDEX = 25;
const Y_TICKS = [0, 50000, 100000, 150000, 200000, 250000];
const X_TICK_INDEXES = [0, 4, 9, 14, 19, 24, 29];

// Member growth bar chart
const G_W = 1000;
const G_H = 280;
const G_PAD_L = 52;
const G_PAD_R = 16;
const G_PAD_T = 16;
const G_PAD_B = 32;
const G_Y_MAX = 1500;
const G_TICKS = [0, 300, 600, 900, 1200, 1500];

const formatTick = (v: number) => (v === 0 ? "PKR 0" : `PKR ${v / 1000}K`);
const formatPKR = (v: number) => `PKR ${v.toLocaleString("en-US")}`;
const formatCount = (v: number) => v.toLocaleString("en-US");

/* ------------------------------ Date helpers ------------------------------ */

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
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(new Date());
  const [period, setPeriod] = useState<Period>("This Month");
  const [activeIndex, setActiveIndex] = useState(DEFAULT_INDEX);

  const [growthYear, setGrowthYear] = useState<GrowthYear>("This Year");
  const [activeBar, setActiveBar] = useState<number | null>(null);

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

  /* ---- Revenue line chart ---- */
  const { month, data } = REVENUE[period];
  const stepX = (W - PAD_L - PAD_R) / (data.length - 1);
  const plotH = H - PAD_T - PAD_B;

  const getX = (i: number) => PAD_L + i * stepX;
  const getY = (v: number) => PAD_T + plotH - (v / Y_MAX) * plotH;

  const linePath = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(v)}`)
    .join(" ");
  const areaPath = `${linePath} L ${getX(data.length - 1)} ${PAD_T + plotH} L ${getX(0)} ${
    PAD_T + plotH
  } Z`;

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((svgX - PAD_L) / stepX);
    setActiveIndex(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const activeValue = data[activeIndex];
  const tooltipLeft = Math.min(88, Math.max(12, (getX(activeIndex) / W) * 100));
  const tooltipTop = (getY(activeValue) / H) * 100;

  /* ---- Member growth bar chart ---- */
  const growthData = GROWTH[growthYear];
  const growthYearNum =
    growthYear === "This Year" ? now.getFullYear() : now.getFullYear() - 1;
  const slotW = (G_W - G_PAD_L - G_PAD_R) / growthData.length;
  const barW = slotW * 0.55;
  const gBase = G_H - G_PAD_B;
  const gPlotH = gBase - G_PAD_T;

  const gY = (v: number) => G_PAD_T + gPlotH - (v / G_Y_MAX) * gPlotH;
  const barX = (i: number) => G_PAD_L + i * slotW + (slotW - barW) / 2;

  const barTooltipLeft =
    activeBar === null
      ? 0
      : Math.min(92, Math.max(8, ((G_PAD_L + activeBar * slotW + slotW / 2) / G_W) * 100));
  const barTooltipTop = activeBar === null ? 0 : (gY(growthData[activeBar]) / G_H) * 100;

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
          <p className="dash-subtitle">Here's what's happening at your gym today.</p>
        </div>

        <div className="dash-datetime">
          <div className="dash-datetime-text">
            <span className="dash-date">{formatDate(now)}</span>
            <span className="dash-time">{formatTime(now)}</span>
          </div>
          <Calendar size={22} strokeWidth={1.8} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="dash-stats">
        {STATS.map((s) => (
          <div key={s.id} className={`dash-stat-card ${s.variant}`}>
            <div className={`dash-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="dash-stat-info">
              <span className="dash-stat-title">{s.title}</span>
              <span className="dash-stat-period">{s.period}</span>
              <span className="dash-stat-value">{s.value}</span>
              <span className={`dash-stat-change ${s.positive ? "good" : "bad"}`}>
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

      {/* Row 1: monthly revenue trend (70%) + last 5 memberships (30%) */}
      <div className="dash-grid dash-grid-70-30">
        {/* Monthly revenue trend */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <TrendingUp size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Monthly Revenue Trend</h2>
            </div>

            <div className="dash-select-wrap">
              <select
                className="dash-select"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as Period);
                  setActiveIndex(DEFAULT_INDEX);
                }}
              >
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
              </select>
              <ChevronDown size={14} className="dash-select-icon" />
            </div>
          </div>

          <div className="dash-chart">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="dash-chart-svg"
              onMouseMove={handleMove}
              onMouseLeave={() => setActiveIndex(DEFAULT_INDEX)}
            >
              <defs>
                <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef233c" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ef233c" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid + Y labels */}
              {Y_TICKS.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={getY(t)}
                    y2={getY(t)}
                    className="chart-grid"
                  />
                  <text
                    x={PAD_L - 8}
                    y={getY(t) + 4}
                    textAnchor="end"
                    className="chart-label"
                  >
                    {formatTick(t)}
                  </text>
                </g>
              ))}

              {/* X labels */}
              {X_TICK_INDEXES.map((i) => (
                <text
                  key={i}
                  x={getX(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="chart-label"
                >
                  {`${i + 1} ${month}`}
                </text>
              ))}

              {/* Area + line */}
              <path d={areaPath} fill="url(#dashAreaGrad)" />
              <path d={linePath} className="chart-line" />

              {/* Active point */}
              <line
                x1={getX(activeIndex)}
                x2={getX(activeIndex)}
                y1={PAD_T}
                y2={PAD_T + plotH}
                className="chart-guide"
              />
              <circle
                cx={getX(activeIndex)}
                cy={getY(activeValue)}
                r={5}
                className="chart-dot"
              />
            </svg>

            <div
              className="dash-tooltip"
              style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
            >
              <strong>{formatPKR(activeValue)}</strong>
              <span>
                {activeIndex + 1} {month}
              </span>
            </div>
          </div>
        </div>

        {/* Last 5 memberships */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <CreditCard size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Last 5 Memberships</h2>
              <p>Recently purchased plans</p>
            </div>
            <button type="button" className="dash-pill-btn">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th className="right">Plan</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_MEMBERSHIPS.map((m) => (
                  <tr key={m.name}>
                    <td className="member-name">{m.name}</td>
                    <td className="right">
                      <span className="plan-badge">{m.plan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Member growth trend (full width) */}
      <div className="dash-panel dash-panel-full">
        <div className="dash-panel-head">
          <div className="dash-panel-icon">
            <Users size={22} />
          </div>
          <div className="dash-panel-heading">
            <h2>Member Growth Trend</h2>
          </div>

          <div className="dash-select-wrap">
            <select
              className="dash-select"
              value={growthYear}
              onChange={(e) => {
                setGrowthYear(e.target.value as GrowthYear);
                setActiveBar(null);
              }}
            >
              <option value="This Year">This Year</option>
              <option value="Last Year">Last Year</option>
            </select>
            <ChevronDown size={14} className="dash-select-icon" />
          </div>
        </div>

        <div className="dash-bar-scroll">
          <div className="dash-chart dash-bar-inner">
            <svg
              viewBox={`0 0 ${G_W} ${G_H}`}
              className={`dash-chart-svg dash-bar-svg ${
                activeBar !== null ? "has-active" : ""
              }`}
              onMouseLeave={() => setActiveBar(null)}
            >
              <defs>
                <linearGradient id="dashBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff2d4d" />
                  <stop offset="100%" stopColor="#d90429" />
                </linearGradient>
              </defs>

              {/* Grid + Y labels */}
              {G_TICKS.map((t) => (
                <g key={t}>
                  <line
                    x1={G_PAD_L}
                    x2={G_W - G_PAD_R}
                    y1={gY(t)}
                    y2={gY(t)}
                    className="chart-grid"
                  />
                  <text
                    x={G_PAD_L - 10}
                    y={gY(t) + 4}
                    textAnchor="end"
                    className="chart-label"
                  >
                    {formatCount(t)}
                  </text>
                </g>
              ))}

              {/* Bars + X labels */}
              {growthData.map((v, i) => (
                <g key={MONTHS[i]}>
                  <rect
                    x={barX(i)}
                    y={gY(v)}
                    width={barW}
                    height={gBase - gY(v)}
                    rx={3}
                    className={`bar-rect ${activeBar === i ? "active" : ""}`}
                  />
                  <text
                    x={G_PAD_L + i * slotW + slotW / 2}
                    y={G_H - 10}
                    textAnchor="middle"
                    className="chart-label"
                  >
                    {MONTHS[i]}
                  </text>
                  {/* Full-height hover area */}
                  <rect
                    x={G_PAD_L + i * slotW}
                    y={G_PAD_T}
                    width={slotW}
                    height={gPlotH + G_PAD_B}
                    className="bar-hit"
                    onMouseEnter={() => setActiveBar(i)}
                  />
                </g>
              ))}
            </svg>

            {activeBar !== null && (
              <div
                className="dash-tooltip"
                style={{ left: `${barTooltipLeft}%`, top: `${barTooltipTop}%` }}
              >
                <strong>{formatCount(growthData[activeBar])} members</strong>
                <span>
                  {MONTHS[activeBar]} {growthYearNum}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: memberships expiring soon + recent transactions */}
      <div className="dash-grid dash-grid-row2">
        {/* Memberships expiring soon */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <CalendarDays size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Memberships Expiring Soon</h2>
              <p>Next 7 days</p>
            </div>
            <button type="button" className="dash-pill-btn">
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
                {EXPIRING.map((m) => (
                  <tr key={m.name}>
                    <td className="member-name">{m.name}</td>
                    <td>{m.type}</td>
                    <td>{m.expiry}</td>
                    <td className="center">
                      <span className="days-badge">{m.daysLeft}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-icon">
              <Receipt size={22} />
            </div>
            <div className="dash-panel-heading">
              <h2>Recent Transactions</h2>
              <p>Latest payments received</p>
            </div>
            <button type="button" className="dash-pill-btn">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th className="right">Amount</th>
                  <th>Date</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {TRANSACTIONS.map((t, i) => (
                  <tr key={`${t.member}-${i}`}>
                    <td className="member-name">{t.member}</td>
                    <td>{t.type}</td>
                    <td className="right amount">{formatPKR(t.amount)}</td>
                    <td>{t.date}</td>
                    <td className="center">
                      <span
                        className={`status-badge ${
                          t.status === "Paid" ? "paid" : "pending"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;