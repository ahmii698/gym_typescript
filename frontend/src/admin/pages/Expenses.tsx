import { useState } from "react";
import { Receipt, CircleDollarSign, Banknote } from "lucide-react";
import FixedExpense from "./FixedExpense";
import ExtraExpense from "./ExtraExpense";
import Salary from "./salary";
import "./expenses.css";

type Tab = "fixed" | "extra" | "salary";

const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
  { key: "fixed", label: "Fixed Expense", icon: Receipt },
  { key: "extra", label: "Extra Expense", icon: CircleDollarSign },
  { key: "salary", label: "Salary", icon: Banknote },
];

const Expenses = () => {
  const [active, setActive] = useState<Tab>("fixed");

  return (
    <div className="expenses-page">
      <div className="expenses-tabs-wrap">
        <div className="expenses-tabs" role="tablist">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              className={`expenses-tab ${active === key ? "active" : ""}`}
              onClick={() => setActive(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {active === "fixed" && <FixedExpense />}
      {active === "extra" && <ExtraExpense />}
      {active === "salary" && <Salary />}
    </div>
  );
};

export default Expenses;