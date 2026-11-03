import React, { useEffect, useState } from 'react';
import { API_URL } from "../../../config";
import './ExtraExpense.css';

interface Expense {
  id: number;
  title: string;
  amount: number;
  date: string;
}

/* ---------- Helpers ---------- */

// Local date (YYYY-MM-DD) used for export file names
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Escape text before putting it into export HTML
const escapeHtml = (v: string | number): string =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ---------- Header action buttons (inline styles) ---------- */
const actionBtnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1,
};

const refreshBtnStyle: React.CSSProperties = { ...actionBtnBase, background: '#3b82f6' };
const excelBtnStyle: React.CSSProperties = { ...actionBtnBase, background: '#22c55e' };
const pdfBtnStyle: React.CSSProperties = { ...actionBtnBase, background: '#ef4444' };

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

const ExtraExpense: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auth Headers Helper
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token");
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load Data from API
  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/extra-expenses`, { headers: authHeaders() });
      if (res.status === 401) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpenses(json.data ?? []);
    } catch {
      setError("Could not load extra expenses. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // Header: Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadExpenses();
    } finally {
      setRefreshing(false);
    }
  };

  // Header: Excel export (no extra library) — downloads an .xls file built from an HTML table
  const handleExportExcel = () => {
    const body = expenses
      .map(
        (exp) =>
          `<tr><td>${escapeHtml(exp.title)}</td><td>${Number(exp.amount) || 0}</td><td>${escapeHtml(
            exp.date
          )}</td></tr>`
      )
      .join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>Title</th><th>Amount (PKR)</th><th>Date</th></tr></thead>
<tbody>${body}</tbody>
</table>
</body></html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extra-expenses-${todayISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Header: PDF export (no extra library) — opens the print dialog, choose "Save as PDF"
  const handleExportPdf = () => {
    const total = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    const body = expenses
      .map(
        (exp) =>
          `<tr><td>${escapeHtml(exp.title)}</td><td style="text-align:right">${escapeHtml(
            (Number(exp.amount) || 0).toLocaleString()
          )}</td><td>${escapeHtml(exp.date)}</td></tr>`
      )
      .join('');

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Extra Expenses</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>Extra Expenses</h1>
<p>Generated on ${escapeHtml(todayISO())} &middot; ${expenses.length} expenses &middot; Total: PKR ${escapeHtml(
      total.toLocaleString()
    )}</p>
<table>
<thead><tr><th>Title</th><th style="text-align:right">Amount (PKR)</th><th>Date</th></tr></thead>
<tbody>${body}</tbody>
</table>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
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

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !date) return alert('Please fill all fields');

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/extra-expenses`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title, amount: Number(amount), date }),
      });
      
      if (!res.ok) throw new Error("Could not add the expense");
      
      await loadExpenses(); // Refresh list
      setTitle('');
      setAmount('');
      setDate('');
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Expense
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`${API_URL}/extra-expenses/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await loadExpenses();
    } catch {
      alert("Could not delete the expense.");
    }
  };

  return (
    <div className="extra-expense-container">
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Extra Expenses</h1>
          <p>Manage unexpected or one-time gym expenses (Equipment, Snacks, etc.)</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              ...refreshBtnStyle,
              opacity: refreshing ? 0.7 : 1,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshIcon />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
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
      </div>

      {error && <div className="acc-alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-card">
        <h3>Add Extra Expense</h3>
        <form onSubmit={handleAddExpense} className="expense-form">
          <div className="input-group">
            <label>Expense Title</label>
            <input
              type="text"
              placeholder="e.g. Dumbbell 5kg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Amount (PKR)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-add" disabled={saving}>
            {saving ? "Adding..." : "Add Expense"}
          </button>
        </form>
      </div>

      <div className="table-card">
        <h3>Expense History</h3>
        <table className="expense-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Amount (PKR)</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="no-data">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="no-data">No extra expenses added yet.</td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id}>
                  <td>{exp.title}</td>
                  <td className="amount-text">{exp.amount.toLocaleString()}</td>
                  <td>{exp.date}</td>
                  <td>
                    <button onClick={() => handleDelete(exp.id)} className="btn-delete">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExtraExpense;