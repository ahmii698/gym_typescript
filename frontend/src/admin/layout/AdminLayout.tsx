import { Outlet } from "react-router-dom";
import Sidebar from "../component/sidebar";
import Header from "../component/header";
import "./AdminLayout.css";

const AdminLayout = () => {
  return (
    <div className="admin-layout-wrapper">
      <Sidebar />
      <div className="admin-layout-main">
        <Header />
        <div className="admin-layout-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;