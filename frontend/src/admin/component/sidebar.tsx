import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Package,
  Boxes,            // Packages
  ShoppingBag,
  CupSoda,
  ChevronDown,
  Users,
  CalendarCheck,
  IdCard,
  Coins,            // Amounts
  UserPlus,
  UserCog,          // Employees
  Wallet,           // Expense group icon
  Receipt,          // Expenses (combined page)
  PieChart,         // Expense Overview
  Banknote,         // Cash in Hand
  CreditCard,       // Credit Management
  ShieldCheck,      // Create > Admin
  History,          // Inventory History
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

// --- Inventory History (Inventory ke neeche) ---
const invHistoryItem = {
  to: "/admin/inv-history",
  label: "Inventory History",
  icon: History,
};

// --- Cash in Hand (Inventory History ke neeche) ---
const cashItem = {
  to: "/admin/cash-in-hand",
  label: "Cash in Hand",
  icon: Banknote,
};

// --- Credit Management (Cash in Hand ke neeche) ---
const creditItem = {
  to: "/admin/credit",
  label: "Credit Management",
  icon: CreditCard,
};

// --- Expense Menu Items ---
const expenseItems = [
  { to: "/admin/expense", label: "Expense Overview", icon: PieChart },
  { to: "/admin/expenses", label: "Expenses", icon: Receipt },
];

// --- Packages (Expense ke neeche) ---
const packagesItem = {
  to: "/admin/packages",
  label: "Packages",
  icon: Boxes,
};

// --- Memberships ke baad Amounts, phir Employees ---
const bottomItems = [
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/checkins", label: "Check-ins", icon: CalendarCheck },
  { to: "/admin/memberships", label: "Memberships", icon: IdCard },
  { to: "/admin/amounts", label: "Amounts", icon: Coins },
  { to: "/admin/employees", label: "Employees", icon: UserCog },
];

// --- Create Menu Items (sirf Admin; Front Desk ab Employees > Front Desk tab mein hai) ---
const createItems = [
  { to: "/admin/register", label: "Admin", icon: ShieldCheck },
];

const Sidebar = () => {
  const { pathname } = useLocation();

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Inventory States
  const inInventory = pathname.startsWith("/admin/inventory");
  const [inventoryOpen, setInventoryOpen] = useState(inInventory);

  // --- Expense States (Overview + Expenses) ---
  const inExpense =
    pathname.startsWith("/admin/expense") ||
    pathname.startsWith("/admin/finance");
  const [expenseOpen, setExpenseOpen] = useState(inExpense);

  // --- Create States (sirf Admin) ---
  const inCreate = pathname.startsWith("/admin/register");
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
      // Employees ke andar ke pages (add trainer etc.) par bhi active rahe
      end={to !== "/admin/employees"}
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

          {/* --- Inventory History (Inventory ke neeche) --- */}
          {renderLink(invHistoryItem)}

          {/* --- Cash in Hand (Inventory History ke neeche) --- */}
          {renderLink(cashItem)}

          {/* --- Credit Management (Cash in Hand ke neeche) --- */}
          {renderLink(creditItem)}

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
                  end
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

          {/* --- Packages (Expense ke neeche) --- */}
          {renderLink(packagesItem)}

          {/* Members, Check-ins, Memberships, Amounts, Employees */}
          {bottomItems.map(renderLink)}

          {/* --- Create Group (sirf Admin) --- */}
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