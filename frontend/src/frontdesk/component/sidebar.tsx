import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  UserPlus,
  CalendarCheck,
  Layers,
  Package,
  BarChart3,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import "./sidebar.css";

const navItems = [
  { to: "/frontdesk/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/frontdesk/add-member", label: "Add Member", icon: UserPlus },
  { to: "/frontdesk/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/frontdesk/fee-collection", label: "Fee Collection", icon: Layers },
  { to: "/frontdesk/packages", label: "Packages", icon: Package },
  { to: "/frontdesk/reports", label: "Reports", icon: BarChart3 },
  { to: "/frontdesk/trainers", label: "Trainers", icon: Users },
  { to: "/frontdesk/settings", label: "Settings", icon: Settings },
];

const Sidebar: React.FC = () => {
  const handleLogout = () => {
    // apna logout logic yahan lagao
    console.log("Logout clicked");
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 12h2M4 8v8M6 6v12M9 10v4M15 10v4M18 6v12M20 8v8M22 12h-2M9 12h6"
              stroke="#e11d2e"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="logo-text">
          <span className="logo-title">
            FIT<span className="logo-title-accent">ZONE</span>
          </span>
          <span className="logo-subtitle">GYM MANAGEMENT SYSTEM</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <Icon size={19} strokeWidth={2} className="sidebar-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Banner */}
      <div className="sidebar-banner">
        <div className="banner-overlay" />
        <p className="banner-text">
          <span className="banner-italic">YOUR</span>
          <br />
          FITNESS
          <br />
          <span className="banner-italic">OUR</span>
          <br />
          <span className="banner-accent">PRIORITY</span>
        </p>
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="footer-user">
          <div className="footer-avatar">
            <Users size={16} />
            <span className="footer-status-dot" />
          </div>
          <div className="footer-info">
            <span className="footer-name">Ahmed Khan</span>
            <span className="footer-role">Front Desk</span>
          </div>
        </div>
        <button className="footer-logout" onClick={handleLogout} aria-label="Logout">
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;