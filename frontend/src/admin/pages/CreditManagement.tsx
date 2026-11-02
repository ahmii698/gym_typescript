import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_URL } from "../../../config";
import "./CreditManagement.css";

/* ---------- Types ---------- */
interface ProductChip {
  name: string;
  quantity: number;
}

interface VendorRow {
  id: number;
  name: string;
  phone: string | null;
  products: ProductChip[];
  total_qty: number;
  total_orders: number;
  total_amount: number;
  total_paid: number;
  total_balance: number;
}

interface ListSummary {
  total_vendors: number;
  total_amount: number;
  total_paid: number;
  total_balance: number;
  pending_count: number;
}

interface HistoryInvoice {
  id: number;
  invoice_no: string;
  date: string;
  source_type: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
}

interface HistoryRecord {
  purchase_id: number;
  invoice_no: string;
  date: string;
  product: string;
  quantity: number;
  total: number;
}

interface HistoryPayment {
  id: number;
  invoice_no: string | null;
  amount: number;
  note: string | null;
  date: string;
}

interface HistoryData {
  vendor: { id: number; name: string };
  summary: {
    total_orders: number;
    total_amount: number;
    total_paid: number;
    balance: number;
  };
  invoices: HistoryInvoice[];
  records: HistoryRecord[];
  payments: HistoryPayment[];
}

/* ---------- Helpers ---------- */
const PAGE_SIZE = 15;
const BOTTOM_GAP = 24;

