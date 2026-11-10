import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../../config";
import { blockedGuard } from "./blockedGuard";

/* ============================================================
   Shared by amounts.tsx and amountproof.tsx
   Backend: GET /admin/subscription
   -> { data: { monthly_fee, paid_amount, remaining, started_at, billing_start,
                due_date, is_paid, paid_until, is_trial, trial_days_left } }
   Cycle ka saara hisaab backend karta hai, yahan sirf dikhana hai.
   ============================================================ */
const SUBSCRIPTION_ENDPOINT = `${API_URL}/admin/subscription`;

// Gym admin ka login token jis localStorage key mein save hota hai
export const TOKEN_KEY = "token";

/* ---------------- helpers ---------------- */
export const formatPKR = (n: number) => "Rs " + Math.round(n || 0).toLocaleString("en-PK");

/* "2026-11-10" -> local Date (timezone ka masla nahi aata) */
const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/* YYYY-MM-DD (backend ko bhejne ke liye) */
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------------- hook ---------------- */
export function useSubscription() {
  const navigate = useNavigate();
  const token = localStorage.getItem(TOKEN_KEY);

  const [monthlyFee, setMonthlyFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0); // <-- NEW
  const [remaining, setRemaining] = useState(0); // <-- NEW
  const [billingStart, setBillingStart] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINT, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Company block ho gayi: token saaf + /payment-required par redirect
      if (await blockedGuard(res)) return;

      if (res.status === 401) {
        navigate("/login", { replace: true }); // apna login route likh lena
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      const data = json?.data ?? json;
      const fee = Number(data?.monthly_fee ?? 0);
      setMonthlyFee(fee);
      setPaidAmount(Number(data?.paid_amount ?? 0)); // <-- NEW
      setRemaining(Number(data?.remaining ?? fee)); // <-- NEW (purana backend ho to fee hi dikhega)
      setBillingStart(parseDate(data?.billing_start));
      setDueDate(parseDate(data?.due_date));
      setIsPaid(!!data?.is_paid);
      setIsTrial(!!data?.is_trial);
      setTrialDaysLeft(data?.trial_days_left == null ? null : Number(data.trial_days_left));
    } catch (e: any) {
      setError(e?.message || "Could not load subscription");
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    reload: load,
    monthlyFee,
    paidAmount, // <-- NEW
    remaining, // <-- NEW
    billingStart,
    dueDate,
    isPaid,
    isTrial,
    trialDaysLeft,
  };
}