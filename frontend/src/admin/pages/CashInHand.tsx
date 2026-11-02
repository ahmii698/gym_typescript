import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../../config";
import "./CashInHand.css";

/* ---------- Types ---------- */
interface CashEntry {
  id: number;
  type: "add" | "withdraw";
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  note: string | null;
  user_name: string | null;
  created_at: string;
}

type Msg = { kind: "error" | "success"; text: string } | null;

/* ---------- Helpers ---------- */
const rs = (n: string | number | null | undefined) =>
  `Rs. ${(Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} • ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
};

// "05" -> "5", "0.5" waise hi rehta hai
const stripLeadingZeros = (v: string) => v.replace(/^0+(?=\d)/, "");

/* ---------- Icons (inline SVG, koi extra package nahi) ---------- */
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const BanknoteIcon = () => (
  <Icon>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
);
const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </Icon>
);

/* ---------- Page ---------- */
export default function CashInHand() {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/cash-in-hand`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to load cash in hand");
      const data = await res.json();
      setBalance(Number(data?.balance) || 0);
      setEntries(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setLoadError("Cash in hand load nahi ho saka. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setMsg(null);

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setMsg({ kind: "error", text: "Sahi amount likhein." });
      return;
    }
    if (type === "withdraw" && num > balance) {
      setMsg({ kind: "error", text: "Cash in hand se zyada withdraw nahi ho sakta." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/cash-in-hand`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ type, amount: num, note: note.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMsg({ kind: "error", text: data?.message ?? "Update fail hua." });
        return;
      }

      setMsg({
        kind: "success",
        text: type === "add" ? "Cash add ho gaya!" : "Cash minus ho gaya!",
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      console.error(err);
      setMsg({ kind: "error", text: "Kuch masla ho gaya, dobara try karein." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="cih-loading">Loading...</div>;
  }

  return (
    <div className="cih-page">
      {/* Header */}
      <header className="cih-header">
        <div className="cih-header-icon">
          <BanknoteIcon />
        </div>
        <div>
          <h1 className="cih-title">Cash in Hand</h1>
          <p className="cih-subtitle">
            Cash add / withdraw karein. Inventory khareedte waqt isi cash se payment hogi.
          </p>
        </div>
      </header>

      {loadError && <p className="cih-msg error">{loadError}</p>}

      {/* Balance card */}
      <section className="cih-card">
        <span className="cih-label">Admin Cash in Hand (manual)</span>
        <p className="cih-balance">{rs(balance)}</p>
        <p className="cih-hint">
          Inventory add karte waqt itna hi cash use ho sakta hai, baqi amount vendor ke credit me jayegi.
        </p>
      </section>

      {/* Update form (admin only) */}
      {isAdmin && (
        <form className="cih-card cih-form" onSubmit={handleSubmit}>
          <h3 className="cih-card-title">Cash Update Karo</h3>

          <div className="cih-toggle">
            <button
              type="button"
              className={`cih-toggle-btn ${type === "add" ? "add-active" : ""}`}
              onClick={() => setType("add")}
            >
              <PlusIcon /> Add
            </button>
            <button
              type="button"
              className={`cih-toggle-btn ${type === "withdraw" ? "withdraw-active" : ""}`}
              onClick={() => setType("withdraw")}
            >
              <MinusIcon /> Withdraw
            </button>
          </div>

          <input
            className="cih-input"
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount (Rs.) e.g. 50000"
            value={amount}
            onChange={(e) => setAmount(stripLeadingZeros(e.target.value))}
            disabled={saving}
          />
          <input
            className="cih-input"
            type="text"
            placeholder="Note (optional)"
            maxLength={255}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
          />

          {msg && <p className={`cih-msg ${msg.kind}`}>{msg.text}</p>}

          <button type="submit" className="cih-btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      )}

      {/* History */}
      <section className="cih-card cih-history">
        <div className="cih-history-head">
          <ClockIcon />
          <h3 className="cih-card-title">History</h3>
        </div>

        {entries.length === 0 ? (
          <p className="cih-empty">Abhi tak koi history nahi.</p>
        ) : (
          <div className="cih-table-wrap">
            <table className="cih-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Pehle</th>
                  <th>Baad me</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((en) => (
                  <tr key={en.id}>
                    <td className="muted">{formatDateTime(en.created_at)}</td>
                    <td>
                      <span className={`cih-tag ${en.type}`}>
                        {en.type === "add" ? "Added" : "Withdrawn"}
                      </span>
                    </td>
                    <td className={en.type === "add" ? "pos" : "neg"}>
                      {en.type === "add" ? "+" : "-"}
                      {rs(en.amount)}
                    </td>
                    <td className="muted">{rs(en.balance_before)}</td>
                    <td className="strong">{rs(en.balance_after)}</td>
                    <td className="muted">{en.note || "-"}</td>
                    <td className="muted">
                      <span className="cih-by">
                        <UserIcon /> {en.user_name || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}