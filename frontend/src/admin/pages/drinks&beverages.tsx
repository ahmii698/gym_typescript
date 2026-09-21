import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./drinks&beverages.css";

/* ---------- Types ---------- */
type Status = "in" | "low" | "out";
type Pack = "can" | "bottle";

interface DrinkItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  status: Status;
  pack: Pack; // thumbnail ka shape (can ya bottle)
  color: string; // thumbnail ka rang
  image?: string; // optional: image URL. Agar diya to icon ki jagah image dikhegi
}

/* ---------- Data ---------- */
const BASE_ITEMS: Omit<DrinkItem, "id">[] = [
  { name: "Monster Energy", category: "Energy Drink", unit: "Can (500ml)", quantity: 18, status: "in", pack: "can", color: "#3ddc4a" },
  { name: "Red Bull", category: "Energy Drink", unit: "Can (250ml)", quantity: 24, status: "in", pack: "can", color: "#4f7bff" },
  { name: "Gatorade (Orange)", category: "Sports Drink", unit: "Bottle (500ml)", quantity: 12, status: "in", pack: "bottle", color: "#ff9a1f" },
  { name: "Gatorade (Blue)", category: "Sports Drink", unit: "Bottle (500ml)", quantity: 8, status: "in", pack: "bottle", color: "#2d8cff" },
  { name: "Coca Cola", category: "Soft Drink", unit: "Can (330ml)", quantity: 20, status: "in", pack: "can", color: "#ff2a3d" },
  { name: "Sprite", category: "Soft Drink", unit: "Can (330ml)", quantity: 15, status: "in", pack: "can", color: "#2fd45a" },
  { name: "Pepsi", category: "Soft Drink", unit: "Can (330ml)", quantity: 12, status: "in", pack: "can", color: "#2f6bff" },
  { name: "7UP", category: "Soft Drink", unit: "Can (330ml)", quantity: 10, status: "in", pack: "can", color: "#1fbf5a" },
  { name: "Water", category: "Water", unit: "Bottle (500ml)", quantity: 30, status: "in", pack: "bottle", color: "#5cc8ff" },
  { name: "Vitamin Water", category: "Health Drink", unit: "Bottle (500ml)", quantity: 6, status: "low", pack: "bottle", color: "#ff7a2f" },
  { name: "Fuze Tea", category: "Tea", unit: "Bottle (500ml)", quantity: 4, status: "low", pack: "bottle", color: "#ff5a1f" },
  { name: "Protein Shake", category: "Protein Drink", unit: "Bottle (330ml)", quantity: 0, status: "out", pack: "bottle", color: "#c98a6a" },
];

const ITEMS: DrinkItem[] = BASE_ITEMS.map((item, i) => ({ id: i + 1, ...item }));

const CATEGORIES = [
  "All Categories",
  "Energy Drink",
  "Sports Drink",
  "Soft Drink",
  "Water",
  "Health Drink",
  "Tea",
  "Protein Drink",
];

