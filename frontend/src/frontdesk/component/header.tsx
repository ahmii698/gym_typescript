import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, User, LogOut, Menu } from "lucide-react";
import "./header.css";

interface HeaderProps {
  notificationCount?: number;
  adminRole?: string;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  notificationCount = 3,
  adminRole = "Front Desk",
  onMenuClick,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Bahar click karne pe dropdown band ho jaye
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    setDropdownOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="fd-header">
      <div className="fd-header-left">
        {/* Hamburger (sirf mobile/tablet par dikhta hai) */}
        <button
          type="button"
          className="fd-menu-btn"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>
      </div>

      <div className="fd-header-right">
        <div className="fd-notification">
          <Bell size={20} className="fd-icon" />
          {notificationCount > 0 && (
            <span className="fd-notification-badge">{notificationCount}</span>
          )}
        </div>

        <div className="fd-datetime">
          <span className="fd-date">{currentDate}</span>
          <span className="fd-time">{currentTime}</span>
        </div>

        {/* Front Desk dropdown */}
        <div className="fd-admin-wrapper" ref={dropdownRef}>
          <div
            className="fd-admin"
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            <div className="fd-admin-avatar">
              <User size={18} />
            </div>
            <div className="fd-admin-info">
              <span className="fd-admin-name">{adminRole}</span>
            </div>
            <ChevronDown
              size={16}
              className={`fd-chevron${dropdownOpen ? " open" : ""}`}
            />
          </div>

          {dropdownOpen && (
            <div className="fd-dropdown">
              <button
                className="fd-dropdown-item fd-dropdown-logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;