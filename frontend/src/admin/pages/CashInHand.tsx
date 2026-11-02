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

// "05" -> "5", "0.5" stays as is
const stripLeadingZeros = (v: string) => v.replace(/^0+(?=\d)/, "");

// Local date (YYYY-MM-DD) used for export file names
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Escape text before putting it into export HTML
const escapeHtml = (v: string | number): string =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ---------- Header action buttons (inline styles) ---------- */
const actionBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
};

const refreshBtnStyle: React.CSSProperties = { ...actionBtnBase, background: "#3b82f6" };
const excelBtnStyle: React.CSSProperties = { ...actionBtnBase, background: "#22c55e" };
const pdfBtnStyle: React.CSSProperties = { ...actionBtnBase, background: "#ef4444" };

/* ---------- Icons (inline SVG, no extra package) ---------- */
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
const RefreshIcon = () => (
  <Icon>
    <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
  </Icon>
);
const SheetIcon = () => (
  <Icon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M4 9h16M4 15h16M10 3v18" />
  </Icon>
);
const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14" />
  </Icon>
);

/* ---------- Page ---------- */
export default function CashInHand() {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      setLoadError("Could not load cash in hand. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Excel export (no extra library): downloads an .xls file built from an HTML table
  const handleExportExcel = () => {
    const rows = entries
      .map(
        (en) =>
          `<tr><td>${escapeHtml(formatDateTime(en.created_at))}</td><td>${
            en.type === "add" ? "Added" : "Withdrawn"
          }</td><td>${en.type === "add" ? "" : "-"}${Number(en.amount) || 0}</td><td>${
            Number(en.balance_before) || 0
          }</td><td>${Number(en.balance_after) || 0}</td><td>${escapeHtml(
            en.note || "-"
          )}</td><td>${escapeHtml(en.user_name || "-")}</td></tr>`
      )
      .join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>Date &amp; Time</th><th>Type</th><th>Amount (Rs)</th><th>Before (Rs)</th><th>After (Rs)</th><th>Note</th><th>By</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-in-hand-${todayISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF export (no extra library): opens the print dialog, choose "Save as PDF"
  const handleExportPdf = () => {
    const rows = entries
      .map(
        (en) =>
          `<tr><td>${escapeHtml(formatDateTime(en.created_at))}</td><td>${
            en.type === "add" ? "Added" : "Withdrawn"
          }</td><td>${en.type === "add" ? "+" : "-"}${escapeHtml(rs(en.amount))}</td><td>${escapeHtml(
            rs(en.balance_before)
          )}</td><td>${escapeHtml(rs(en.balance_after))}</td><td>${escapeHtml(
            en.note || "-"
          )}</td><td>${escapeHtml(en.user_name || "-")}</td></tr>`
      )
      .join("");

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Cash in Hand</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 7px 9px; text-align: left; }
  th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>Cash in Hand</h1>
<p>Current balance: ${escapeHtml(rs(balance))} &middot; Generated on ${escapeHtml(todayISO())} &middot; ${
      entries.length
    } entries</p>
<table>
<thead><tr><th>Date &amp; Time</th><th>Type</th><th>Amount</th><th>Before</th><th>After</th><th>Note</th><th>By</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setMsg(null);

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setMsg({ kind: "error", text: "Please enter a valid amount." });
      return;
    }
    if (type === "withdraw" && num > balance) {
      setMsg({ kind: "error", text: "You can't withdraw more than the cash in hand." });
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
        setMsg({ kind: "error", text: data?.message ?? "Update failed." });
        return;
      }

      setMsg({
        kind: "success",
        text: type === "add" ? "Cash added!" : "Cash withdrawn!",
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      console.error(err);
      setMsg({ kind: "error", text: "Something went wrong. Please try again." });
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
            Add or withdraw cash. Inventory purchases will be paid from this cash.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          <button
            type="button"
            style={{
              ...refreshBtnStyle,
              opacity: refreshing ? 0.7 : 1,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshIcon />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button type="button" style={excelBtnStyle} onClick={handleExportExcel}>
            <SheetIcon />
            <span>Excel</span>
          </button>
          <button type="button" style={pdfBtnStyle} onClick={handleExportPdf}>
            <DownloadIcon />
            <span>PDF</span>
          </button>
        </div>
      </header>

      {loadError && <p className="cih-msg error">{loadError}</p>}

      {/* Balance card */}
      <section className="cih-card">
        <span className="cih-label">Admin Cash in Hand (manual)</span>
        <p className="cih-balance">{rs(balance)}</p>
        <p className="cih-hint">
          Only this much cash can be used when adding inventory. The remaining amount goes to the vendor's credit.
        </p>
      </section>

      {/* Update form (admin only) */}
      {isAdmin && (
        <form className="cih-card cih-form" onSubmit={handleSubmit}>
          <h3 className="cih-card-title">Update Cash</h3>

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
          <p className="cih-empty">No history yet.</p>
        ) : (
          <div className="cih-table-wrap">
            <table className="cih-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Before</th>
                  <th>After</th>
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