const STATUS_LABEL: Record<Status, string> = {
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

const PAGE_SIZE = 15;
const BOTTOM_GAP = 24;

/* ---------- Helpers ---------- */

// Builds the page number list, e.g. [1, 2, 3, "...", 13]
const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

/* ---------- Icons ---------- */
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

const CupIcon = () => (
  <Icon>
    <path d="M6 4h12l-1.4 15.2a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6 4z" />
    <path d="M6.6 9h10.8M13 4l1-2.5" />
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
const ArrowUpIcon = () => (
  <Icon strokeWidth={2.5}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);
const ArrowDownIcon = () => (
  <Icon strokeWidth={2.5}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Icon>
);
const MinusIcon = () => (
  <Icon strokeWidth={2.5}>
    <path d="M5 12h14" />
  </Icon>
);

/* Can / bottle thumbnail (rang item ke hisaab se) */
const DrinkThumb = ({ pack, color }: { pack: Pack; color: string }) =>
  pack === "can" ? (
    <svg viewBox="0 0 24 32" width="18" height="24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="26" rx="3" fill={color} />
      <rect x="4" y="3" width="16" height="4" rx="2" fill="#fff" opacity="0.35" />
      <rect x="8" y="12" width="8" height="8" rx="2" fill="#000" opacity="0.28" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 32" width="18" height="24" aria-hidden="true">
      <rect x="9.5" y="1" width="5" height="4" rx="1" fill="#e6edf5" />
      <path d="M9 5h6l2.5 5v17a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V10L9 5z" fill={color} />
      <rect x="6.5" y="14" width="11" height="8" fill="#fff" opacity="0.3" />
    </svg>
  );

/* ---------- Stat cards (same structure as Members page) ---------- */
const countBy = (s: Status) => ITEMS.filter((i) => i.status === s).length;

const STATS = [
  {
    id: "total",
    title: "Total Items",
    period: "All time",
    value: ITEMS.length,
    change: "+9%",
    dir: "up",
    tone: "good",
    variant: "red",
    Icon: BoxIcon,
  },
  {
    id: "in",
    title: "In Stock",
    period: "Right now",
    value: countBy("in"),
    change: "+11%",
    dir: "up",
    tone: "good",
    variant: "green",
    Icon: CheckBoxIcon,
  },
  {
    id: "low",
    title: "Low Stock",
    period: "Right now",
    value: countBy("low"),
    change: "-33%",
    dir: "down",
    tone: "good",
    variant: "amber",
    Icon: AlertIcon,
  },
  {
    id: "out",
    title: "Out of Stock",
    period: "Right now",
    value: countBy("out"),
    change: "0%",
    dir: "flat",
    tone: "flat",
    variant: "orange",
    Icon: BanIcon,
  },
] as const;

/* ---------- Page ---------- */
export default function DrinksBeverages() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Make the page its own scroll container (same as Members page)
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

  // Back to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, category, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ITEMS.filter((item) => {
      const matchName = !q || item.name.toLowerCase().includes(q);
      const matchCat = category === "All Categories" || item.category === category;
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchName && matchCat && matchStatus;
    });
  }, [search, category, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = filtered.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageItems.length;

  const handleView = (item: DrinkItem) => {
    // TODO: yahan apna view / details logic laga dein
    console.log("View item:", item);
  };

  const handleAdd = () => {
    // TODO: yahan Add Item modal / route open karein
    console.log("Add item clicked");
  };

  return (
    <div
      className="drk-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <header className="drk-header">
        <div className="drk-header-left">
          <div className="drk-header-icon">
            <CupIcon />
          </div>
          <div>
            <h1 className="drk-title">Drinks &amp; Beverages</h1>
            <p className="drk-subtitle">Track and manage drinks and beverages in your fridge.</p>
          </div>
        </div>
        <button type="button" className="drk-btn-primary" onClick={handleAdd}>
          <PlusIcon />
          <span>Add Item</span>
        </button>
      </header>

      {/* Stat cards */}
      <section className="drk-stats">
        {STATS.map((s) => (
          <div key={s.id} className="drk-stat-card">
            <div className={`drk-stat-icon ${s.variant}`}>
              <s.Icon />
            </div>
            <div className="drk-stat-info">
              <span className="drk-stat-title">{s.title}</span>
              <span className="drk-stat-period">{s.period}</span>
              <span className="drk-stat-value">{s.value}</span>
              <span className={`drk-stat-change ${s.tone}`}>
                {s.dir === "up" && <ArrowUpIcon />}
                {s.dir === "down" && <ArrowDownIcon />}
                {s.dir === "flat" && <MinusIcon />}
                <strong>{s.change.replace("-", "")}</strong>
              </span>
              <span className="drk-stat-vs">vs. last month</span>
            </div>
          </div>
        ))}
      </section>

      {/* Table panel */}
      <section className="drk-panel">
        {/* Toolbar */}
        <div className="drk-toolbar">
          <label className="drk-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search drink name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="drk-select-wrap">
            <select
              className="drk-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="drk-select-icon">
              <ChevronDownIcon />
            </span>
          </div>

          <div className="drk-filter">
            <button
              type="button"
              className={`drk-icon-btn ${statusFilter !== "all" ? "is-active" : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filter by status"
              aria-expanded={filterOpen}
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <ul className="drk-filter-menu" role="menu">
                {(["all", "in", "low", "out"] as const).map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={statusFilter === s}
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
        <div className="drk-table-wrap">
          <table className="drk-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="center">Quantity</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="drk-empty">
                    No drinks found. Try a different search or filter.
                  </td>
                </tr>
              ) : (
                pageItems.map((item, i) => (
                  <tr key={item.id}>
                    <td className="muted">{startIndex + i + 1}</td>
                    <td>
                      <div className="drk-item">
                        <span className="drk-thumb">
                          {item.image ? (
                            <img src={item.image} alt="" />
                          ) : (
                            <DrinkThumb pack={item.pack} color={item.color} />
                          )}
                        </span>
                        <span className="item-name">{item.name}</span>
                      </div>
                    </td>
                    <td className="muted">{item.category}</td>
                    <td className="muted">{item.unit}</td>
                    <td className="center">{item.quantity}</td>
                    <td className="center">
                      <span className={`drk-status ${item.status}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="center">
                      <button
                        type="button"
                        className="drk-view-btn"
                        onClick={() => handleView(item)}
                        aria-label={`View ${item.name}`}
                      >
                        <EyeIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="drk-footer">
          <span className="drk-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} items
          </span>

          <div className="drk-pagination">
            <button
              type="button"
              className="drk-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="drk-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`drk-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="drk-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}