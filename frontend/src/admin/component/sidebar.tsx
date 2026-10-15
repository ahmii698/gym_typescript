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
  ShieldCheck,      // Create > Admin
  Headset,          // Create > Front Desk
  Menu,
  X,
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
];

// --- Create Menu Items (Admin / Front Desk) ---
const createItems = [
  { to: "/admin/register", label: "Admin", icon: ShieldCheck },
  { to: "/frontdesk/register", label: "Front Desk", icon: Headset },
];

const Sidebar = () => {
  const { pathname } = useLocation();

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Inventory States
  const inInventory = pathname.startsWith("/admin/inventory");
  const [inventoryOpen, setInventoryOpen] = useState(inInventory);

  // --- Expense States (Finance + Overview) ---
  const inExpense =
    pathname.startsWith("/admin/expense") ||
    pathname.startsWith("/admin/finance");
  const [expenseOpen, setExpenseOpen] = useState(inExpense);

  // --- Create States (Admin + Front Desk) ---
  const inCreate =
    pathname.startsWith("/admin/register") ||
    pathname.startsWith("/frontdesk/register");
  const [createOpen, setCreateOpen] = useState(inCreate);

  // Auto-open groups
  useEffect(() => {
    if (inInventory) setInventoryOpen(true);
    if (inExpense) setExpenseOpen(true);
    if (inCreate) setCreateOpen(true);
  }, [inInventory, inExpense, inCreate]);

  // Close the drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape + lock body scroll while the drawer is open
  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

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
    <>
      {/* Hamburger (mobile only) */}
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <Menu size={22} />
      </button>

      {/* Backdrop (mobile only) */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar-wrapper ${mobileOpen ? "open" : ""}`}>
        {/* Close button (mobile only) */}
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

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

          {/* --- Create Group (Admin / Front Desk) --- */}
          <button
            type="button"
            className={`sidebar-nav-item sidebar-group-btn ${
              inCreate ? "has-active-child" : ""
            }`}
            onClick={() => setCreateOpen((o) => !o)}
            aria-expanded={createOpen}
          >
            <UserPlus size={18} className="sidebar-nav-icon" />
            <span>Create</span>
            <ChevronDown
              size={16}
              className={`sidebar-chevron ${createOpen ? "open" : ""}`}
            />
          </button>

          {createOpen && (
            <div className="sidebar-submenu">
              {createItems.map(({ to, label, icon: Icon }) => (
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
    </>
  );
};

export default Sidebar;