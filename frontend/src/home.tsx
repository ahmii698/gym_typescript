import { Outlet } from "react-router-dom";
import Sidebar from "./frontdesk/component/sidebar";
import Header from "./frontdesk/component/header";
import Footer from "./frontdesk/component/footer";
import "./home.css";

const Home = () => {
  return (
    <div className="home-layout">
      <Sidebar />
      <div className="home-main">
        <Header />
        <div className="home-content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default Home;