import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Users,
  Footprints,
  Clock,
  Database,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import "./dashboard.css";

interface StatCard {
  id: string;
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  variant: "red" | "green" | "orange" | "redSolid";
}

interface Member {
  id: number;
  name: string;
  avatar: string;
  package: string;
  joinDate: string;
  status: string;
}

interface FeeDue {
  id: number;
  name: string;
  avatar: string;
  package: string;
  dueIn: string;
  amount: string;
}

const statCards: StatCard[] = [
  {
    id: "total",
    title: "Total Members",
    value: "248",
    trend: "12% from last month",
    trendUp: true,
    icon: <Users size={22} />,
    variant: "red",
  },
  {
    id: "active",
    title: "Active Members",
    value: "186",
    trend: "8% from last month",
    trendUp: true,
    icon: <Footprints size={22} />,
    variant: "green",
  },
  {
    id: "pending",
    title: "Pending Due (This Month)",
    value: "42",
    trend: "5% from last month",
    trendUp: false,
    icon: <Clock size={22} />,
    variant: "orange",
  },
  {
    id: "fees",
    title: "Fees Collected (This Month)",
    value: "PKR 320,450",
    trend: "15% from last month",
    trendUp: true,
    icon: <Database size={22} />,
    variant: "redSolid",
  },
];

const chartLabels = [
  "Aug 23",
  "Aug 24",
  "Aug 25",
  "Aug 26",
  "Aug 27",
  "Aug 28",
  "Aug 29",
  "Aug 30",
];

const totalMembersData = [150, 175, 178, 185, 195, 193, 205, 215];
const activeMembersData = [95, 120, 130, 140, 145, 150, 155, 160];

const recentMembers: Member[] = [
  {
    id: 1,
    name: "Ahmed Khan",
    avatar: "https://i.pravatar.cc/40?img=12",
    package: "Premium",
    joinDate: "Aug 25, 2025",
    status: "Active",
  },
  {
    id: 2,
    name: "Usman Ali",
    avatar: "https://i.pravatar.cc/40?img=13",
    package: "Standard",
    joinDate: "Aug 24, 2025",
    status: "Active",
  },
  {
    id: 3,
    name: "Ayesha Fatima",
    avatar: "https://i.pravatar.cc/40?img=5",
    package: "Premium",
    joinDate: "Aug 23, 2025",
    status: "Active",
  },
  {
    id: 4,
    name: "Bilal Hussain",
    avatar: "https://i.pravatar.cc/40?img=14",
    package: "Standard",
    joinDate: "Aug 22, 2025",
    status: "Active",
  },
  {
    id: 5,
    name: "Sara Khan",
    avatar: "https://i.pravatar.cc/40?img=9",
    package: "Basic",
    joinDate: "Aug 21, 2025",
    status: "Active",
  },
];

const upcomingDues: FeeDue[] = [
  {
    id: 1,
    name: "Usman Ali",
    avatar: "https://i.pravatar.cc/40?img=13",
    package: "Premium",
    dueIn: "2 days",
    amount: "PKR 5,000",
  },
  {
    id: 2,
    name: "Ayesha Fatima",
    avatar: "https://i.pravatar.cc/40?img=5",
    package: "Standard",
    dueIn: "3 days",
    amount: "PKR 12,000",
  },
  {
    id: 3,
    name: "Bilal Hussain",
    avatar: "https://i.pravatar.cc/40?img=14",
    package: "Basic",
    dueIn: "4 days",
    amount: "PKR 3,000",
  },
  {
    id: 4,
    name: "Sara Khan",
    avatar: "https://i.pravatar.cc/40?img=9",
    package: "Premium",
    dueIn: "5 days",
    amount: "PKR 5,000",
  },
];