const money = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return `Rs. ${(Number.isNaN(v) ? 0 : v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// "05" -> "5", "007" -> "7", "0.5" stays as is
const stripLeadingZeros = (v: string) => v.replace(/^0+(?=\d)/, "");

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Laravel validation errors come as { message, errors: { field: [msg] } }
const extractError = (json: any, fallback: string): string => {
  const first = json?.errors ? (Object.values(json.errors).flat()[0] as string | undefined) : undefined;
  return first ?? json?.message ?? fallback;
};

const escapeHtml = (v: string | number): string =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const productsText = (products: ProductChip[]): string =>
  products.map((p) => `${p.name} x ${p.quantity}`).join(", ");

/* ---------- Icons ---------- */
const Icon = ({ children, strokeWidth = 1.8 }: { children: React.ReactNode; strokeWidth?: number }) => (
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

const CardIcon = () => (
  <Icon>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19M6 15h4" />
  </Icon>
);
const DollarIcon = () => (
  <Icon>
    <path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.5 0-4 1.2-4 3s1.4 2.6 4 3 4 1.3 4 3.2c0 1.9-1.7 3.3-4 3.3-2.4 0-4.2-1-4.7-2.7" />
  </Icon>
);
const CheckCircleIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Icon>
);
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const EditIcon = () => (
  <Icon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </Icon>
);
const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);
const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
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
const BoxIcon = () => (
  <Icon>
    <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
  </Icon>
);
const InboxIcon = () => (
  <Icon>
    <path d="M4 13l2.5-7h11L20 13M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5M4 13h4.5l1 2h5l1-2H20" />
  </Icon>
);

/* ---------- Page ---------- */
export default function CreditManagement() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const role = localStorage.getItem("role");
  const canDelete = role === "admin";

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [summary, setSummary] = useState<ListSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // History modal
  const [historyVendor, setHistoryVendor] = useState<VendorRow | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Pay Now modal
  const [payVendor, setPayVendor] = useState<VendorRow | null>(null);

  // Add / Edit vendor modal
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);

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

  /* ---------- Load list ---------- */
  const loadVendors = async (q: string) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${API_URL}/credit/vendors?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setVendors(json.data ?? []);
      setSummary(json.summary ?? null);
    } catch {
      setError("Could not load credit data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Debounced: loads on first render and whenever the search text changes
  useEffect(() => {
    const t = setTimeout(() => {
      loadVendors(search);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const reload = () => loadVendors(search);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadVendors(search);
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------- History ---------- */
  const openHistory = async (vendor: VendorRow) => {
    setHistoryVendor(vendor);
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/credit/vendors/${vendor.id}/history`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const json: HistoryData = await res.json();
      setHistory(json);
    } catch {
      setHistoryError("Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryVendor(null);
    setHistory(null);
    setHistoryError(null);
  };

  /* ---------- Actions ---------- */
  const handlePay = async (vendorId: number, amount: number, note: string | null) => {
    const res = await fetch(`${API_URL}/credit/vendors/${vendorId}/pay`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractError(json, "Payment could not be saved."));
    await reload();
  };

  const handleSaveVendor = async (id: number | null, data: { name: string; phone: string | null }) => {
    const res = await fetch(`${API_URL}/credit/vendors${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractError(json, "Vendor could not be saved."));
    await reload();
  };

  const handleDelete = async (vendor: VendorRow) => {
    if (
      !window.confirm(
        `Delete vendor "${vendor.name}"? All their invoices and payment history will be deleted too.`
      )
    )
      return;
    try {
      const res = await fetch(`${API_URL}/credit/vendors/${vendor.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(extractError(json, "Could not delete the vendor."));
      }
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete the vendor.");
    }
  };

  /* ---------- Exports ---------- */
  const handleExportExcel = () => {
    const rows = vendors
      .map(
        (v) =>
          `<tr><td>${escapeHtml(v.name)}</td><td>${escapeHtml(productsText(v.products))}</td><td>${
            v.total_qty
          }</td><td>${v.total_orders}</td><td>${v.total_amount}</td><td>${v.total_paid}</td><td>${
            v.total_balance
          }</td></tr>`
      )
      .join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>Vendor</th><th>Products</th><th>Total Qty</th><th>Total Orders</th><th>Total Amount (Rs)</th><th>Total Paid (Rs)</th><th>Balance (Rs)</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-management-${todayISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const rows = vendors
      .map(
        (v) =>
          `<tr><td>${escapeHtml(v.name)}</td><td>${escapeHtml(productsText(v.products))}</td><td style="text-align:center">${
            v.total_qty
          }</td><td style="text-align:center">${v.total_orders}</td><td style="text-align:right">${escapeHtml(
            money(v.total_amount)
          )}</td><td style="text-align:right">${escapeHtml(
            money(v.total_paid)
          )}</td><td style="text-align:right">${escapeHtml(money(v.total_balance))}</td></tr>`
      )
      .join("");

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Credit Management</title>
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
<h1>Credit Management</h1>
<p>Generated on ${escapeHtml(todayISO())} &middot; ${vendors.length} vendors &middot; Total balance ${escapeHtml(
      money(summary?.total_balance ?? 0)
    )}</p>
<table>
<thead><tr><th>Vendor</th><th>Products</th><th style="text-align:center">Qty</th><th style="text-align:center">Orders</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead>
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

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(vendors.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = vendors.slice(startIndex, startIndex + PAGE_SIZE);
  const showingFrom = vendors.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageItems.length;

  return (
    <div className="crd-page" ref={pageRef} style={pageHeight ? { height: pageHeight } : undefined}>
      {/* Header */}
      <header className="crd-header">
        <div className="crd-header-left">
          <div className="crd-header-icon">
            <CardIcon />
          </div>
          <div>
            <h1 className="crd-title">Credit Management</h1>
            <p className="crd-subtitle">
              Total Vendors: {summary?.total_vendors ?? 0} | Total Balance: {money(summary?.total_balance ?? 0)}
              {summary && summary.pending_count > 0 && (
                <span className="crd-pending-pill">{summary.pending_count} Pending</span>
              )}
            </p>
          </div>
        </div>

        <div className="crd-header-actions">
          <button
            type="button"
            className="crd-btn crd-btn-blue"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshIcon />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button type="button" className="crd-btn crd-btn-green" onClick={handleExportExcel}>
            <SheetIcon />
            <span>Excel</span>
          </button>
          <button type="button" className="crd-btn crd-btn-redsoft" onClick={handleExportPdf}>
            <DownloadIcon />
            <span>PDF</span>
          </button>
          <button
            type="button"
            className="crd-btn crd-btn-primary"
            onClick={() => {
              setEditingVendor(null);
              setVendorModalOpen(true);
            }}
          >
            <PlusIcon />
            <span>Add Vendor</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="crd-alert" role="alert">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <section className="crd-stats">
        <div className="crd-stat-card">
          <div className="crd-stat-head">
            <span className="crd-stat-icon amber">
              <DollarIcon />
            </span>
            <span className="crd-stat-title">Total Amount</span>
          </div>
          <div className="crd-stat-value">{money(summary?.total_amount ?? 0)}</div>
          <div className="crd-stat-sub">Total vendor liability</div>
        </div>

        <div className="crd-stat-card">
          <div className="crd-stat-head">
            <span className="crd-stat-icon green">
              <CheckCircleIcon />
            </span>
            <span className="crd-stat-title">Total Paid</span>
          </div>
          <div className="crd-stat-value">{money(summary?.total_paid ?? 0)}</div>
          <div className="crd-stat-sub">Total amount paid</div>
        </div>

        <div className="crd-stat-card">
          <div className="crd-stat-head">
            <span className="crd-stat-icon red">
              <CardIcon />
            </span>
            <span className="crd-stat-title">Total Balance</span>
          </div>
          <div className="crd-stat-value">{money(summary?.total_balance ?? 0)}</div>
          <div className="crd-stat-sub">Remaining balance</div>
        </div>
      </section>

      {/* Table panel */}
      <section className="crd-panel">
        <div className="crd-toolbar">
          <label className="crd-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by Vendor Name, Product or Invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="crd-table-wrap">
          <table className="crd-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Products</th>
                <th className="center">Total Qty</th>
                <th className="center">Total Orders</th>
                <th className="right">Total Amount</th>
                <th className="right">Total Paid</th>
                <th className="right">Total Balance</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="crd-empty">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="crd-empty">
                    No vendors found. Add stock with "Purchased from a vendor" ticked, or use Add Vendor.
                  </td>
                </tr>
              )}
              {!loading &&
                pageItems.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="crd-vendor">
                        <span className="crd-vendor-icon">
                          <UserSmallIcon />
                        </span>
                        <span className="crd-vendor-name">{v.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="crd-chips">
                        {v.products.length === 0 && <span className="muted">—</span>}
                        {v.products.map((p) => (
                          <span key={p.name} className="crd-chip">
                            {p.name} × {p.quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="center">{v.total_qty}</td>
                    <td className="center">{v.total_orders}</td>
                    <td className="right strong">{money(v.total_amount)}</td>
                    <td className="right">{money(v.total_paid)}</td>
                    <td className="right">
                      <span className={v.total_balance > 0 ? "crd-balance-due" : "crd-balance-ok"}>
                        {money(v.total_balance)}
                      </span>
                      <span className={`crd-badge ${v.total_balance > 0 ? "due" : "paid"}`}>
                        {v.total_balance > 0 ? "Due" : "Paid"}
                      </span>
                    </td>
                    <td className="center">
                      <div className="crd-actions">
                        <button
                          type="button"
                          className="crd-icon-btn blue"
                          title="View history"
                          aria-label={`View ${v.name} history`}
                          onClick={() => openHistory(v)}
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          className="crd-icon-btn yellow"
                          title="Edit vendor"
                          aria-label={`Edit ${v.name}`}
                          onClick={() => {
                            setEditingVendor(v);
                            setVendorModalOpen(true);
                          }}
                        >
                          <EditIcon />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="crd-icon-btn red"
                            title="Delete vendor"
                            aria-label={`Delete ${v.name}`}
                            onClick={() => handleDelete(v)}
                          >
                            <TrashIcon />
                          </button>
                        )}
                        <button
                          type="button"
                          className="crd-paynow-btn"
                          disabled={v.total_balance <= 0}
                          onClick={() => setPayVendor(v)}
                        >
                          Pay Now
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="crd-footer">
          <span className="crd-showing">
            Showing {showingFrom} to {showingTo} of {vendors.length} entries
          </span>

          <div className="crd-pagination">
            <button
              type="button"
              className="crd-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="crd-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`crd-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="crd-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </section>

      {/* Vendor History modal */}
      {historyVendor && (
        <div className="crd-overlay" onClick={closeHistory}>
          <div className="crd-modal crd-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="crd-modal-head">
              <div>
                <h2 className="crd-modal-title">
                  <EyeIcon /> Vendor History
                </h2>
                <p className="crd-modal-sub">{historyVendor.name}</p>
              </div>
              <button type="button" className="crd-modal-close" onClick={closeHistory} aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="crd-modal-body">
              {historyLoading && <p className="crd-empty-inline">Loading history...</p>}
              {historyError && <div className="crd-alert">{historyError}</div>}

              {history && (
                <HistoryContent history={history} />
              )}
            </div>

            <div className="crd-modal-foot">
              <button type="button" className="crd-btn crd-btn-ghost" onClick={closeHistory}>
                <CloseIcon />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Now modal */}
      {payVendor && (
        <PayModal vendor={payVendor} onClose={() => setPayVendor(null)} onSave={handlePay} />
      )}

      {/* Add / Edit vendor modal */}
      {vendorModalOpen && (
        <VendorModal
          vendor={editingVendor}
          onClose={() => setVendorModalOpen(false)}
          onSave={handleSaveVendor}
        />
      )}
    </div>
  );
}

/* Small user icon used in the table */
const UserSmallIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
  </Icon>
);

/* ------------------------------------------------------------------ */
/*  History content (inside the history modal)                         */
/* ------------------------------------------------------------------ */

const HistoryContent: React.FC<{ history: HistoryData }> = ({ history }) => {
  const invoiceMap = new Map<number, HistoryInvoice>();
  history.invoices.forEach((inv) => invoiceMap.set(inv.id, inv));

  // Paid / Balance belong to the invoice, so show them once on its first product row
  const seen = new Set<number>();
  const totalQty = history.records.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <>
      <div className="crd-history-summary">
        <div>
          <span>Total Orders</span>
          <strong>{history.summary.total_orders}</strong>
        </div>
        <div>
          <span>Total Amount</span>
          <strong>{money(history.summary.total_amount)}</strong>
        </div>
        <div>
          <span>Total Paid</span>
          <strong className="green">{money(history.summary.total_paid)}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong className="red">{money(history.summary.balance)}</strong>
        </div>
      </div>

      <h3 className="crd-section-title">
        <span className="blue">
          <BoxIcon />
        </span>
        All Records
      </h3>

      <div className="crd-history-wrap">
        <table className="crd-history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Product</th>
              <th className="center">Qty</th>
              <th className="right">Total</th>
              <th className="right">Paid</th>
              <th className="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {history.records.length === 0 && (
              <tr>
                <td colSpan={8} className="crd-empty">
                  No records yet.
                </td>
              </tr>
            )}
            {history.records.map((r, i) => {
              const inv = invoiceMap.get(r.purchase_id);
              const first = !seen.has(r.purchase_id);
              seen.add(r.purchase_id);
              return (
                <tr key={`${r.purchase_id}-${i}`}>
                  <td className="muted">{i + 1}</td>
                  <td>{r.invoice_no}</td>
                  <td className="muted">{formatDate(r.date)}</td>
                  <td className="strong">{r.product}</td>
                  <td className="center">{r.quantity}</td>
                  <td className="right strong">{money(r.total)}</td>
                  <td className="right">{first && inv ? money(inv.paid_amount) : "—"}</td>
                  <td className="right">
                    {first && inv ? (
                      <span className={inv.balance > 0 ? "crd-balance-due" : "crd-balance-ok"}>
                        {money(inv.balance)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {history.records.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="right strong">
                  Total:
                </td>
                <td className="center green strong">{totalQty}</td>
                <td className="right green strong">{money(history.summary.total_amount)}</td>
                <td className="right green strong">{money(history.summary.total_paid)}</td>
                <td className="right green strong">{money(history.summary.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h3 className="crd-section-title">
        <span className="blue">
          <CardIcon />
        </span>
        Payment History
        <small>({history.payments.length} payments)</small>
      </h3>

      {history.payments.length === 0 ? (
        <div className="crd-no-payments">
          <InboxIcon />
          <p>No payments recorded yet</p>
        </div>
      ) : (
        <div className="crd-history-wrap">
          <table className="crd-history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Invoice #</th>
                <th className="right">Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.payments.map((p, i) => (
                <tr key={p.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="muted">{formatDateTime(p.date)}</td>
                  <td>{p.invoice_no ?? "—"}</td>
                  <td className="right green strong">{money(p.amount)}</td>
                  <td className="muted">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Pay Now modal                                                      */
/* ------------------------------------------------------------------ */

interface PayModalProps {
  vendor: VendorRow;
  onClose: () => void;
  onSave: (vendorId: number, amount: number, note: string | null) => Promise<void>;
}

const PayModal: React.FC<PayModalProps> = ({ vendor, onClose, onSave }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount) || 0;
  const remaining = Math.max(vendor.total_balance - value, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount.trim() === "" || Number.isNaN(value) || value <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (value > vendor.total_balance) {
      setError(`Amount cannot be more than the balance (${money(vendor.total_balance)}).`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(vendor.id, value, note.trim() || null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crd-overlay" onClick={onClose}>
      <div className="crd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crd-modal-head">
          <div>
            <h2 className="crd-modal-title">Pay Now</h2>
            <p className="crd-modal-sub">{vendor.name}</p>
          </div>
          <button type="button" className="crd-modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form className="crd-modal-body" onSubmit={submit}>
          {error && <div className="crd-alert">{error}</div>}

          <div className="crd-modal-row">
            <span className="muted">Current balance</span>
            <strong className="red">{money(vendor.total_balance)}</strong>
          </div>

          <div className="crd-field">
            <label>Amount (Rs)</label>
            <div className="crd-field-inline">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(stripLeadingZeros(e.target.value))}
                placeholder="e.g. 2000"
                autoFocus
              />
              <button
                type="button"
                className="crd-btn crd-btn-ghost small"
                onClick={() => setAmount(String(vendor.total_balance))}
              >
                Full balance
              </button>
            </div>
          </div>

          <div className="crd-field">
            <label>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cash given to Ahmed"
            />
          </div>

          {value > 0 && (
            <small className="crd-hint">
              Remaining after this payment: {money(remaining)}. The payment is applied to the oldest unpaid
              invoice first.
            </small>
          )}

          <div className="crd-modal-foot">
            <button type="button" className="crd-btn crd-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="crd-btn crd-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Add / Edit vendor modal                                            */
/* ------------------------------------------------------------------ */

interface VendorModalProps {
  vendor: VendorRow | null;
  onClose: () => void;
  onSave: (id: number | null, data: { name: string; phone: string | null }) => Promise<void>;
}

const VendorModal: React.FC<VendorModalProps> = ({ vendor, onClose, onSave }) => {
  const [name, setName] = useState(vendor?.name ?? "");
  const [phone, setPhone] = useState(vendor?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter the vendor name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(vendor?.id ?? null, { name: name.trim(), phone: phone.trim() || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crd-overlay" onClick={onClose}>
      <div className="crd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crd-modal-head">
          <h2 className="crd-modal-title">{vendor ? "Edit Vendor" : "Add Vendor"}</h2>
          <button type="button" className="crd-modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form className="crd-modal-body" onSubmit={submit}>
          {error && <div className="crd-alert">{error}</div>}

          <div className="crd-field">
            <label>Vendor Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Malik"
              autoFocus
            />
          </div>

          <div className="crd-field">
            <label>Phone (optional)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0300 1234567"
            />
          </div>

          <div className="crd-modal-foot">
            <button type="button" className="crd-btn crd-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="crd-btn crd-btn-primary" disabled={saving}>
              {saving ? "Saving..." : vendor ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};