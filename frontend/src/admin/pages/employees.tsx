import { useState } from "react";
import { Dumbbell, Headset, Briefcase } from "lucide-react";
import Trainers from "../../frontdesk/pages/trainers";
import RegisterFrontdesk from "../../auth/frontdesk/frontdeskregister";
import Staff from "./staff"; // NEW: staff.tsx lives in the same folder as this file
import "./employees.css";

type Tab = "trainers" | "frontdesk" | "staff";

const tabs: { key: Tab; label: string; icon: typeof Dumbbell }[] = [
  { key: "trainers", label: "Trainers", icon: Dumbbell },
  { key: "frontdesk", label: "Front Desk", icon: Headset },
  { key: "staff", label: "Staff", icon: Briefcase },
];

const Employees = () => {
  const [active, setActive] = useState<Tab>("trainers");

  return (
    <div className="employees-page">
      <div className="employees-tabs-wrap">
        <div className="employees-tabs" role="tablist">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              className={`employees-tab ${active === key ? "active" : ""}`}
              onClick={() => setActive(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {active === "trainers" && <Trainers />}

      {active === "frontdesk" && <RegisterFrontdesk />}

      {/* NEW: the Staff tab now renders the real Staff page */}
      {active === "staff" && <Staff />}
    </div>
  );
};

export default Employees;