import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserPlus,
  CalendarCheck,
  Layers,
  Package,
  CupSoda,
  Users,
  LogOut,
  X,
} from "lucide-react";
import "./sidebar.css";

// Images import
import logo from "../../assets/logo.png";
import gymBanner from "../../assets/gym-banner1.png";

const navItems = [
  { to: "/frontdesk/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/frontdesk/add-member", label: "Add Member", icon: UserPlus },
  { to: "/frontdesk/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/frontdesk/fee-collection", label: "Fee Collection", icon: Layers },
  { to: "/frontdesk/packages", label: "Packages", icon: Package },
  { to: "/frontdesk/drinks", label: "Drinks & Beverages", icon: CupSoda },
  { to: "/frontdesk/trainers", label: "Trainers", icon: Users },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className={`fd-sidebar-backdrop${isOpen ? " show" : ""}`}
        onClick={onClose}
      />

      <aside className={`fd-sidebar${isOpen ? " open" : ""}`}>
        {/* Close button (mobile only) */}
        <button
          type="button"
          className="fd-sidebar-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="fd-sidebar-logo">
          <img src={logo} alt="FITZONE Logo" className="fd-logo-img" />
        </div>

        {/* Nav */}
        <nav className="fd-sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `fd-sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Icon size={19} strokeWidth={2} className="fd-sidebar-icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Banner */}
        <div
          className="fd-sidebar-banner"
          style={{ backgroundImage: `url(${gymBanner})` }}
        >
          <div className="fd-banner-overlay" />
          <p className="fd-banner-text">
            <span className="fd-banner-italic">YOUR</span>
            <br />
            FITNESS
            <br />
            <span className="fd-banner-italic">OUR</span>
            <br />
            <span className="fd-banner-accent">PRIORITY</span>
          </p>
        </div>

        {/* User footer */}
        <div className="fd-sidebar-footer">
          <div className="fd-footer-user">
            <div className="fd-footer-avatar">
              <Users size={16} />
              <span className="fd-footer-status-dot" />
            </div>
            <div className="fd-footer-info">
            
              <span className="fd-footer-role">Front Desk</span>
            </div>
          </div>
          <button
            className="fd-footer-logout"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;