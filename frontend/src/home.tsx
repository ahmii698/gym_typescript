import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./frontdesk/component/sidebar";
import Header from "./frontdesk/component/header";

import "./home.css";

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="home-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="home-main">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="home-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Home;