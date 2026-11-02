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
  cost_price: number;
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
  cost_price: string | number;
  image: string | null;
}

interface HistoryRow {
  type: "sale" | "restock";
  quantity: number;
  amount: number | null;
  profit: number | null;
  by: string | null;
  created_at: string;
}

// Optional vendor credit fields (sent only when "Purchased from a vendor" is checked)
interface VendorCreditPayload {
  vendor_name?: string;
  invoice_no?: string;
  paid_now?: number;
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

const toNum = (v: string | number) => (typeof v === "string" ? parseFloat(v) : v);

const mapApiDrink = (d: ApiDrink): DrinkItem => {
  const style = CATEGORY_STYLE[d.category] ?? DEFAULT_STYLE;
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    unit: d.unit,
    quantity: d.quantity,
    status: d.status,
    price: toNum(d.price),
    cost_price: toNum(d.cost_price ?? 0),
    image: d.image,
    ...style,
  };
};

const ALL_CATEGORIES = "All Categories";
const NEW_CATEGORY = "__new__";

// Default categories — new categories from items are added automatically
const BASE_CATEGORIES = [
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

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

// Laravel validation errors come as { message, errors: { field: [msg] } }
const extractError = (json: any, fallback: string): string => {
  const first = json?.errors ? (Object.values(json.errors).flat()[0] as string | undefined) : undefined;
  return first ?? json?.message ?? fallback;
};

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
const TrendUpIcon = () => (
  <Icon>
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
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
const EditIcon = () => (
  <Icon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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

/* ---------- Add Drink form state ---------- */
interface DrinkFormState {
  name: string;
  category: string;
  unit: string; // shown as "Size" (ml) in the UI — the backend field is still called unit
  quantity: string;
  low_stock_threshold: string;
  cost_price: string;
  price: string;
}

const EMPTY_FORM: DrinkFormState = {
  name: "",
  category: BASE_CATEGORIES[0],
  unit: "",
  quantity: "",
  low_stock_threshold: "5",
  cost_price: "",
  price: "",
};

const money = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

// "05" -> "5", "007" -> "7", "0.5" stays as is
const stripLeadingZeros = (v: string) => v.replace(/^0+(?=\d)/, "");

// The stat card value font shrinks with the length of the amount so the full amount stays visible
const statValueFontSize = (v: string | number) => {
  const len = String(v).length;
  if (len <= 6) return undefined;
  if (len <= 9) return "1.4rem";
  if (len <= 12) return "1.15rem";
  return "1rem";
};

/* ---------- Vendor credit fields (shared by Add + Restock modals) ---------- */
interface VendorCreditFieldsProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  vendorName: string;
  onVendorName: (value: string) => void;
  invoiceNo: string;
  onInvoiceNo: (value: string) => void;
  paidNow: string;
  onPaidNow: (value: string) => void;
  totalBill: number | null;
}

const VendorCreditFields: React.FC<VendorCreditFieldsProps> = ({
  enabled,
  onToggle,
  vendorName,
  onVendorName,
  invoiceNo,
  onInvoiceNo,
  paidNow,
  onPaidNow,
  totalBill,
}) => {
  const paid = Number(paidNow) || 0;
  const remaining = totalBill !== null ? Math.max(totalBill - paid, 0) : null;

  return (
    <div
      style={{
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>Purchased from a vendor? (Credit Purchase)</span>
      </label>

      {enabled && (
        <>
          <div className="drk-form-row">
            <div className="drk-form-group">
              <label>Vendor Name *</label>
              <input
                type="text"
                placeholder="e.g. Ahmed Malik"
                value={vendorName}
                onChange={(e) => onVendorName(e.target.value)}
              />
            </div>
            <div className="drk-form-group">
              <label>Invoice Number *</label>
              <input
                type="text"
                placeholder="Unique invoice #"
                value={invoiceNo}
                onChange={(e) => onInvoiceNo(e.target.value)}
              />
            </div>
          </div>

          <div className="drk-form-group">
            <label>Paid Now (Rs)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0 = full credit"
              value={paidNow}
              onChange={(e) => onPaidNow(stripLeadingZeros(e.target.value))}
            />
          </div>

          <small style={{ opacity: 0.75, fontSize: 12 }}>
            {totalBill !== null
              ? `Total bill: ${money(totalBill)} • Remaining credit: ${money(remaining ?? 0)}`
              : "Enter quantity and cost price to see the total bill."}{" "}
            Pay the remaining amount later from the Credit page.
          </small>
        </>
      )}
    </div>
  );
};

/* ---------- Page ---------- */
export default function DrinksBeverages() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [items, setItems] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<DrinkFormState>(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Add modal: vendor credit
  const [addCredit, setAddCredit] = useState(false);
  const [addVendorName, setAddVendorName] = useState("");
  const [addInvoiceNo, setAddInvoiceNo] = useState("");
  const [addPaidNow, setAddPaidNow] = useState("");

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<DrinkItem | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Restock modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItem, setRestockItem] = useState<DrinkItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockCost, setRestockCost] = useState("");
  const [restockError, setRestockError] = useState<string | null>(null);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  // Restock modal: vendor credit
  const [restockCredit, setRestockCredit] = useState(false);
  const [restockVendorName, setRestockVendorName] = useState("");
  const [restockInvoiceNo, setRestockInvoiceNo] = useState("");
  const [restockPaidNow, setRestockPaidNow] = useState("");

  // Edit price modal (cost_price / price, without touching stock)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<DrinkItem | null>(null);
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");

  const canManageDrinks = role === "admin" || role === "frontdesk";
  const canEditDrink = role === "admin"; // the PUT /drinks/{drink} route is admin-only

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
      setError("Could not load drinks. Please try again.");
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

  // Default categories + all categories in the DB (without duplicates)
  const formCategories = useMemo(() => {
    const list = [...BASE_CATEGORIES];
    items.forEach((i) => {
      const c = i.category?.trim();
      if (c && !list.some((x) => x.toLowerCase() === c.toLowerCase())) list.push(c);
    });
    return list;
  }, [items]);

  const filterCategories = useMemo(() => [ALL_CATEGORIES, ...formCategories], [formCategories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchName = !q || item.name.toLowerCase().includes(q);
      const matchCat = category === ALL_CATEGORIES || item.category === category;
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

  // Profit if all current stock is sold: (selling price - cost price) * quantity
  const totalProfit = useMemo(
    () => items.reduce((sum, i) => sum + (i.price - i.cost_price) * i.quantity, 0),
    [items]
  );

  const STATS = [
    { id: "total", title: "Total Items", period: "All time", value: items.length, variant: "red", Icon: BoxIcon },
    { id: "in", title: "In Stock", period: "Right now", value: countBy("in"), variant: "green", Icon: CheckBoxIcon },
    { id: "low", title: "Low Stock", period: "Right now", value: countBy("low"), variant: "amber", Icon: AlertIcon },
    { id: "out", title: "Out of Stock", period: "Right now", value: countBy("out"), variant: "orange", Icon: BanIcon },
    {
      id: "profit",
      title: "Profit",
      period: "If all stock sold",
      value: money(totalProfit),
      variant: "purple",
      Icon: TrendUpIcon,
    },
  ] as const;

  /* ---------- Header actions ---------- */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDrinks();
    } finally {
      setRefreshing(false);
    }
  };

  // Excel export (no extra library): downloads an .xls file built from an HTML table
  const handleExportExcel = () => {
    const rows = filtered
      .map(
        (item, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(
            item.category
          )}</td><td>${escapeHtml(item.unit)}</td><td>${item.quantity}</td><td>${item.cost_price}</td><td>${
            item.price
          }</td><td>${escapeHtml(STATUS_LABEL[item.status])}</td></tr>`
      )
      .join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>#</th><th>Item Name</th><th>Category</th><th>Size</th><th>Quantity</th><th>Cost (Rs)</th><th>Price (Rs)</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drinks-${todayISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF export (no extra library): opens the print dialog, choose "Save as PDF"
  const handleExportPdf = () => {
    const rows = filtered
      .map(
        (item, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(
            item.category
          )}</td><td>${escapeHtml(item.unit)}</td><td style="text-align:center">${
            item.quantity
          }</td><td style="text-align:center">${escapeHtml(
            money(item.cost_price)
          )}</td><td style="text-align:center">${escapeHtml(
            money(item.price)
          )}</td><td style="text-align:center">${escapeHtml(STATUS_LABEL[item.status])}</td></tr>`
      )
      .join("");

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Drinks &amp; Beverages</title>
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
<h1>Drinks &amp; Beverages</h1>
<p>Generated on ${escapeHtml(todayISO())} &middot; ${filtered.length} items</p>
<table>
<thead><tr><th>#</th><th>Item Name</th><th>Category</th><th>Size</th><th style="text-align:center">Quantity</th><th style="text-align:center">Cost</th><th style="text-align:center">Price</th><th style="text-align:center">Status</th></tr></thead>
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

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setCustomCategory("");
    setFormError(null);
    setAddCredit(false);
    setAddVendorName("");
    setAddInvoiceNo("");
    setAddPaidNow("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setShowAddModal(false);
  };

  const handleFormChange = (field: keyof DrinkFormState, value: string) => {
    // No leading zeros in number fields, so a 0 is easy to remove
    const numericFields: (keyof DrinkFormState)[] = ["quantity", "low_stock_threshold", "cost_price", "price"];
    const next = numericFields.includes(field) ? stripLeadingZeros(value) : value;
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  // Total bill for the Add modal = quantity x cost price
  const addTotalBill =
    form.quantity !== "" && form.cost_price !== "" && Number(form.quantity) > 0
      ? Number(form.quantity) * Number(form.cost_price)
      : null;

  const handleAddDrink = async () => {
    setFormError(null);

    // Final category: either the one from the dropdown or a newly typed one
    let finalCategory = form.category;
    if (form.category === NEW_CATEGORY) {
      const typed = customCategory.trim();
      if (!typed) {
        setFormError("Please enter the new category name.");
        return;
      }
      // If it already exists, reuse its spelling/case
      finalCategory =
        formCategories.find((c) => c.toLowerCase() === typed.toLowerCase()) ?? typed;
    }

    if (
      !form.name.trim() ||
      !form.unit.trim() ||
      form.quantity === "" ||
      form.price === "" ||
      form.cost_price === ""
    ) {
      setFormError("Name, Size, Quantity, Cost Price and Selling Price are required.");
      return;
    }

    // Vendor credit checks
    let creditPayload: VendorCreditPayload = {};
    if (addCredit) {
      if (Number(form.quantity) < 1) {
        setFormError("For a vendor purchase, quantity must be at least 1.");
        return;
      }
      if (!addVendorName.trim()) {
        setFormError("Please enter the vendor name.");
        return;
      }
      if (!addInvoiceNo.trim()) {
        setFormError("Please enter the invoice number.");
        return;
      }
      const paid = addPaidNow.trim() === "" ? 0 : Number(addPaidNow);
      if (Number.isNaN(paid) || paid < 0) {
        setFormError("Paid Now must be 0 or more.");
        return;
      }
      if (paid > (addTotalBill ?? 0)) {
        setFormError("Paid Now cannot be more than the total bill.");
        return;
      }
      creditPayload = {
        vendor_name: addVendorName.trim(),
        invoice_no: addInvoiceNo.trim(),
        paid_now: paid,
      };
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
          category: finalCategory,
          unit: form.unit.trim(),
          quantity: Number(form.quantity),
          low_stock_threshold: Number(form.low_stock_threshold || 5),
          cost_price: Number(form.cost_price),
          price: Number(form.price),
          ...creditPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(extractError(data, "Could not add the item."));
        return;
      }

      setShowAddModal(false);
      fetchDrinks();
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong. Please try again.");
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
        alert(data?.message ?? "Could not complete the sale.");
        return;
      }
      const { drink } = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantity: drink.quantity, status: drink.status } : i))
      );
      // If the history modal is open for this item, refresh it too
      if (historyOpen && historyItem?.id === item.id) {
        handleView({ ...item, quantity: drink.quantity, status: drink.status });
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    }
  };

  const handleView = async (item: DrinkItem) => {
    setHistoryItem(item);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/drinks/${item.id}/history`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load history");
      const data: HistoryRow[] = await res.json();
      setHistoryRows(data);
    } catch (err) {
      console.error(err);
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryItem(null);
    setHistoryRows([]);
  };

  const openRestockModal = (item: DrinkItem) => {
    setRestockItem(item);
    setRestockQty("");
    setRestockCost(item.cost_price ? String(item.cost_price) : "");
    setRestockError(null);
    setRestockCredit(false);
    setRestockVendorName("");
    setRestockInvoiceNo("");
    setRestockPaidNow("");
    setShowRestockModal(true);
  };

  const closeRestockModal = () => {
    if (restockSubmitting) return;
    setShowRestockModal(false);
    setRestockItem(null);
  };

  // Total bill for the Restock modal = quantity x cost price (typed one, else the item's current one)
  const restockUnitCost =
    restockCost !== "" ? Number(restockCost) : restockItem ? restockItem.cost_price : 0;
  const restockTotalBill =
    Number(restockQty) > 0 && !Number.isNaN(restockUnitCost) ? Number(restockQty) * restockUnitCost : null;

  const handleRestock = async () => {
    if (!restockItem) return;
    if (!restockQty || Number(restockQty) <= 0) {
      setRestockError("Please enter a valid quantity.");
      return;
    }

    // Vendor credit checks
    let creditPayload: VendorCreditPayload = {};
    if (restockCredit) {
      if (!restockVendorName.trim()) {
        setRestockError("Please enter the vendor name.");
        return;
      }
      if (!restockInvoiceNo.trim()) {
        setRestockError("Please enter the invoice number.");
        return;
      }
      const paid = restockPaidNow.trim() === "" ? 0 : Number(restockPaidNow);
      if (Number.isNaN(paid) || paid < 0) {
        setRestockError("Paid Now must be 0 or more.");
        return;
      }
      if (paid > (restockTotalBill ?? 0)) {
        setRestockError("Paid Now cannot be more than the total bill.");
        return;
      }
      creditPayload = {
        vendor_name: restockVendorName.trim(),
        invoice_no: restockInvoiceNo.trim(),
        paid_now: paid,
      };
    }

    setRestockSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/drinks/${restockItem.id}/restock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          quantity: Number(restockQty),
          cost_price: restockCost === "" ? undefined : Number(restockCost),
          ...creditPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRestockError(extractError(data, "Could not restock."));
        return;
      }

      setShowRestockModal(false);
      fetchDrinks();
    } catch (err) {
      console.error(err);
      setRestockError("Something went wrong. Please try again.");
    } finally {
      setRestockSubmitting(false);
    }
  };

  const openEditModal = (item: DrinkItem) => {
    setEditItem(item);
    setEditCostPrice(String(item.cost_price));
    setEditPrice(String(item.price));
    setEditError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setShowEditModal(false);
    setEditItem(null);
  };

  const handleUpdateDrink = async () => {
    if (!editItem) return;
    if (editCostPrice === "" || editPrice === "") {
      setEditError("Cost Price and Selling Price are required.");
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/drinks/${editItem.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          cost_price: Number(editCostPrice),
          price: Number(editPrice),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEditError(data?.message ?? "Could not update the price.");
        return;
      }

      setShowEditModal(false);
      fetchDrinks();
    } catch (err) {
      console.error(err);
      setEditError("Something went wrong. Please try again.");
    } finally {
      setEditSubmitting(false);
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
          {canManageDrinks && (
            <button type="button" className="drk-btn-primary" onClick={openAddModal}>
              <PlusIcon />
              <span>Add Item</span>
            </button>
          )}
        </div>
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
              <span
                className="drk-stat-value"
                title={String(s.value)}
                style={{
                  overflow: "visible",
                  textOverflow: "clip",
                  whiteSpace: "nowrap",
                  fontSize: statValueFontSize(s.value),
                }}
              >
                {s.value}
              </span>
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
              {filterCategories.map((c) => (
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
                <th>Size</th>
                <th className="center">Quantity</th>
                <th className="center">Cost</th>
                <th className="center">Price</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="drk-empty">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="drk-empty">
                    {error}
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="drk-empty">
                    No drinks found. Try a different search or filter.
                  </td>
                </tr>
              ) : (
                pageItems.map((item, i) => (
                  <tr key={item.id}>
                    <td className="muted">{startIndex + i + 1}</td>
                    <td>
                      <div className="drk-item">
                        <span className="item-name">{item.name}</span>
                      </div>
                    </td>
                    <td className="muted">{item.category}</td>
                    <td className="muted">{item.unit}</td>
                    <td className="center">{item.quantity}</td>
                    <td className="center muted">{money(item.cost_price)}</td>
                    <td className="center">{money(item.price)}</td>
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
                          aria-label={`View ${item.name} history`}
                        >
                          <EyeIcon />
                        </button>
                        {canManageDrinks && (
                          <>
                            <button
                              type="button"
                              className="drk-view-btn"
                              onClick={() => handleSell(item)}
                              disabled={item.quantity <= 0}
                              aria-label={`Sell ${item.name}`}
                            >
                              Sell
                            </button>
                            <button
                              type="button"
                              className="drk-view-btn"
                              onClick={() => openRestockModal(item)}
                              aria-label={`Restock ${item.name}`}
                            >
                              Restock
                            </button>
                          </>
                        )}
                        {canEditDrink && (
                          <button
                            type="button"
                            className="drk-view-btn"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.name} price`}
                          >
                            <EditIcon />
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
                    {formCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ Add new category...</option>
                  </select>
                </div>
                <div className="drk-form-group">
                  <label>Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 250ml"
                    value={form.unit}
                    onChange={(e) => handleFormChange("unit", e.target.value)}
                  />
                </div>
              </div>

              {form.category === NEW_CATEGORY && (
                <div className="drk-form-group">
                  <label>New Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Protein Bar, Chocolate"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="drk-form-row">
                <div className="drk-form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 24"
                    value={form.quantity}
                    onChange={(e) => handleFormChange("quantity", e.target.value)}
                  />
                </div>
                <div className="drk-form-group">
                  <label>Low Stock Alert At</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 5"
                    value={form.low_stock_threshold}
                    onChange={(e) => handleFormChange("low_stock_threshold", e.target.value)}
                  />
                </div>
              </div>

              <div className="drk-form-row">
                <div className="drk-form-group">
                  <label>Cost Price (purchase, per unit)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 150"
                    value={form.cost_price}
                    onChange={(e) => handleFormChange("cost_price", e.target.value)}
                  />
                </div>
                <div className="drk-form-group">
                  <label>Selling Price (per unit)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 180"
                    value={form.price}
                    onChange={(e) => handleFormChange("price", e.target.value)}
                  />
                </div>
              </div>

              <VendorCreditFields
                enabled={addCredit}
                onToggle={setAddCredit}
                vendorName={addVendorName}
                onVendorName={setAddVendorName}
                invoiceNo={addInvoiceNo}
                onInvoiceNo={setAddInvoiceNo}
                paidNow={addPaidNow}
                onPaidNow={setAddPaidNow}
                totalBill={addTotalBill}
              />

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

      {/* Restock Modal */}
      {showRestockModal && restockItem && (
        <div className="drk-modal-overlay" onClick={closeRestockModal}>
          <div className="drk-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="drk-modal-header">
              <h2>Restock — {restockItem.name}</h2>
              <button className="drk-modal-close" onClick={closeRestockModal} aria-label="Close">
                <XIcon />
              </button>
            </div>

            <div className="drk-modal-body">
              <div className="drk-form-group">
                <label>Quantity to Add</label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 24"
                  value={restockQty}
                  onChange={(e) => setRestockQty(stripLeadingZeros(e.target.value))}
                />
              </div>
              <div className="drk-form-group">
                <label>New Cost Price (optional, if it changed)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={String(restockItem.cost_price)}
                  value={restockCost}
                  onChange={(e) => setRestockCost(stripLeadingZeros(e.target.value))}
                />
              </div>

              <VendorCreditFields
                enabled={restockCredit}
                onToggle={setRestockCredit}
                vendorName={restockVendorName}
                onVendorName={setRestockVendorName}
                invoiceNo={restockInvoiceNo}
                onInvoiceNo={setRestockInvoiceNo}
                paidNow={restockPaidNow}
                onPaidNow={setRestockPaidNow}
                totalBill={restockTotalBill}
              />

              {restockError && <p className="drk-form-error">{restockError}</p>}
            </div>

            <div className="drk-modal-footer">
              <button className="drk-btn-secondary" onClick={closeRestockModal} disabled={restockSubmitting}>
                Cancel
              </button>
              <button className="drk-btn-primary" onClick={handleRestock} disabled={restockSubmitting}>
                {restockSubmitting ? "Adding..." : "Add Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Price Modal — only cost_price / price, does not touch stock quantity */}
      {showEditModal && editItem && (
        <div className="drk-modal-overlay" onClick={closeEditModal}>
          <div className="drk-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="drk-modal-header">
              <h2>Edit Price — {editItem.name}</h2>
              <button className="drk-modal-close" onClick={closeEditModal} aria-label="Close">
                <XIcon />
              </button>
            </div>

            <div className="drk-modal-body">
              <div className="drk-form-group">
                <label>Cost Price (purchase, per unit)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 150"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(stripLeadingZeros(e.target.value))}
                />
              </div>
              <div className="drk-form-group">
                <label>Selling Price (per unit)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 180"
                  value={editPrice}
                  onChange={(e) => setEditPrice(stripLeadingZeros(e.target.value))}
                />
              </div>
              {editError && <p className="drk-form-error">{editError}</p>}
            </div>

            <div className="drk-modal-footer">
              <button className="drk-btn-secondary" onClick={closeEditModal} disabled={editSubmitting}>
                Cancel
              </button>
              <button className="drk-btn-primary" onClick={handleUpdateDrink} disabled={editSubmitting}>
                {editSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && historyItem && (
        <div className="drk-modal-overlay" onClick={closeHistory}>
          <div className="drk-modal-card drk-history-card" onClick={(e) => e.stopPropagation()}>
            <div className="drk-modal-header">
              <h2>{historyItem.name} — History</h2>
              <button className="drk-modal-close" onClick={closeHistory} aria-label="Close">
                <XIcon />
              </button>
            </div>

            <div className="drk-history-body">
              {historyLoading ? (
                <p className="drk-empty">Loading...</p>
              ) : historyRows.length === 0 ? (
                <p className="drk-empty">No sales or restocks yet.</p>
              ) : (
                <table className="drk-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="center">Qty</th>
                      <th className="center">Amount</th>
                      <th className="center">Profit</th>
                      <th>By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`drk-history-tag ${row.type}`}>
                            {row.type === "sale" ? "Sold" : "Restocked"}
                          </span>
                        </td>
                        <td className="center">{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</td>
                        <td className="center">{row.amount !== null ? money(row.amount) : "—"}</td>
                        <td className="center">
                          {row.profit !== null ? (
                            <span className={row.profit >= 0 ? "drk-profit-pos" : "drk-profit-neg"}>
                              {money(row.profit)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="muted">{row.by ?? "—"}</td>
                        <td className="muted">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}