import { Navigate, useNavigate } from "react-router-dom";
import { API_URL } from "../../../config";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");
  const user = JSON.parse(localStorage.getItem("sa_user") || "null");

  if (!token) {
    return <Navigate to="/super-admin" replace />;
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/super-admin/logout`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
    } finally {
      localStorage.removeItem("sa_token");
      localStorage.removeItem("sa_user");
      navigate("/super-admin");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0d", color: "#fff", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Super Admin Dashboard</h1>
        <button onClick={logout} style={{ padding: "8px 16px", borderRadius: 8 }}>Logout</button>
      </div>
      <p style={{ marginTop: 12 }}>Welcome, {user?.name}</p>
    </div>
  );
} 