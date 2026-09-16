import React from "react";
import "./footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <p>© {new Date().getFullYear()} FitZone Gym Management System. All rights reserved.</p>
    </footer>
  );
};

export default Footer;