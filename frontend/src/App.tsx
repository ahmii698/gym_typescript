import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./home";
import Dashboard from "./frontdesk/pages/dashboard";
import AddMember from "./frontdesk/pages/add-member";
import Attendance from "./frontdesk/pages/attendance";
import FeeCollection from "./frontdesk/pages/fee-collection";
import Packages from "./frontdesk/pages/packages";
import Reports from "./frontdesk/pages/reports";
import Trainers from "./frontdesk/pages/trainers";
import Settings from "./frontdesk/pages/settings";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/frontdesk/dashboard" replace />} />

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
    </Routes>
  );
}

export default App;