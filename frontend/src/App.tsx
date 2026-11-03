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

import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route path="/frontdesk/register" element={<FrontdeskRegister />} />
      <Route path="/forgot-password" element={<ForgotPass />} />

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
      </Route>
    </Routes>
  );
}

export default App;