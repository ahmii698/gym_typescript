import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  LogOut,
} from "lucide-react";
import "./header.css";

const Header = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    // TODO: replace with actual logout logic (clear auth token, redirect etc.)
    console.log("Logging out...");
    navigate("/login");
  };

  return (
    <header className="admin-header-wrapper">
      <div className="admin-header-left">
       
      </div>

      <div className="admin-header-right">
        <div className="admin-header-profile" ref={dropdownRef}>
          <button
            className="admin-header-profile-btn"
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            <div className="admin-header-avatar">
              <User size={18} />
            </div>
            <div className="admin-header-profile-info">
              <span className="admin-header-profile-name">Owner</span>
              <span className="admin-header-profile-role">Gym Owner</span>
            </div>
            <ChevronDown
              size={16}
              className={`admin-header-chevron ${dropdownOpen ? "open" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="admin-header-dropdown">
              <button
                className="admin-header-dropdown-item danger"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;