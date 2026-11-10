import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LuLayoutDashboard,
  LuWallet,
  LuBell,
  LuLandmark,
  LuFlaskConical,
  LuUserPlus,
  LuLogOut,
  LuMenu,
  LuX,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import "./sidebar.css";

type Props = {
  onLogout: () => void;
};

type LinkItem = {
  to: string;
  label: string;
  icon: IconType;
};

// Add or change links here as new pages get built
const LINKS: LinkItem[] = [
  { to: "/super-admin/dashboard", label: "Dashboard", icon: LuLayoutDashboard },
  { to: "/super-admin/payments", label: "Payments", icon: LuWallet },
  { to: "/super-admin/reminders", label: "Reminders", icon: LuBell },
  { to: "/super-admin/money-channels", label: "Money Channels", icon: LuLandmark },
  { to: "/super-admin/trial", label: "Trial Users", icon: LuFlaskConical },
  { to: "/super-admin/create", label: "Create Admin", icon: LuUserPlus },
];

export default function Sidebar({ onLogout }: Props) {
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      setOpen(false);
      onLogout();
    }
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="sas-topbar">
        <button
          className="sas-toggle"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <LuMenu size={22} />
        </button>
        <span className="sas-topbar-title">Fusix Tech</span>
      </div>

      {open && <div className="sas-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sas-sidebar ${open ? "sas-open" : ""}`}>
        {/* Brand: logo in the middle, name below */}
        <div className="sas-brand">
          <button
            className="sas-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <LuX size={20} />
          </button>
          <img src="/logo_fus.png" alt="Fusix Tech" className="sas-brand-img" />
          <div className="sas-brand-name">Fusix Tech</div>
        </div>

        {/* Links */}
        <nav className="sas-nav">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `sas-link ${isActive ? "sas-link-active" : ""}`
                }
              >
                <Icon className="sas-icon" size={20} />
                <span className="sas-label">{l.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <button className="sas-logout" onClick={handleLogout}>
          <LuLogOut className="sas-logout-icon" size={20} />
          <span className="sas-label">Logout</span>
        </button>

        <div className="sas-footer">© Fusix Tech</div>
      </aside>
    </>
  );
}