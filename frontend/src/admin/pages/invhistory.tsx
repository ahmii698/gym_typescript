import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../../config";
import "./invhistory.css";

/* ---------- Types ---------- */
// One row of the balance sheet. Every money field can be null (shown as "-")
interface InvRow {
  id?: number | string;
  date: string | null;
  invoice_no: string | null;
  details: string | null;
  product: string | null;
  price: number | null;
  quantity: number | null;
  cash_in: number | null;
  cash_out: number | null;
  vendor_payable_inventory: number | null;
  cash_inventory: number | null;
  cash_in_hand: number | null;
  total_inventory_cost: number | null;
  expense: number | null;
  profit: number | null;
}

// Change this if your backend route is different
const HISTORY_ENDPOINT = `${API_URL}/inventory-history`;

const PAGE_SIZE = 15;

/* ---------- Helpers ---------- */
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// Accepts both snake_case and a few common alternatives from the backend
const mapRow = (r: any): InvRow => ({
  id: r.id,
  date: r.date ?? r.created_at ?? null,
  invoice_no: r.invoice_no ?? r.invoice ?? null,
  details: r.details ?? r.detail ?? null,
  product: r.product ?? r.product_name ?? null,
  price: toNumOrNull(r.price),
  quantity: toNumOrNull(r.quantity),
  cash_in: toNumOrNull(r.cash_in),
  cash_out: toNumOrNull(r.cash_out),
  vendor_payable_inventory: toNumOrNull(r.vendor_payable_inventory),
  cash_inventory: toNumOrNull(r.cash_inventory),
  cash_in_hand: toNumOrNull(r.cash_in_hand),
  total_inventory_cost: toNumOrNull(r.total_inventory_cost),
  expense: toNumOrNull(r.expense),
  profit: toNumOrNull(r.profit),
});

const money = (n: number | null): string =>
  n === null ? "-" : `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const showText = (v: string | null): string => (v && v.trim() !== "" ? v : "-");

const fmtDate = (v: string | null): string => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtTime = (v: string | null): string => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

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

const HistoryIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
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

/* ---------- Table columns ---------- */
const HEADERS: { label: string; center?: boolean }[] = [
  { label: "S.No" },
  { label: "Date" },
  { label: "Invoice No" },
  { label: "Details" },
  { label: "Product" },
  { label: "Price", center: true },
  { label: "Quantity", center: true },
  { label: "Cash In", center: true },
  { label: "Cash Out", center: true },
  { label: "Vendor Payable Inventory", center: true },
  { label: "Cash Inventory", center: true },
  { label: "Cash in Hand", center: true },
  { label: "Total Inventory Cost", center: true },
  { label: "Expense", center: true },
  { label: "Profit", center: true },
];

/* ---------- Page ---------- */
export default function InvHistory() {
  const token = localStorage.getItem("token");

  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  /* ---------- Refresh (also runs once on open) ---------- */
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(HISTORY_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to load inventory history");
      const json = await res.json();
      // Works with a plain array or { data: [...] }
      const list: any[] = Array.isArray(json) ? json : json?.data ?? [];
      setRows(list.map(mapRow));
      setPage(1);
    } catch (err) {
      console.error(err);
      setError("Could not load inventory history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = rows.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageRows.length;

  /* ---------- Grand total ---------- */
  // Flow columns are summed; balance columns show the latest row's value
  const totals = useMemo(() => {
    const sum = (pick: (r: InvRow) => number | null): number | null => {
      const vals = rows.map(pick).filter((v): v is number => v !== null);
      return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
    };
    const last = (pick: (r: InvRow) => number | null): number | null => {
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = pick(rows[i]);
        if (v !== null) return v;
      }
      return null;
    };
    return {
      cash_in: sum((r) => r.cash_in),
      cash_out: sum((r) => r.cash_out),
      vendor_payable_inventory: last((r) => r.vendor_payable_inventory),
      cash_inventory: last((r) => r.cash_inventory),
      cash_in_hand: last((r) => r.cash_in_hand),
      total_inventory_cost: last((r) => r.total_inventory_cost),
      expense: sum((r) => r.expense),
      profit: sum((r) => r.profit),
    };
  }, [rows]);

  /* ---------- Excel export (no extra library): .xls built from an HTML table ---------- */
  const handleExportExcel = () => {
    const body = rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(fmtDate(r.date))} ${escapeHtml(
            fmtTime(r.date)
          )}</td><td>${escapeHtml(showText(r.invoice_no))}</td><td>${escapeHtml(
            showText(r.details)
          )}</td><td>${escapeHtml(showText(r.product))}</td><td>${r.price ?? ""}</td><td>${
            r.quantity ?? ""
          }</td><td>${r.cash_in ?? ""}</td><td>${r.cash_out ?? ""}</td><td>${
            r.vendor_payable_inventory ?? ""
          }</td><td>${r.cash_inventory ?? ""}</td><td>${r.cash_in_hand ?? ""}</td><td>${
            r.total_inventory_cost ?? ""
          }</td><td>${r.expense ?? ""}</td><td>${r.profit ?? ""}</td></tr>`
      )
      .join("");

    const head = HEADERS.map((h) => `<th>${escapeHtml(h.label)}</th>`).join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="7">GRAND TOTAL</td><td>${totals.cash_in ?? ""}</td><td>${
      totals.cash_out ?? ""
    }</td><td>${totals.vendor_payable_inventory ?? ""}</td><td>${totals.cash_inventory ?? ""}</td><td>${
      totals.cash_in_hand ?? ""
    }</td><td>${totals.total_inventory_cost ?? ""}</td><td>${totals.expense ?? ""}</td><td>${
      totals.profit ?? ""
    }</td></tr></tfoot>
