import React from "react";
import { Bell, ChevronDown, User } from "lucide-react";
import "./header.css";

interface HeaderProps {
  notificationCount?: number;
  adminName?: string;
  adminRole?: string;
}

const Header: React.FC<HeaderProps> = ({
  notificationCount = 3,
  adminName = "Admin",
  adminRole = "Front Desk",
}) => {
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

  return (
    <header className="fd-header">
      <div className="fd-header-left" />

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

        <div className="fd-admin">
          <div className="fd-admin-avatar">
            <User size={18} />
          </div>
          <div className="fd-admin-info">
            <span className="fd-admin-name">{adminName}</span>
            <span className="fd-admin-role">{adminRole}</span>
          </div>
          <ChevronDown size={16} className="fd-chevron" />
        </div>
      </div>
    </header>
  );
};

export default Header;