import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../../config";
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
  price: number;
  pack: Pack;
  color: string;
  image?: string | null;
}

interface ApiDrink {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  status: Status;
  price: string | number;
  image: string | null;
}

const CATEGORY_STYLE: Record<string, { pack: Pack; color: string }> = {
  "Energy Drink": { pack: "can", color: "#3ddc4a" },
  "Sports Drink": { pack: "bottle", color: "#ff9a1f" },
  "Soft Drink": { pack: "can", color: "#ff2a3d" },
  Water: { pack: "bottle", color: "#5cc8ff" },
  "Health Drink": { pack: "bottle", color: "#ff7a2f" },
  Tea: { pack: "bottle", color: "#ff5a1f" },
  "Protein Drink": { pack: "bottle", color: "#c98a6a" },
};
const DEFAULT_STYLE: { pack: Pack; color: string } = { pack: "can", color: "#8a8a93" };

const mapApiDrink = (d: ApiDrink): DrinkItem => {
  const style = CATEGORY_STYLE[d.category] ?? DEFAULT_STYLE;
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    unit: d.unit,
    quantity: d.quantity,
    status: d.status,
    price: typeof d.price === "string" ? parseFloat(d.price) : d.price,
    image: d.image,
    ...style,
  };
};

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

const FORM_CATEGORIES = CATEGORIES.filter((c) => c !== "All Categories");

const STATUS_LABEL: Record<Status, string> = {
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

const PAGE_SIZE = 15;
const BOTTOM_GAP = 24;

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
const XIcon = () => (
  <Icon>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

/* ---------- Add Drink form state ---------- */
interface DrinkFormState {
  name: string;
  category: string;
  unit: string;
  quantity: string;
  low_stock_threshold: string;
  price: string;
}

const EMPTY_FORM: DrinkFormState = {
  name: "",
  category: FORM_CATEGORIES[0],
  unit: "",
  quantity: "",
  low_stock_threshold: "5",
  price: "",
};

/* ---------- Page ---------- */
export default function DrinksBeverages() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [items, setItems] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<DrinkFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");

  const canManageDrinks = role === "admin" || role === "frontdesk";

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

  const fetchDrinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/drinks`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to load drinks");
      const data: ApiDrink[] = await res.json();
      setItems(data.map(mapApiDrink));
    } catch (err) {
      console.error(err);
      setError("Drinks load nahi ho sakay. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, category, statusFilter]);

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

  const countBy = (s: Status) => items.filter((i) => i.status === s).length;

  const STATS = [
    { id: "total", title: "Total Items", period: "All time", value: items.length, variant: "red", Icon: BoxIcon },
    { id: "in", title: "In Stock", period: "Right now", value: countBy("in"), variant: "green", Icon: CheckBoxIcon },
    { id: "low", title: "Low Stock", period: "Right now", value: countBy("low"), variant: "amber", Icon: AlertIcon },
    { id: "out", title: "Out of Stock", period: "Right now", value: countBy("out"), variant: "orange", Icon: BanIcon },
  ] as const;

  const handleView = (item: DrinkItem) => {
    console.log("View item:", item);
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setShowAddModal(false);
  };

  const handleFormChange = (field: keyof DrinkFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddDrink = async () => {
    setFormError(null);

    if (!form.name.trim() || !form.unit.trim() || form.quantity === "" || form.price === "") {
      setFormError("Name, Unit, Quantity aur Price zaroori hain.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/drinks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          unit: form.unit.trim(),
          quantity: Number(form.quantity),
          low_stock_threshold: Number(form.low_stock_threshold || 5),
          price: Number(form.price),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.message ?? "Item add nahi ho saka.");
        return;
      }

      setShowAddModal(false);
      fetchDrinks();
    } catch (err) {
      console.error(err);
      setFormError("Kuch masla ho gaya, dobara try karein.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSell = async (item: DrinkItem) => {
    if (item.quantity <= 0) return;
    try {
      const res = await fetch(`${API_URL}/drinks/${item.id}/sell`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ quantity: 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.message ?? "Sell nahi ho saka");
        return;
      }
      const { drink } = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantity: drink.quantity, status: drink.status } : i))
      );
    } catch (err) {
      console.error(err);
      alert("Kuch masla ho gaya, dobara try karein.");
    }
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
        {canManageDrinks && (
          <button type="button" className="drk-btn-primary" onClick={openAddModal}>
            <PlusIcon />
            <span>Add Item</span>
          </button>
        )}
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="drk-empty">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="drk-empty">
                    {error}
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
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
                        {/* Image / thumb hata diya gaya hai */}
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
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          type="button"
                          className="drk-view-btn"
                          onClick={() => handleView(item)}
                          aria-label={`View ${item.name}`}
                        >
                          <EyeIcon />
                        </button>
                        {canManageDrinks && (
                          <button
                            type="button"
                            className="drk-view-btn"
                            onClick={() => handleSell(item)}
                            disabled={item.quantity <= 0}
                            aria-label={`Sell ${item.name}`}
                          >
                            Sell
                          </button>
                        )}
                      </div>
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

      {/* Add Drink Modal */}
      {showAddModal && (
        <div className="drk-modal-overlay" onClick={closeAddModal}>
          <div className="drk-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="drk-modal-header">
              <h2>Add New Drink</h2>
              <button className="drk-modal-close" onClick={closeAddModal} aria-label="Close">
                <XIcon />
              </button>
            </div>

            <div className="drk-modal-body">
              <div className="drk-form-group">
                <label>Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Red Bull"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="drk-form-row">
                <div className="drk-form-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleFormChange("category", e.target.value)}
                  >
                    {FORM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="drk-form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. Can (250ml)"
                    value={form.unit}
                    onChange={(e) => handleFormChange("unit", e.target.value)}
                  />
                </div>
              </div>

              <div className="drk-form-row">
                <div className="drk-form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) => handleFormChange("quantity", e.target.value)}
                  />
                </div>
                <div className="drk-form-group">
                  <label>Low Stock Alert At</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="5"
                    value={form.low_stock_threshold}
                    onChange={(e) => handleFormChange("low_stock_threshold", e.target.value)}
                  />
                </div>
              </div>

              <div className="drk-form-group">
                <label>Price (per unit)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => handleFormChange("price", e.target.value)}
                />
              </div>

              {formError && <p className="drk-form-error">{formError}</p>}
            </div>

            <div className="drk-modal-footer">
              <button className="drk-btn-secondary" onClick={closeAddModal} disabled={submitting}>
                Cancel
              </button>
              <button className="drk-btn-primary" onClick={handleAddDrink} disabled={submitting}>
                {submitting ? "Adding..." : "Add Drink"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}