</table>
</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-history-${todayISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ---------- PDF export (no extra library): opens print dialog, choose "Save as PDF" ---------- */
  const handleExportPdf = () => {
    const c = (v: number | null) => `<td style="text-align:center">${escapeHtml(money(v))}</td>`;

    const body = rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(fmtDate(r.date))}</td><td>${escapeHtml(
            showText(r.invoice_no)
          )}</td><td>${escapeHtml(showText(r.details))}</td><td>${escapeHtml(
            showText(r.product)
          )}</td>${c(r.price)}<td style="text-align:center">${r.quantity ?? "-"}</td>${c(
            r.cash_in
          )}${c(r.cash_out)}${c(r.vendor_payable_inventory)}${c(r.cash_inventory)}${c(
            r.cash_in_hand
          )}${c(r.total_inventory_cost)}${c(r.expense)}${c(r.profit)}</tr>`
      )
      .join("");

    const head = HEADERS.map(
      (h) => `<th${h.center ? ' style="text-align:center"' : ""}>${escapeHtml(h.label)}</th>`
    ).join("");

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Inventory History</title>
<style>
  @page { size: landscape; }
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
  th { background: #f3f4f6; }
  tfoot td { font-weight: bold; background: #f9fafb; }
</style>
</head>
<body>
<h1>Inventory History</h1>
<p>Balance Sheet &middot; Generated on ${escapeHtml(todayISO())} &middot; ${rows.length} records</p>
<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="7" style="text-align:right">GRAND TOTAL</td>${c(totals.cash_in)}${c(
      totals.cash_out
    )}${c(totals.vendor_payable_inventory)}${c(totals.cash_inventory)}${c(totals.cash_in_hand)}${c(
      totals.total_inventory_cost
    )}${c(totals.expense)}${c(totals.profit)}</tr></tfoot>
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

  /* ---------- Cell helper ---------- */
  const cell = (v: number | null, tone?: "in" | "out") => (
    <td className={`center ${v === null ? "muted" : tone ? `inv-${tone}` : ""}`}>{money(v)}</td>
  );

  return (
    <div className="inv-page">
      {/* Header */}
      <header className="inv-header">
        <div className="inv-header-left">
          <div className="inv-header-icon">
            <HistoryIcon />
          </div>
          <div>
            <h1 className="inv-title">Inventory History</h1>
            <p className="inv-subtitle">Balance Sheet</p>
          </div>
        </div>

        <div className="inv-header-actions">
          <button
            type="button"
            className="inv-btn inv-btn-refresh"
            onClick={fetchHistory}
            disabled={loading}
          >
            <RefreshIcon />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-excel"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <SheetIcon />
            <span>Excel</span>
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-pdf"
            onClick={handleExportPdf}
            disabled={loading}
          >
            <DownloadIcon />
            <span>PDF</span>
          </button>
        </div>
      </header>

      {/* Table panel */}
      <section className="inv-panel">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                {HEADERS.map((h) => (
                  <th key={h.label} className={h.center ? "center" : undefined}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={HEADERS.length} className="inv-empty">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={HEADERS.length} className="inv-empty inv-error">
                    {error}
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length} className="inv-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr key={r.id ?? startIndex + i}>
                    <td className="muted">{startIndex + i + 1}</td>
                    <td>
                      <div className="inv-date">{fmtDate(r.date)}</div>
                      <div className="inv-time">{fmtTime(r.date)}</div>
                    </td>
                    <td className={r.invoice_no ? "inv-invoice" : "muted"}>{showText(r.invoice_no)}</td>
                    <td>{showText(r.details)}</td>
                    <td className="inv-product">{showText(r.product)}</td>
                    {cell(r.price)}
                    <td className={`center ${r.quantity === null ? "muted" : ""}`}>
                      {r.quantity === null ? "-" : r.quantity}
                    </td>
                    {cell(r.cash_in, "in")}
                    {cell(r.cash_out, "out")}
                    {cell(r.vendor_payable_inventory)}
                    {cell(r.cash_inventory)}
                    {cell(r.cash_in_hand)}
                    {cell(r.total_inventory_cost)}
                    {cell(r.expense)}
                    {cell(r.profit)}
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={7} className="inv-grand-label">
                  Grand Total
                </td>
                {cell(totals.cash_in, "in")}
                {cell(totals.cash_out, "out")}
                {cell(totals.vendor_payable_inventory)}
                {cell(totals.cash_inventory)}
                {cell(totals.cash_in_hand)}
                {cell(totals.total_inventory_cost)}
                {cell(totals.expense)}
                {cell(totals.profit)}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="inv-footer">
          <span className="inv-showing">
            Showing {showingFrom} to {showingTo} of {rows.length} records
          </span>

          <div className="inv-pagination">
            <button
              type="button"
              className="inv-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="inv-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`inv-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="inv-page-btn"
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