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
import Expenses from "./admin/pages/Expenses";
import AdminReports from "./admin/pages/Reports";
import AdminSettings from "./admin/pages/Settings";
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
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}

export default App;