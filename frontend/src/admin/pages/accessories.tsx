import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../../config";
import "./accessories.css";

/* ---------- Types ---------- */
type Status = "in" | "low" | "out";

interface AccessoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
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

/* ---------- Helpers ---------- */
const CATEGORIES = ["All Categories", "Dumbbells", "Rods", "Attachments", "Weights", "Accessories"];

const STATUS_LABEL: Record<Status, string> = {
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

const PAGE_SIZE = 15;
const BOTTOM_GAP = 24;

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

/* ---------- Page ---------- */
export default function Accessories() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, in: 0, low: 0, out: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessoryItem | null>(null);
  const [viewing, setViewing] = useState<AccessoryItem | null>(null);

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

  useEffect(() => {
    loadItems();
  }, []);

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
    if (!window.confirm(`"${item.name}" ko delete kar dein?`)) return;
    try {
      const res = await fetch(`${API_URL}/accessories/${item.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await loadItems();
    } catch {
      alert("Item delete nahi ho saka.");
    }
  };

  const handleSave = async (data: Omit<AccessoryItem, "id" | "status">, id?: number) => {
    const url = id ? `${API_URL}/accessories/${id}` : `${API_URL}/accessories`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? "Save nahi ho saka.");
    await loadItems();
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

      {/* Stat cards */}
      <section className="acc-stats">
        <div className="acc-stat-card">
          <div className="acc-stat-icon red"><BoxIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Total Items</span>
            <span className="acc-stat-period">All time</span>
            <span className="acc-stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="acc-stat-card">
          <div className="acc-stat-icon green"><CheckBoxIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">In Stock</span>
            <span className="acc-stat-period">Right now</span>
            <span className="acc-stat-value">{stats.in}</span>
          </div>
        </div>

        <div className="acc-stat-card">
          <div className="acc-stat-icon amber"><AlertIcon /></div>
          <div className="acc-stat-info">
            <span className="acc-stat-title">Low Stock</span>
            <span className="acc-stat-period">Right now</span>
            <span className="acc-stat-value">{stats.low}</span>
          </div>
        </div>

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
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="acc-empty">Loading...</td>
                </tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="acc-empty">
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
                        onClick={() => setViewing(item)}
                        aria-label={`View ${item.name}`}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="acc-view-btn"
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.name}`}
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

      {/* View Modal */}
      {viewing && (
        <div className="acc-modal-overlay" onClick={() => setViewing(null)}>
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
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
  onSave: (data: Omit<AccessoryItem, "id" | "status">, id?: number) => Promise<void>;
}

const AccessoryModal: React.FC<AccessoryModalProps> = ({ editing, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    category: editing?.category ?? "Dumbbells",
    quantity: editing?.quantity ?? 0,
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Item ka naam likhein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          name: form.name.trim(),
          category: form.category,
          quantity: Number(form.quantity) || 0,
          notes: form.notes.trim() || null,
        },
        editing?.id
      );
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
              <label>Quantity</label>
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => update("quantity", Number(e.target.value))}
              />
            </div>
          </div>

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