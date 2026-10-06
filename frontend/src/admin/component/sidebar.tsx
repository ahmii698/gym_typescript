import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Package,
  ShoppingBag,
  CupSoda,
  ChevronDown,
  Users,
  CalendarCheck,
  IdCard,
  UserPlus,
  Wallet,           // Expense group icon
  Receipt,          // Fixed Expense
  CircleDollarSign, // Extra Expense
} from "lucide-react";
import logoImg from "../../assets/logo.png";
import bannerImg from "../../assets/gym-banner1.png";
import "./sidebar.css";

const topItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: Home },
];

const inventoryItems = [
  { to: "/admin/inventory/accessories", label: "Accessories", icon: ShoppingBag },
  { to: "/admin/inventory/drinks", label: "Drinks & Beverages", icon: CupSoda },
];

// --- Expense Menu Items ---
const expenseItems = [
  { to: "/admin/expense", label: "Expense Overview", icon: Wallet },
  { to: "/admin/finance/fixed", label: "Fixed Expense", icon: Receipt },
  { to: "/admin/finance/extra", label: "Extra Expense", icon: CircleDollarSign },
];

const bottomItems = [
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/checkins", label: "Check-ins", icon: CalendarCheck },
  { to: "/admin/memberships", label: "Memberships", icon: IdCard },
  { to: "/admin/register", label: "Create Admin", icon: UserPlus },
];

const Sidebar = () => {
  const { pathname } = useLocation();

  // Inventory States
  const inInventory = pathname.startsWith("/admin/inventory");
  const [inventoryOpen, setInventoryOpen] = useState(inInventory);

  // --- Expense States (Finance + Overview) ---
  const inExpense =
    pathname.startsWith("/admin/expense") ||
    pathname.startsWith("/admin/finance");
  const [expenseOpen, setExpenseOpen] = useState(inExpense);

  // Auto-open groups
  useEffect(() => {
    if (inInventory) setInventoryOpen(true);
    if (inExpense) setExpenseOpen(true);
  }, [inInventory, inExpense]);

  const renderLink = ({
    to,
    label,
    icon: Icon,
  }: {
    to: string;
    label: string;
    icon: typeof Home;
  }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? "active" : ""}`
      }
    >
      <Icon size={18} className="sidebar-nav-icon" />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar-wrapper">
      <div className="sidebar-logo">
        <img src={logoImg} alt="FitZone Logo" />
      </div>

      <nav className="sidebar-nav">
        {topItems.map(renderLink)}

        {/* Inventory group */}
        <button
          type="button"
          className={`sidebar-nav-item sidebar-group-btn ${
            inInventory ? "has-active-child" : ""
          }`}
          onClick={() => setInventoryOpen((o) => !o)}
          aria-expanded={inventoryOpen}
        >
          <Package size={18} className="sidebar-nav-icon" />
          <span>Inventory</span>
          <ChevronDown
            size={16}
            className={`sidebar-chevron ${inventoryOpen ? "open" : ""}`}
          />
        </button>

        {inventoryOpen && (
          <div className="sidebar-submenu">
            {inventoryItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `sidebar-nav-item sidebar-sub-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={16} className="sidebar-nav-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* --- Expense Group --- */}
        <button
          type="button"
          className={`sidebar-nav-item sidebar-group-btn ${
            inExpense ? "has-active-child" : ""
          }`}
          onClick={() => setExpenseOpen((o) => !o)}
          aria-expanded={expenseOpen}
        >
          <Wallet size={18} className="sidebar-nav-icon" />
          <span>Expense</span>
          <ChevronDown
            size={16}
            className={`sidebar-chevron ${expenseOpen ? "open" : ""}`}
          />
        </button>

        {expenseOpen && (
          <div className="sidebar-submenu">
            {expenseItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `sidebar-nav-item sidebar-sub-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={16} className="sidebar-nav-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {bottomItems.map(renderLink)}
      </nav>

      <div className="sidebar-promo">
        <div
          className="sidebar-promo-bg"
          style={{ backgroundImage: `url(${bannerImg})` }}
        />
        <div className="sidebar-promo-overlay" />
        <div className="sidebar-promo-content">
          <p className="sidebar-promo-text">
            STRONGER
            <br />
            HEALTHIER
            <br />
            HAPPIER
          </p>
          <span className="sidebar-promo-underline" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;