// Helper to build smooth-ish SVG point string
const buildPoints = (
  data: number[],
  width: number,
  height: number,
  max: number
) => {
  const step = width / (data.length - 1);
  return data
    .map((val, i) => {
      const x = i * step;
      const y = height - (val / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

const CHART_WIDTH = 700;
const CHART_HEIGHT = 260;
const CHART_MAX = 300;
const BOTTOM_GAP = 24;

const Dashboard: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  /* make the page its own scroll container, same as the rest of the app */
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

  const totalPoints = buildPoints(
    totalMembersData,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_MAX
  );
  const activePoints = buildPoints(
    activeMembersData,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_MAX
  );
  const areaPoints = `0,${CHART_HEIGHT} ${totalPoints} ${CHART_WIDTH},${CHART_HEIGHT}`;

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
              Last 7 Days
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

          <div className="db-chart-wrap">
            <div className="db-chart-yaxis">
              {[300, 250, 200, 150, 100, 50, 0].map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
            <svg
              className="db-chart-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(239,35,60,0.35)" />
                  <stop offset="100%" stopColor="rgba(239,35,60,0)" />
                </linearGradient>
              </defs>
              <polygon points={areaPoints} fill="url(#areaFill)" />
              <polyline
                points={activePoints}
                fill="none"
                stroke="#9aa0ab"
                strokeWidth="2"
              />
              <polyline
                points={totalPoints}
                fill="none"
                stroke="#ef233c"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <div className="db-chart-xaxis">
            {chartLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div className="db-panel db-donut-panel">
          <div className="db-panel-header">
            <h3>Payment Status</h3>
          </div>
          <div className="db-donut-body">
            <div className="db-donut-chart">
              <div className="db-donut-center">
                <span className="db-donut-value">248</span>
                <span className="db-donut-label">Total Members</span>
              </div>
            </div>
            <div className="db-donut-legend">
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-green" />
                <div>
                  <p className="db-legend-title">Paid</p>
                  <p className="db-legend-sub">186 (75%)</p>
                </div>
              </div>
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-orange" />
                <div>
                  <p className="db-legend-title">Pending</p>
                  <p className="db-legend-sub">42 (17%)</p>
                </div>
              </div>
              <div className="db-donut-legend-item">
                <span className="db-legend-dot db-dot-red" />
                <div>
                  <p className="db-legend-title">Overdue</p>
                  <p className="db-legend-sub db-legend-sub-red">20 (8%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="db-bottom-row">
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
            <button className="db-view-all-btn">View All</button>
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
              {recentMembers.map((m, idx) => (
                <tr key={m.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <div className="db-member-cell">
                      <img src={m.avatar} alt={m.name} className="db-avatar" />
                      <span>{m.name}</span>
                    </div>
                  </td>
                  <td>{m.package}</td>
                  <td>{m.joinDate}</td>
                  <td>
                    <span className="db-badge db-badge-green">{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
            <button className="db-view-all-btn">View All</button>
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
              {upcomingDues.map((d, idx) => (
                <tr key={d.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <div className="db-member-cell">
                      <img src={d.avatar} alt={d.name} className="db-avatar" />
                      <span>{d.name}</span>
                    </div>
                  </td>
                  <td>{d.package}</td>
                  <td>{d.dueIn}</td>
                  <td>
                    <span className="db-badge db-badge-red">{d.amount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
            <span className="db-summary-trend">↑ 15%</span>
          </div>
          <p className="db-summary-trend-sub">vs last month</p>

          <h2 className="db-summary-total">PKR 320,450</h2>
          <p className="db-summary-total-label">Total Collected</p>

          <div className="db-summary-breakdown">
            <div className="db-summary-row">
              <span>Cash</span>
              <span className="db-summary-amount">PKR 120,450</span>
              <span className="db-summary-percent">37%</span>
            </div>
            <div className="db-summary-row">
              <span>Bank Transfer</span>
              <span className="db-summary-amount">PKR 150,000</span>
              <span className="db-summary-percent">47%</span>
            </div>
            <div className="db-summary-row">
              <span>JazzCash / Easypaisa</span>
              <span className="db-summary-amount">PKR 50,000</span>
              <span className="db-summary-percent">16%</span>
            </div>
          </div>

          <div className="db-summary-progress">
            <div className="db-summary-progress-fill" style={{ width: "37%" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;