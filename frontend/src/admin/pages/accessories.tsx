import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../../config";
import "./accessories.css";

/* ---------- Types ---------- */
type Status = "in" | "low" | "out";
type LogType = "initial" | "restock" | "removed";
// "custom" = ek single specific date (backend ko from = to bhej rahe hain)
type SpendFilterType = "month" | "week" | "custom";

interface AccessoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit_price?: number | null;
  status: Status;
  image?: string | null;
  notes?: string | null;
}

interface Stats {
  total: number;
  in: number;
  low: number;
  out: number;
}

interface StockLog {
  id: number;
  type: LogType;
  quantity_change: number;
  quantity_after: number;
  unit_price: number | null;
  note: string | null;
  created_at: string;
}

interface HistorySummary {
  total_purchased: number;
  total_spent: number;
  avg_unit_price: number | null;
  last_unit_price: number | null;
}

interface SpendFiltered {
  type: SpendFilterType;
  label: string;
  value: number;
}

interface SpendSummary {
  total_all_time: number;
  today: number;
  this_week: number;
  filtered: SpendFiltered;
}

interface SavePayload {
  name: string;
  category: string;
  quantity: number;
  notes: string | null;
  unit_price?: number | null; // only when adding a new item
  reason?: string | null; // only when stock is reduced in edit
}

interface RestockPayload {
  quantity: number;
  unit_price: number;
  note: string | null;
}

/* ---------- Helpers ---------- */
const CATEGORIES = ["All Categories", "Dumbbells", "Rods", "Attachments", "Weights", "Accessories"];

