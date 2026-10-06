import React, { useEffect, useState } from 'react';
import { API_URL } from "../../../config";
import './ExtraExpense.css';

interface Expense {
  id: number;
  title: string;
  amount: number;
  date: string;
}

const ExtraExpense: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        setError("Session expire ho gaya hai, dobara login karo.");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpenses(json.data ?? []);
    } catch {
      setError("Extra expenses load nahi ho sake. Backend chal raha hai?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

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
      
      if (!res.ok) throw new Error("Add nahi ho saka");
      
      await loadExpenses(); // Refresh list
      setTitle('');
      setAmount('');
      setDate('');
    } catch (err) {
      alert(err instanceof Error ? err.message : "Kuch ghalat ho gaya.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Expense
  const handleDelete = async (id: number) => {
    if (!window.confirm("Kya aap is expense ko delete karna chahte hain?")) return;
    try {
      const res = await fetch(`${API_URL}/extra-expenses/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await loadExpenses();
    } catch {
      alert("Delete nahi ho saka.");
    }
  };

  return (
    <div className="extra-expense-container">
      <div className="page-header">
        <h1>Extra Expenses</h1>
        <p>Manage unexpected or one-time gym expenses (Equipment, Snacks, etc.)</p>
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