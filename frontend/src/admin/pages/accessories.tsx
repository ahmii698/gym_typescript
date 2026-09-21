import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./accessories.css";

/* ---------- Types ---------- */
type Status = "in" | "low" | "out";

interface AccessoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  status: Status;
  image?: string; // optional: image URL. Agar nahi diya to default icon dikhega
}

/* ---------- Data ---------- */
const BASE_ITEMS: Omit<AccessoryItem, "id">[] = [
  { name: "Dumbbell 2kg", category: "Dumbbells", quantity: 9, status: "in" },
  { name: "Dumbbell 3kg", category: "Dumbbells", quantity: 6, status: "in" },
  { name: "Dumbbell 5kg", category: "Dumbbells", quantity: 8, status: "in" },
  { name: "Dumbbell 10kg", category: "Dumbbells", quantity: 4, status: "in" },
  { name: "Barbell Rod (7ft)", category: "Rods", quantity: 3, status: "in" },
  { name: "Curl Rod", category: "Rods", quantity: 5, status: "in" },
  { name: "Tricep Rope", category: "Attachments", quantity: 7, status: "in" },
  { name: "Lat Pulldown Bar", category: "Attachments", quantity: 4, status: "in" },
  { name: "Weight Plates 5kg", category: "Weights", quantity: 12, status: "in" },
  { name: "Weight Plates 10kg", category: "Weights", quantity: 8, status: "in" },
  { name: "Yoga Mat", category: "Accessories", quantity: 10, status: "in" },
  { name: "Resistance Band", category: "Accessories", quantity: 6, status: "in" },
  { name: "Ab Roller", category: "Accessories", quantity: 3, status: "low" },
  { name: "Push Up Bar", category: "Accessories", quantity: 2, status: "low" },
  { name: "Gym Gloves", category: "Accessories", quantity: 0, status: "out" },
  // ---- page 2 & 3 (total 45 items) ----
  { name: "Dumbbell 7kg", category: "Dumbbells", quantity: 5, status: "in" },
  { name: "Dumbbell 12kg", category: "Dumbbells", quantity: 4, status: "in" },
  { name: "Dumbbell 15kg", category: "Dumbbells", quantity: 3, status: "low" },
  { name: "Dumbbell 20kg", category: "Dumbbells", quantity: 6, status: "in" },
  { name: "EZ Curl Bar", category: "Rods", quantity: 4, status: "in" },
  { name: "Olympic Bar (5ft)", category: "Rods", quantity: 2, status: "low" },
  { name: "Trap Bar", category: "Rods", quantity: 3, status: "in" },
  { name: "Straight Bar Attachment", category: "Attachments", quantity: 6, status: "in" },
  { name: "V-Grip Handle", category: "Attachments", quantity: 5, status: "in" },
  { name: "Ankle Strap", category: "Attachments", quantity: 8, status: "in" },
  { name: "Weight Plates 2.5kg", category: "Weights", quantity: 14, status: "in" },
  { name: "Weight Plates 15kg", category: "Weights", quantity: 6, status: "in" },
  { name: "Weight Plates 20kg", category: "Weights", quantity: 4, status: "in" },
  { name: "Kettlebell 8kg", category: "Weights", quantity: 5, status: "in" },
  { name: "Kettlebell 12kg", category: "Weights", quantity: 3, status: "low" },
  { name: "Jump Rope", category: "Accessories", quantity: 9, status: "in" },
  { name: "Foam Roller", category: "Accessories", quantity: 5, status: "in" },
  { name: "Lifting Belt", category: "Accessories", quantity: 4, status: "in" },
  { name: "Wrist Wraps", category: "Accessories", quantity: 7, status: "in" },
  { name: "Gym Towel", category: "Accessories", quantity: 15, status: "in" },
  { name: "Shaker Bottle", category: "Accessories", quantity: 11, status: "in" },
  { name: "Ankle Weights", category: "Accessories", quantity: 0, status: "out" },
  { name: "Medicine Ball", category: "Weights", quantity: 6, status: "in" },
  { name: "Ab Wheel Mat", category: "Accessories", quantity: 8, status: "in" },
  { name: "Pull Up Assist Band", category: "Accessories", quantity: 5, status: "in" },
  { name: "Barbell Collar", category: "Attachments", quantity: 10, status: "in" },
  { name: "Dip Belt", category: "Attachments", quantity: 4, status: "in" },
  { name: "Cable Rope Handle", category: "Attachments", quantity: 6, status: "in" },
  { name: "Speed Rope", category: "Accessories", quantity: 7, status: "in" },
  { name: "Grip Trainer", category: "Accessories", quantity: 9, status: "in" },
];

const ITEMS: AccessoryItem[] = BASE_ITEMS.map((item, i) => ({ id: i + 1, ...item }));

const CATEGORIES = ["All Categories", "Dumbbells", "Rods", "Attachments", "Weights", "Accessories"];

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

/* ---------- Stat cards (same structure as Members page) ---------- */
const countBy = (s: Status) => ITEMS.filter((i) => i.status === s).length;

const STATS = [
  {
    id: "total",
    title: "Total Items",
    period: "All time",
    value: ITEMS.length,
    change: "+5%",
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
    change: "+8%",
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
    change: "-17%",
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
export default function Accessories() {
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

  const handleView = (item: AccessoryItem) => {
    // TODO: yahan apna view / details logic laga dein
    console.log("View item:", item);
  };

  const handleAdd = () => {
    // TODO: yahan Add Item modal / route open karein
    console.log("Add item clicked");
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
        <button type="button" className="acc-btn-primary" onClick={handleAdd}>
          <PlusIcon />
          <span>Add Item</span>
        </button>
      </header>

      {/* Stat cards */}
      <section className="acc-stats">
        {STATS.map((s) => (
          <div key={s.id} className="acc-stat-card">
            <div className={`acc-stat-icon ${s.variant}`}>
              <s.Icon />
            </div>
            <div className="acc-stat-info">
              <span className="acc-stat-title">{s.title}</span>
              <span className="acc-stat-period">{s.period}</span>
              <span className="acc-stat-value">{s.value}</span>
              <span className={`acc-stat-change ${s.tone}`}>
                {s.dir === "up" && <ArrowUpIcon />}
                {s.dir === "down" && <ArrowDownIcon />}
                {s.dir === "flat" && <MinusIcon />}
                <strong>{s.change.replace("-", "")}</strong>
              </span>
              <span className="acc-stat-vs">vs. last month</span>
            </div>
          </div>
        ))}
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
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="acc-select-icon">
              <ChevronDownIcon />
            </span>
          </div>

          <div className="acc-filter">
            <button
              type="button"
              className={`acc-icon-btn ${statusFilter !== "all" ? "is-active" : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filter by status"
              aria-expanded={filterOpen}
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <ul className="acc-filter-menu" role="menu">
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
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Category</th>
                <th className="center">Quantity</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="acc-empty">
                    No accessories found. Try a different search or filter.
                  </td>
                </tr>
              ) : (
                pageItems.map((item, i) => (
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
                    <td className="center">
                      <span className={`acc-status ${item.status}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="center">
                      <button
                        type="button"
                        className="acc-view-btn"
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
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="acc-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`acc-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
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