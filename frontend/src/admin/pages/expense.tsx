import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../../config";
import "./expense.css";

/* ---------- Types ---------- */
interface Expense {
  id: number;
  title: string;
  amount: number;
  date: string;
}

interface SalaryPayment {
  id: number;
  staff_id: number;
  staff_type: "trainer" | "frontdesk";
  amount: number;
  month: number;
  year: number;
  paid_on: string;
  status: "paid" | "pending";
  note?: string;
}

type Source = "fixed" | "extra" | "salary";

interface CombinedExpense extends Expense {
  source: Source;
}

/* ---------- Helpers ---------- */
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const formatPrice = (n: number): string =>
  `Rs ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const extractList = (json: any): any[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.trainers)) return json.trainers;
  return [];
};

/* ---------- Small icons ---------- */
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

const CashIcon = () => (
  <Icon>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9v.01M18 15v.01" />
  </Icon>
);
const ReceiptIcon = () => (
  <Icon>
    <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Icon>
);
const CoinIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
  </Icon>
);
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" />
    <path d="M16 5.2a3 3 0 010 5.6M18 14c1.8.7 3 2.3 3 5" />
  </Icon>
);
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);
const FilterIcon = () => (
  <Icon>
    <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
  </Icon>
);
const ChevronLeftIcon = () => (
  <Icon>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);
const ChevronRightIcon = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

/* ---------- Config ---------- */
const PAGE_SIZE = 10;

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const SOURCE_LABEL: Record<Source, string> = {
  fixed: "Fixed",
  extra: "Extra",
  salary: "Salary",
};

/* ---------- Page ---------- */
export default function ExpenseOverview() {
  const [fixed, setFixed] = useState<Expense[]>([]);
  const [extra, setExtra] = useState<Expense[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  // Active staff ki base salary (key: trainer-1 / frontdesk-2)
  const [staffSalaries, setStaffSalaries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | Source>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  /* ---------- Load all lists ---------- */
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fixedRes, extraRes] = await Promise.all([
        fetch(`${API_URL}/fixed-expenses`, { headers: authHeaders() }),
        fetch(`${API_URL}/extra-expenses`, { headers: authHeaders() }),
      ]);

      if (fixedRes.status === 401 || extraRes.status === 401) {
        setError("Session expire ho gaya hai, dobara login karo.");
        return;
      }
      if (!fixedRes.ok || !extraRes.ok) throw new Error();

      const fixedJson = await fixedRes.json();
      const extraJson = await extraRes.json();

      setFixed(fixedJson.data ?? []);
      setExtra(extraJson.data ?? []);
    } catch {
      setError("Expenses load nahi ho sake. Backend chal raha hai?");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Salary payments + staff names ---------- */
  const loadSalary = async () => {
    try {
      const [payRes, trainersRes, frontRes] = await Promise.all([
        fetch(`${API_URL}/salary-payments`, { headers: authHeaders() }),
        fetch(`${API_URL}/trainers`, { headers: authHeaders() }),
        fetch(`${API_URL}/staff/frontdesk`, { headers: authHeaders() }),
      ]);

      if (payRes.ok) {
        const json = await payRes.json();
        setSalaryPayments(json.data ?? []);
      }

      const names: Record<string, string> = {};
      const salaries: Record<string, number> = {};

      const isActive = (x: any) => {
        const flagOff =
          typeof x.is_active !== "undefined" &&
          !(Number(x.is_active) === 1 || x.is_active === true);
        const inactive = String(x.status ?? "").trim().toLowerCase() === "inactive";
        return !flagOff && !inactive;
      };

      if (trainersRes.ok) {
        extractList(await trainersRes.json()).forEach((t: any) => {
          const key = `trainer-${t.id}`;
          names[key] = t.name ?? "";
          if (isActive(t)) salaries[key] = Number(t.base_salary ?? 0);
        });
      }
      if (frontRes.ok) {
        extractList(await frontRes.json()).forEach((u: any) => {
          const key = `frontdesk-${u.id}`;
          names[key] = u.name ?? u.full_name ?? "";
          if (isActive(u)) salaries[key] = Number(u.base_salary ?? 0);
        });
      }
      setStaffNames(names);
      setStaffSalaries(salaries);
    } catch {
      /* salary load na ho to baaki page chalta rahe */
    }
  };

  useEffect(() => {
    loadAll();
    loadSalary();
  }, []);

  /* ---------- Salary rows (sirf paid) ---------- */
  const paidSalaries = useMemo(
    () => salaryPayments.filter((p) => p.status === "paid"),
    [salaryPayments]
  );

  const salaryRows: CombinedExpense[] = useMemo(
    () =>
      paidSalaries.map((p) => {
        const name = staffNames[`${p.staff_type}-${p.staff_id}`] || "Staff";
        return {
          // id collision se bachne ke liye alag range (key mein source bhi hai)
          id: p.id,
          title: `Salary — ${name} (${MONTH_NAMES[p.month - 1]} ${p.year})`,
          amount: Number(p.amount),
          date: String(p.paid_on ?? "").slice(0, 10),
          source: "salary" as Source,
        };
      }),
    [paidSalaries, staffNames]
  );

  /* ---------- Combined list ---------- */
  const combined: CombinedExpense[] = useMemo(() => {
    const f: CombinedExpense[] = fixed.map((x) => ({ ...x, source: "fixed" }));
    const e: CombinedExpense[] = extra.map((x) => ({ ...x, source: "extra" }));
    return [...f, ...e, ...salaryRows].sort((a, b) => {
      if (a.date === b.date) return b.id - a.id;
      return a.date < b.date ? 1 : -1;
    });
  }, [fixed, extra, salaryRows]);

  /* ---------- Totals ---------- */
  const totalFixed = useMemo(
    () => fixed.reduce((sum, x) => sum + Number(x.amount), 0),
    [fixed]
  );
  const totalExtra = useMemo(
    () => extra.reduce((sum, x) => sum + Number(x.amount), 0),
    [extra]
  );

  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // Is month ki salary: us month ke liye jitni paid payments hui (month/year ke hisaab se)
  const salaryThisMonth = useMemo(
    () =>
      paidSalaries
        .filter((p) => p.month === curMonth && p.year === curYear)
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [paidSalaries, curMonth, curYear]
  );

  // Is month ki total salary deni hai (active staff ki base salary ka total)
  const salaryDueThisMonth = useMemo(
    () => Object.values(staffSalaries).reduce((sum, v) => sum + v, 0),
    [staffSalaries]
  );

  // Is month ki salary kitni baqi hai (har staff ka alag hisaab, overpay doosre ka remaining nahi chhupata)
  const salaryRemainingThisMonth = useMemo(() => {
    const paidByStaff: Record<string, number> = {};
    paidSalaries
      .filter((p) => p.month === curMonth && p.year === curYear)
      .forEach((p) => {
        const key = `${p.staff_type}-${p.staff_id}`;
        paidByStaff[key] = (paidByStaff[key] ?? 0) + Number(p.amount);
      });

    return Object.entries(staffSalaries).reduce(
      (sum, [key, base]) => sum + Math.max(0, base - (paidByStaff[key] ?? 0)),
      0
    );
  }, [staffSalaries, paidSalaries, curMonth, curYear]);


  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combined.filter((item) => {
      const matchName = !q || item.title.toLowerCase().includes(q);
      const matchSource =
        sourceFilter === "all" || item.source === sourceFilter;
      return matchName && matchSource;
    });
  }, [combined, search, sourceFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = filtered.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageItems.length;

  return (
    <div className="exp-page">
      {/* Header */}
      <header className="exp-header">
        <div className="exp-header-left">
          <div className="exp-header-icon">
            <WalletIconBig />
          </div>
          <div>
            <h1 className="exp-title">Expense Overview</h1>
            <p className="exp-subtitle">
              Poora kharcha aik jagah — Fixed, Extra aur is month ki Salary.
            </p>
          </div>
        </div>
      </header>

      {error && <div className="exp-alert">{error}</div>}

      {/* Stat cards */}
      <section className="exp-stats">
        {/* Total Fixed */}
        <div className="exp-stat-card">
          <div className="exp-stat-icon amber">
            <ReceiptIcon />
          </div>
          <div className="exp-stat-info">
            <span className="exp-stat-title">Fixed Expense</span>
            <span className="exp-stat-period">All time</span>
            <span className="exp-stat-value">{formatPrice(totalFixed)}</span>
          </div>
        </div>

        {/* Total Extra */}
        <div className="exp-stat-card">
          <div className="exp-stat-icon red">
            <CoinIcon />
          </div>
          <div className="exp-stat-info">
            <span className="exp-stat-title">Extra Expense</span>
            <span className="exp-stat-period">All time</span>
            <span className="exp-stat-value">{formatPrice(totalExtra)}</span>
          </div>
        </div>

        {/* Is month ki total salary deni hai */}
        <div className="exp-stat-card">
          <div className="exp-stat-icon amber">
            <UsersIcon />
          </div>
          <div className="exp-stat-info">
            <span className="exp-stat-title">Salary To Pay</span>
            <span className="exp-stat-period">
              {MONTH_NAMES[curMonth - 1]} {curYear} — Total
            </span>
            <span className="exp-stat-value">{formatPrice(salaryDueThisMonth)}</span>
          </div>
        </div>

        {/* Is month ki salary dedi */}
        <div className="exp-stat-card">
          <div className="exp-stat-icon green">
            <CashIcon />
          </div>
          <div className="exp-stat-info">
            <span className="exp-stat-title">Salary Paid</span>
            <span className="exp-stat-period">
              {MONTH_NAMES[curMonth - 1]} {curYear} — Given
            </span>
            <span className="exp-stat-value">{formatPrice(salaryThisMonth)}</span>
          </div>
        </div>

        {/* Is month ki salary baqi */}
        <div className="exp-stat-card">
          <div className="exp-stat-icon red">
            <CoinIcon />
          </div>
          <div className="exp-stat-info">
            <span className="exp-stat-title">Salary Remaining</span>
            <span className="exp-stat-period">
              {MONTH_NAMES[curMonth - 1]} {curYear} — Baqi
            </span>
            <span className="exp-stat-value">{formatPrice(salaryRemainingThisMonth)}</span>
          </div>
        </div>

      </section>

      {/* Table panel */}
      <section className="exp-panel">
        {/* Toolbar */}
        <div className="exp-toolbar">
          <label className="exp-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="exp-filter">
            <button
              type="button"
              className={`exp-icon-btn ${
                sourceFilter !== "all" ? "is-active" : ""
              }`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filter by source"
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <ul className="exp-filter-menu" role="menu">
                {(["all", "fixed", "extra", "salary"] as const).map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className={sourceFilter === s ? "is-selected" : ""}
                      onClick={() => {
                        setSourceFilter(s);
                        setFilterOpen(false);
                      }}
                    >
                      {s === "all"
                        ? "All Sources"
                        : s === "fixed"
                        ? "Fixed Only"
                        : s === "extra"
                        ? "Extra Only"
                        : "Salary Only"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="exp-table-wrap">
          <table className="exp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Source</th>
                <th>Date</th>
                <th className="center">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="exp-empty">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="exp-empty">
                    Koi expense nahi mila. Filter change karke dekhein.
                  </td>
                </tr>
              )}
              {!loading &&
                pageItems.map((item, i) => (
                  <tr key={`${item.source}-${item.id}`}>
                    <td className="muted">{startIndex + i + 1}</td>
                    <td className="item-name">{item.title}</td>
                    <td>
                      <span className={`exp-badge ${item.source}`}>
                        {SOURCE_LABEL[item.source]}
                      </span>
                    </td>
                    <td className="muted">{formatDate(item.date)}</td>
                    <td className="center amount-text">
                      {formatPrice(item.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="exp-footer">
          <span className="exp-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} entries
          </span>

          <div className="exp-pagination">
            <button
              type="button"
              className="exp-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="exp-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`exp-page-btn ${
                    p === currentPage ? "active" : ""
                  }`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="exp-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* Header icon (Wallet) */
const WalletIconBig = () => (
  <Icon>
    <path d="M3 7h15a3 3 0 013 3v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    <path d="M3 7l12-3 1 3" />
    <circle cx="16.5" cy="13" r="1.2" />
  </Icon>
);