import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./auth/login/login";
import AdminRegister from "./auth/admin/adminregister";
import FrontdeskRegister from "./auth/frontdesk/frontdeskregister";
import ForgotPass from "./auth/forgotpass/forgotpass";
import Home from "./home";
import Dashboard from "./frontdesk/pages/dashboard";
import AddMember from "./frontdesk/pages/add-member";
import Attendance from "./frontdesk/pages/attendance";
import FeeCollection from "./frontdesk/pages/fee-collection";
import Packages from "./frontdesk/pages/packages";
import Reports from "./frontdesk/pages/reports";
import Trainers from "./frontdesk/pages/trainers";
import Settings from "./frontdesk/pages/settings";
import AdminLayout from "./admin/layout/AdminLayout";
import AdminDashboard from "./admin/pages/Dashboard";
import Members from "./admin/pages/Members";
import CheckIns from "./admin/pages/CheckIns";
import Memberships from "./admin/pages/Memberships";
import Payments from "./admin/pages/Payments";
import AdminReports from "./admin/pages/Reports";
import AdminSettings from "./admin/pages/Settings";
import Accessories from "./admin/pages/accessories";
import DrinksBeverages from "./admin/pages/drinks&beverages";

// --- Amounts Page Import (Memberships ke neeche sidebar mein) ---
import Amounts from "./admin/pages/amounts";

// --- Amount Proof Page Import (I've Made the Payment ke baad wala page) ---
import AmountProof from "./admin/pages/amountproof";

// --- Payment Required Page Import (company block hone par PUBLIC page) ---
import PaymentRequired from "./admin/pages/PaymentRequired";

// --- Inventory History Page Import ---
import InvHistory from "./admin/pages/invhistory";

// --- Cash in Hand Page Import ---
import CashInHand from "./admin/pages/CashInHand";

// --- Credit Management Page Import ---
import CreditManagement from "./admin/pages/CreditManagement";

// --- Expense Pages Import ---
import ExpenseOverview from "./admin/pages/expense";
import FixedExpense from "./admin/pages/FixedExpense";
import ExtraExpense from "./admin/pages/ExtraExpense";
import Expenses from "./admin/pages/Expenses"; // Fixed + Extra + Salary tabs

// --- Employees Page Import ---
import Employees from "./admin/pages/employees";

// --- Super Admin Pages Import ---
import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/super-admin/dashboard";
import SuperAdminPayments from "./pages/super-admin/payments";
import SuperAdminReminder from "./pages/super-admin/reminder"; // <-- NEW (Reminders)
import SuperAdminMoneyChannel from "./pages/super-admin/moneychannel"; // <-- NEW (Money Channels)
import SuperAdminTrial from "./pages/super-admin/trial";
import SuperAdminCreate from "./pages/super-admin/create";

import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route path="/frontdesk/register" element={<FrontdeskRegister />} />
      <Route path="/forgot-password" element={<ForgotPass />} />

      {/* --- Payment Required (PUBLIC: koi auth guard nahi, token nahi hota) --- */}
      <Route path="/payment-required" element={<PaymentRequired />} />

      {/* --- Super Admin --- */}
      <Route path="/super-admin" element={<SuperAdminLogin />} />
      <Route path="/super-admin/login" element={<SuperAdminLogin />} />
      <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
      <Route path="/super-admin/payments" element={<SuperAdminPayments />} />
      <Route path="/super-admin/reminders" element={<SuperAdminReminder />} /> {/* <-- NEW */}
      <Route path="/super-admin/money-channels" element={<SuperAdminMoneyChannel />} /> {/* <-- NEW */}
      <Route path="/super-admin/trial" element={<SuperAdminTrial />} />
      <Route path="/super-admin/create" element={<SuperAdminCreate />} />

      <Route path="/frontdesk" element={<Home />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="add-member" element={<AddMember />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="fee-collection" element={<FeeCollection />} />
        <Route path="packages" element={<Packages />} />
        <Route path="drinks" element={<DrinksBeverages />} />
        <Route path="reports" element={<Reports />} />
        <Route path="trainers" element={<Trainers />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="checkins" element={<CheckIns />} />
        <Route path="memberships" element={<Memberships />} />

        {/* --- Amounts (Memberships ke neeche sidebar mein) --- */}
        <Route path="amounts" element={<Amounts />} />

        {/* --- Amount Proof (I've Made the Payment par click karne ke baad) --- */}
        <Route path="amount-proof" element={<AmountProof />} />

        <Route path="payments" element={<Payments />} />

        {/* --- Employees --- */}
        <Route path="employees" element={<Employees />} />

        {/* --- Expense Routes --- */}
        {/* Overview: sab kuch combined (Fixed + Extra + Profit/Loss) */}
        <Route path="expense" element={<ExpenseOverview />} />

        {/* Expenses: Fixed / Extra / Salary tabs wala naya page */}
        <Route path="expenses" element={<Expenses />} />

        {/* Individual Pages (purane links ke liye rehne diye) */}
        <Route path="finance/fixed" element={<FixedExpense />} />
        <Route path="finance/extra" element={<ExtraExpense />} />

        {/* --- Packages (Expense ke neeche sidebar mein) --- */}
        <Route path="packages" element={<Packages />} />

        {/* --- Inventory --- */}
        <Route path="inventory/accessories" element={<Accessories />} />
        <Route path="inventory/drinks" element={<DrinksBeverages />} />

        {/* --- Inventory History --- */}
        <Route path="inv-history" element={<InvHistory />} />

        {/* --- Cash in Hand --- */}
        <Route path="cash-in-hand" element={<CashInHand />} />

        {/* --- Credit Management --- */}
        <Route path="credit" element={<CreditManagement />} />

        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />

        {/* Galat ya missing link par black screen ki jagah dashboard */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      {/* Koi bhi unknown URL par login par wapas */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;