const STATUS_LABEL: Record<Status, string> = {
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

const LOG_LABEL: Record<LogType, string> = {
  initial: "Opening stock",
  restock: "Restocked",
  removed: "Removed",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i);

const PAGE_SIZE = 15;
const BOTTOM_GAP = 24;

// Local date (YYYY-MM-DD). toISOString() UTC deta hai, jis se Pakistan mein
// raat 12 se subah 5 baje tak pichli date aa jati thi.
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// "2026-09-24" -> "24 Sep 2026"
const formatDay = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const formatPrice = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Laravel validation errors come as { message, errors: { field: [msg] } }
const extractError = (json: any, fallback: string): string => {
  const first = json?.errors ? (Object.values(json.errors).flat()[0] as string | undefined) : undefined;
  return first ?? json?.message ?? fallback;
};

/* ---------- Small icon components ---------- */
const Icon = ({
  children,
  strokeWidth = 1.8,
}: {
  children: React.ReactNode;
  strokeWidth?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const DumbbellIcon = () => (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </Icon>
);
const BoxIcon = () => (
  <Icon>
    <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
  </Icon>
);
const CheckBoxIcon = () => (
  <Icon>
    <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Icon>
);
const AlertIcon = () => (
  <Icon>
    <path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01" />
  </Icon>
);
const BanIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);
const CashIcon = () => (
  <Icon>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9v.01M18 15v.01" />
  </Icon>
);
const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </Icon>
);
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);
const ChevronDownIcon = () => (
  <Icon>
    <path d="M6 9l6 6 6-6" />
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
const FilterIcon = () => (
  <Icon>
    <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
const EditIcon = () => (
  <Icon>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
  </Icon>
);
const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);
const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/* ---------- Page ---------- */
export default function Accessories() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, in: 0, low: 0, out: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Spend cards (Total spent / filterable / this week / today)
  const [spend, setSpend] = useState<SpendSummary | null>(null);
  const [spendLoading, setSpendLoading] = useState(true);
  const [filterType, setFilterType] = useState<SpendFilterType>("month");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterWeekDate, setFilterWeekDate] = useState(todayISO());
  const [filterDate, setFilterDate] = useState(todayISO()); // single specific date
  const [spendFilterOpen, setSpendFilterOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessoryItem | null>(null);
  const [restocking, setRestocking] = useState<AccessoryItem | null>(null);
  const [viewing, setViewing] = useState<AccessoryItem | null>(null);

  // History of the item open in the View modal
  const [history, setHistory] = useState<StockLog[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Make the page its own scroll container
  useLayoutEffect(() => {
    const updateHeight = () => {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top + window.scrollY;
      setPageHeight(Math.max(320, window.innerHeight - top - BOTTOM_GAP));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, category, statusFilter]);

  /* ---------- Load from API ---------- */
  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/accessories`, { headers: authHeaders() });
      if (res.status === 401) {
        setError("Session expire ho gaya hai, dobara login karo.");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data ?? []);
      setStats(json.stats ?? { total: 0, in: 0, low: 0, out: 0 });
    } catch {
      setError("Accessories load nahi ho sake. Backend chal raha hai?");
    } finally {
      setLoading(false);
    }
  };

  const loadSpend = async () => {
    // Date khali kar di ho to request na bhejein
    if (filterType === "custom" && !filterDate) {
      setSpendLoading(false);
      return;
    }

    setSpendLoading(true);
    try {
      const params = new URLSearchParams({ filter_type: filterType });
      if (filterType === "month") {
        params.set("month", String(filterMonth));
        params.set("year", String(filterYear));
      } else if (filterType === "week") {
        params.set("week_date", filterWeekDate);
      } else {
        // Single date: from aur to dono same date => sirf usi din ka record
        params.set("from", filterDate);
        params.set("to", filterDate);
      }

      const res = await fetch(`${API_URL}/accessories/spend-summary?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSpend(json);
    } catch {
      // stat cards ke liye chup chaap fail ho jaane dein, table pe error already dikh raha hoga
    } finally {
      setSpendLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    loadSpend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterMonth, filterYear, filterWeekDate, filterDate]);

  /* ---------- Load history when the View modal opens ---------- */
  useEffect(() => {
    if (!viewing) {
      setHistory([]);
      setSummary(null);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch(`${API_URL}/accessories/${viewing.id}/history`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (cancelled) return;
        setHistory(json.data ?? []);
        setSummary(json.summary ?? null);
      } catch {
        if (!cancelled) setHistoryError("History load nahi ho saki.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [viewing]);

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchName = !q || item.name.toLowerCase().includes(q);
      const matchCat = category === "All Categories" || item.category === category;
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchName && matchCat && matchStatus;
    });
  }, [items, search, category, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = filtered.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageItems.length;

  // Spent card ka period label: single date ho to sirf ek date dikhayen
  const spentPeriodLabel =
    filterType === "custom" ? formatDay(filterDate) : spend?.filtered.label ?? "This month";

  /* ---------- Actions ---------- */
  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: AccessoryItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: AccessoryItem) => {
    if (!window.confirm(`"${item.name}" ko delete kar dein? Iski history bhi delete ho jaegi.`)) return;
    try {
      const res = await fetch(`${API_URL}/accessories/${item.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await Promise.all([loadItems(), loadSpend()]);
    } catch {
      alert("Item delete nahi ho saka.");
    }
  };

  const handleSave = async (data: SavePayload, id?: number) => {
    const url = id ? `${API_URL}/accessories/${id}` : `${API_URL}/accessories`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractError(json, "Save nahi ho saka."));
    await Promise.all([loadItems(), loadSpend()]);
  };

  const handleRestock = async (id: number, data: RestockPayload) => {
    const res = await fetch(`${API_URL}/accessories/${id}/restock`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractError(json, "Stock add nahi ho saka."));
    await Promise.all([loadItems(), loadSpend()]);
  };

  return (
    <div
      className="acc-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <header className="acc-header">
        <div className="acc-header-left">
          <div className="acc-header-icon">
            <DumbbellIcon />
          </div>
          <div>
            <h1 className="acc-title">Accessories</h1>
            <p className="acc-subtitle">Manage gym accessories, equipment and their stock.</p>
          </div>
        </div>
        <button type="button" className="acc-btn-primary" onClick={openAdd}>
          <PlusIcon />
          <span>Add Item</span>
        </button>
      </header>

      {error && (
        <div className="acc-alert" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stat cards (8 total: spend cards + stock cards) */}
      <section className="acc-stats">
        {/* 1. Total Spent — all time */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon red"><CashIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Total Spent</span>
            <span className="acc-stat-period">All time</span>
            <span className="acc-stat-value">
              {spendLoading ? "…" : formatPrice(spend?.total_all_time ?? 0)}
            </span>
          </div>
        </div>

        {/* 2. Flexible spend card: month / week / single date */}
        <div className="acc-stat-card acc-stat-filterable">
          <div className="acc-stat-icon amber"><CalendarIcon /></div>
          <div className="acc-stat-info">
            <div className="acc-stat-filter-head">
              <span className="acc-stat-title">Spent</span>
              <button
                type="button"
                className={`acc-stat-filter-btn ${spendFilterOpen ? "is-active" : ""}`}
                onClick={() => setSpendFilterOpen((o) => !o)}
                aria-label="Filter spend period"
              >
                <FilterIcon />
              </button>
            </div>
            <span className="acc-stat-period">{spentPeriodLabel}</span>
            <span className="acc-stat-value">
              {spendLoading ? "…" : formatPrice(spend?.filtered.value ?? 0)}
            </span>

            {spendFilterOpen && (
              <>
                {/* Invisible full-screen backdrop: blocks hover/click on cards
                    underneath the panel and closes the panel on outside click */}
                <div
                  className="acc-filter-backdrop"
                  onClick={() => setSpendFilterOpen(false)}
                />
                <div
                  className="acc-stat-filter-panel"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="acc-filter-type-row">
                    {(["month", "week", "custom"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={filterType === t ? "is-selected" : ""}
                        onClick={() => setFilterType(t)}
                      >
                        {t === "month" ? "Month" : t === "week" ? "Week" : "Date"}
                      </button>
                    ))}
                  </div>

                  {filterType === "month" && (
                    <div className="acc-filter-inputs">
                      <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                        {MONTH_NAMES.map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {filterType === "week" && (
                    <div className="acc-filter-inputs">
                      <input
                        type="date"
                        value={filterWeekDate}
                        onChange={(e) => setFilterWeekDate(e.target.value)}
                      />
                    </div>
                  )}

                  {filterType === "custom" && (
                    <div className="acc-filter-inputs">
                      <input
                        type="date"
                        value={filterDate}
                        max={todayISO()}
                        onChange={(e) => setFilterDate(e.target.value)}
                        aria-label="Select date"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="acc-filter-apply"
                    onClick={() => setSpendFilterOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. This Week */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon green"><ClockIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">This Week</span>
            <span className="acc-stat-period">Mon - Sun</span>
            <span className="acc-stat-value">
              {spendLoading ? "…" : formatPrice(spend?.this_week ?? 0)}
            </span>
          </div>
        </div>

        {/* 4. Today */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon orange"><SunIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Today</span>
            <span className="acc-stat-period">
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </span>
            <span className="acc-stat-value">
              {spendLoading ? "…" : formatPrice(spend?.today ?? 0)}
            </span>
          </div>
        </div>

        {/* 5. Total Items */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon red"><BoxIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Total Items</span>
            <span className="acc-stat-period">All time</span>
            <span className="acc-stat-value">{stats.total}</span>
          </div>
        </div>

        {/* 6. In Stock */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon green"><CheckBoxIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">In Stock</span>
            <span className="acc-stat-period">Right now</span>
            <span className="acc-stat-value">{stats.in}</span>
          </div>
        </div>

        {/* 7. Low Stock */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon amber"><AlertIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Low Stock</span>
            <span className="acc-stat-period">Right now</span>
            <span className="acc-stat-value">{stats.low}</span>
          </div>
        </div>

        {/* 8. Out of Stock */}
        <div className="acc-stat-card">
          <div className="acc-stat-icon orange"><BanIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Out of Stock</span>
            <span className="acc-stat-period">Right now</span>
            <span className="acc-stat-value">{stats.out}</span>
          </div>
        </div>
      </section>

      {/* Table panel */}
      <section className="acc-panel">
        {/* Toolbar */}
        <div className="acc-toolbar">
          <label className="acc-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search accessory name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="acc-select-wrap">
            <select
              className="acc-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="acc-select-icon"><ChevronDownIcon /></span>
          </div>

          <div className="acc-filter">
            <button
              type="button"
              className={`acc-icon-btn ${statusFilter !== "all" ? "is-active" : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filter by status"
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <ul className="acc-filter-menu" role="menu">
                {(["all", "in", "low", "out"] as const).map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className={statusFilter === s ? "is-selected" : ""}
                      onClick={() => {
                        setStatusFilter(s);
                        setFilterOpen(false);
                      }}
                    >
                      {s === "all" ? "All Status" : STATUS_LABEL[s]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Category</th>
                <th className="center">Quantity</th>
                <th className="center">Price / Unit</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="acc-empty">Loading...</td>
                </tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="acc-empty">
                    No accessories found. Try a different search or filter.
                  </td>
                </tr>
              )}
              {!loading && pageItems.map((item, i) => (
                <tr key={item.id}>
                  <td className="muted">{startIndex + i + 1}</td>
                  <td>
                    <div className="acc-item">
                      <span className="acc-thumb">
                        {item.image ? <img src={item.image} alt="" /> : <DumbbellIcon />}
                      </span>
                      <span className="item-name">{item.name}</span>
                    </div>
                  </td>
                  <td className="muted">{item.category}</td>
                  <td className="center">{item.quantity}</td>
                  <td className="center">{formatPrice(item.unit_price)}</td>
                  <td className="center">
                    <span className={`acc-status ${item.status}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td className="center">
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => setRestocking(item)}
                        aria-label={`Add stock to ${item.name}`}
                        title="Add stock"
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => setViewing(item)}
                        aria-label={`View ${item.name}`}
                        title="View details & history"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.name}`}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="acc-footer">
          <span className="acc-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} items
          </span>

          <div className="acc-pagination">
            <button
              type="button"
              className="acc-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="acc-page-btn dots">...</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`acc-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="acc-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <AccessoryModal
          editing={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Restock Modal */}
      {restocking && (
        <RestockModal
          item={restocking}
          onClose={() => setRestocking(null)}
          onSave={handleRestock}
        />
      )}

      {/* View Modal (details + history) */}
      {viewing && (
        <div className="acc-modal-overlay" onClick={() => setViewing(null)}>
          <div className="acc-modal acc-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-head">
              <h2>{viewing.name}</h2>
              <button
                type="button"
                className="acc-icon-btn"
                onClick={() => setViewing(null)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="acc-modal-body">
              <div className="acc-modal-row">
                <span className="muted">Category</span>
                <strong>{viewing.category}</strong>
              </div>
              <div className="acc-modal-row">
                <span className="muted">Quantity</span>
                <strong>{viewing.quantity}</strong>
              </div>
              <div className="acc-modal-row">
                <span className="muted">Latest price / unit</span>
                <strong>{formatPrice(viewing.unit_price)}</strong>
              </div>
              <div className="acc-modal-row">
                <span className="muted">Status</span>
                <span className={`acc-status ${viewing.status}`}>
                  {STATUS_LABEL[viewing.status]}
                </span>
              </div>
              {viewing.notes && (
                <div className="acc-modal-row">
                  <span className="muted">Notes</span>
                  <strong>{viewing.notes}</strong>
                </div>
              )}

              {/* Summary */}
              {summary && (
                <div className="acc-summary">
                  <div className="acc-summary-card">
                    <span className="muted">Total purchased</span>
                    <strong>{summary.total_purchased} pcs</strong>
                  </div>
                  <div className="acc-summary-card">
                    <span className="muted">Total spent</span>
                    <strong>{formatPrice(summary.total_spent)}</strong>
                  </div>
                  <div className="acc-summary-card">
                    <span className="muted">Average price / unit</span>
                    <strong>{formatPrice(summary.avg_unit_price)}</strong>
                  </div>
                </div>
              )}

              {/* History */}
              <h3 className="acc-history-title">Stock history</h3>

              {historyLoading && <p className="acc-history-empty">Loading history...</p>}
              {historyError && <p className="acc-modal-error">{historyError}</p>}
              {!historyLoading && !historyError && history.length === 0 && (
                <p className="acc-history-empty">Abhi tak koi history nahi hai.</p>
              )}

              {!historyLoading && history.length > 0 && (
                <div className="acc-history-wrap">
                  <table className="acc-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="center">Qty</th>
                        <th className="center">Price / Unit</th>
                        <th className="center">Total cost</th>
                        <th className="center">Stock after</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((log) => {
                        const total =
                          log.quantity_change > 0 && log.unit_price !== null
                            ? log.quantity_change * Number(log.unit_price)
                            : null;
                        return (
                          <tr key={log.id}>
                            <td className="muted">
                              {formatDate(log.created_at)}
                              {log.note && <div className="acc-history-note">{log.note}</div>}
                            </td>
                            <td>
                              <span className={`acc-log-badge ${log.type}`}>
                                {LOG_LABEL[log.type]}
                              </span>
                            </td>
                            <td className={`center acc-log-qty ${log.quantity_change > 0 ? "plus" : "minus"}`}>
                              {log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change}
                            </td>
                            <td className="center">{formatPrice(log.unit_price)}</td>
                            <td className="center">{formatPrice(total)}</td>
                            <td className="center">{log.quantity_after}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add / Edit Modal                                                   */
/* ------------------------------------------------------------------ */

interface AccessoryModalProps {
  editing: AccessoryItem | null;
  onClose: () => void;
  onSave: (data: SavePayload, id?: number) => Promise<void>;
}

const AccessoryModal: React.FC<AccessoryModalProps> = ({ editing, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    category: editing?.category ?? "Dumbbells",
    quantity: editing?.quantity ?? 0,
    unitPrice: "",
    reason: "",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const isDecrease = !!editing && Number(form.quantity) < editing.quantity;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Item ka naam likhein.");
      return;
    }

    const quantity = Number(form.quantity) || 0;

    // Edit: stock can only go down here, going up is done with "Add stock" (+)
    if (editing && quantity > editing.quantity) {
      setError("Stock badhane ke liye table mein + (Add stock) button use karein.");
      return;
    }

    // Add: price is required when starting with some stock
    let unitPrice: number | null = null;
    if (!editing && quantity > 0) {
      if (form.unitPrice.trim() === "" || Number(form.unitPrice) < 0 || Number.isNaN(Number(form.unitPrice))) {
        setError("Har piece ki price likhein (kitne ka liya).");
        return;
      }
      unitPrice = Number(form.unitPrice);
    }

    setSaving(true);
    setError(null);
    try {
      const payload: SavePayload = {
        name: form.name.trim(),
        category: form.category,
        quantity,
        notes: form.notes.trim() || null,
      };
      if (!editing) payload.unit_price = unitPrice;
      if (editing && isDecrease) payload.reason = form.reason.trim() || null;

      await onSave(payload, editing?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch ghalat ho gaya.");
    } finally {
      setSaving(false);
    }
  };

  const newQty = Number(form.quantity) || 0;
  const totalCost =
    !editing && newQty > 0 && form.unitPrice.trim() !== ""
      ? newQty * Number(form.unitPrice)
      : null;

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h2>{editing ? "Edit Item" : "Add Item"}</h2>
          <button type="button" className="acc-icon-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="acc-modal-body" onSubmit={submit}>
          {error && <div className="acc-modal-error">{error}</div>}

          <div className="acc-form-field">
            <label>Item Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Dumbbell 5kg"
              autoFocus
            />
          </div>

          <div className="acc-form-row">
            <div className="acc-form-field">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="acc-form-field">
              <label>{editing ? "Quantity" : "Quantity (opening stock)"}</label>
              <input
                type="number"
                min={0}
                max={editing ? editing.quantity : undefined}
                value={form.quantity}
                onChange={(e) => update("quantity", Number(e.target.value))}
              />
            </div>
          </div>

          {/* New item: ask the purchase price */}
          {!editing && (
            <div className="acc-form-field">
              <label>Price per unit (Rs)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => update("unitPrice", e.target.value)}
                placeholder="Har piece kitne ka liya? e.g. 1500"
              />
              {totalCost !== null && !Number.isNaN(totalCost) && (
                <small className="acc-hint">
                  Total cost: {formatPrice(totalCost)}
                </small>
              )}
            </div>
          )}

          {/* Edit: stock reduced -> optional reason */}
          {editing && isDecrease && (
            <div className="acc-form-field">
              <label>Reason for reducing stock (optional)</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => update("reason", e.target.value)}
                placeholder="e.g. 1 damaged, 1 gift"
              />
            </div>
          )}

          {editing && (
            <small className="acc-hint">
              Stock badhana hai? Table mein + (Add stock) button use karein — wahan price bhi save hoti hai.
            </small>
          )}

          <div className="acc-form-field">
            <label>Notes (optional)</label>
            <input
              type="text"
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. Brand new stock"
            />
          </div>

          <div className="acc-modal-foot">
            <button type="button" className="acc-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="acc-btn-primary" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Restock Modal                                                      */
/* ------------------------------------------------------------------ */

interface RestockModalProps {
  item: AccessoryItem;
  onClose: () => void;
  onSave: (id: number, data: RestockPayload) => Promise<void>;
}

const RestockModal: React.FC<RestockModalProps> = ({ item, onClose, onSave }) => {
  const [quantity, setQuantity] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>(
    item.unit_price !== null && item.unit_price !== undefined ? String(item.unit_price) : ""
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity) || 0;
  const price = Number(unitPrice);
  const hasPrice = unitPrice.trim() !== "" && !Number.isNaN(price) && price >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!Number.isInteger(qty) || qty < 1) {
      setError("Kitne piece add kiye? (kam az kam 1)");
      return;
    }
    if (!hasPrice) {
      setError("Har piece ki price likhein (kitne ka liya).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(item.id, {
        quantity: qty,
        unit_price: price,
        note: note.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch ghalat ho gaya.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h2>Add stock — {item.name}</h2>
          <button type="button" className="acc-icon-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="acc-modal-body" onSubmit={submit}>
          {error && <div className="acc-modal-error">{error}</div>}

          <div className="acc-modal-row">
            <span className="muted">Current stock</span>
            <strong>{item.quantity}</strong>
          </div>

          <div className="acc-form-row">
            <div className="acc-form-field">
              <label>Quantity added</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10"
                autoFocus
              />
            </div>

            <div className="acc-form-field">
              <label>Price per unit (Rs)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g. 1500"
              />
            </div>
          </div>

          {qty > 0 && (
            <small className="acc-hint">
              New stock: {item.quantity + qty}
              {hasPrice && <> &nbsp;•&nbsp; Total cost: {formatPrice(qty * price)}</>}
            </small>
          )}

          <div className="acc-form-field">
            <label>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bought from Saddar market"
            />
          </div>

          <div className="acc-modal-foot">
            <button type="button" className="acc-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="acc-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};