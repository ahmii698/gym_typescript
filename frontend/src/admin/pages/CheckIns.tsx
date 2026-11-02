import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Users,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./CheckIns.css";

/* ---------------------------- Types ---------------------------- */

type RangeKey = "today" | "week" | "month" | "custom";

interface CheckInRecord {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  pkg: string;
  date: string; // "2026-09-24"
  checkIn: string | null; // "09:45:00"
}

interface ApiCheckInsResponse {
  data: {
    id: number;
    name: string;
    phone: string;
    cnic: string;
    package: string;
    date: string;
    check_in: string | null;
  }[];
  total: number;
  current_page: number;
  last_page: number;
}

interface Stats {
  today: number;
  week: number;
  month: number;
  total: number;
}

/* ---------------------------- Helpers ---------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDateLong = (d: Date) => `${DAYS[d.getDay()]}, ${fmtDate(d)}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// "2026-09-24" + "09:45:00" -> display string, no timezone surprises
const fmtRecordDateTime = (dateStr: string, checkIn: string | null) => {
  const d = fromInput(dateStr);
  const dateLabel = fmtDate(d);
  if (!checkIn) return dateLabel;
  const [hh, mm] = checkIn.split(":").map(Number);
  const h12 = hh % 12 || 12;
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${dateLabel}, ${h12}:${pad(mm)} ${ampm}`;
};

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function apiFetchCheckIns(params: {
  from: string;
  to: string;
  search: string;
  page: number;
}): Promise<ApiCheckInsResponse> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page),
  });
  if (params.search.trim()) qs.set("search", params.search.trim());

  const res = await fetch(`${API_URL}/attendance/checkins?${qs.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Could not load check-ins.");
  return res.json();
}

async function apiFetchStats(): Promise<Stats> {
  const res = await fetch(`${API_URL}/attendance/checkin-stats`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Could not load stats.");
  return res.json();
}

// Escape text before putting it into export HTML
const escapeHtml = (v: string | number): string =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

const TABS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Date" },
];

const BOTTOM_GAP = 24;

/* ----------------------------- Component ----------------------------- */

const CheckIns = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [now, setNow] = useState(() => new Date());
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState(() => toInput(new Date()));
  const [to, setTo] = useState(() => toInput(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  useEffect(() => {
    setPage(1);
  }, [from, to, query]);

  // Fetch check-ins whenever filters/page change (or on manual refresh)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetchCheckIns({ from, to, search: query, page })
      .then((res) => {
        if (cancelled) return;
        setRecords(
          res.data.map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            cnic: r.cnic,
            pkg: r.package,
            date: r.date,
            checkIn: r.check_in,
          }))
        );
        setTotal(res.total);
        setTotalPages(Math.max(1, res.last_page));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load check-ins.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, query, page, refreshKey]);

  // Fetch stat cards (on first load and on manual refresh)
  useEffect(() => {
    apiFetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  // Stop the header Refresh button's "Refreshing..." state once loading finishes
  useEffect(() => {
    if (!loading) setRefreshing(false);
  }, [loading]);

  const applyPreset = (key: RangeKey) => {
    setRange(key);
    const today = new Date();
    if (key === "today") {
      setFrom(toInput(today));
      setTo(toInput(today));
      setPickerOpen(false);
    } else if (key === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setFrom(toInput(start));
      setTo(toInput(today));
      setPickerOpen(false);
    } else if (key === "month") {
      setFrom(toInput(new Date(today.getFullYear(), today.getMonth(), 1)));
      setTo(toInput(today));
      setPickerOpen(false);
    } else {
      setPickerOpen(true);
    }
  };

  const onFromChange = (value: string) => {
    if (!value) return;
    setRange("custom");
    setFrom(value);
    if (value > to) setTo(value);
  };

  const onToChange = (value: string) => {
    if (!value) return;
    setRange("custom");
    setTo(value);
    if (value < from) setFrom(value);
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * 10 + 1;
  const showingTo = (page - 1) * 10 + records.length;
  const rangeLabel = `${fmtDate(fromInput(from))} - ${fmtDate(fromInput(to))}`;

  /* ---------- Header actions (Refresh / Excel / PDF) ---------- */
  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  };

  // Loads every page for the current filters, so the export is not limited to the visible 10 rows
  const fetchAllRecords = async (): Promise<CheckInRecord[]> => {
    const all: CheckInRecord[] = [];
    let current = 1;
    let last = 1;
    do {
      const res = await apiFetchCheckIns({ from, to, search: query, page: current });
      res.data.forEach((r) =>
        all.push({
          id: r.id,
          name: r.name,
          phone: r.phone,
          cnic: r.cnic,
          pkg: r.package,
          date: r.date,
          checkIn: r.check_in,
        })
      );
      last = Math.max(1, res.last_page);
      current += 1;
    } while (current <= last);
    return all;
  };

  // Excel export (no extra library): downloads an .xls file built from an HTML table
  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await fetchAllRecords();
      const body = all
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(
              r.phone
            )}</td><td>${escapeHtml(r.pkg)}</td><td>${escapeHtml(
              fmtRecordDateTime(r.date, r.checkIn)
            )}</td></tr>`
        )
        .join("");

      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>#</th><th>Member Name</th><th>Phone</th><th>Package</th><th>Check-in Time</th></tr></thead>
<tbody>${body}</tbody>
</table>
</body></html>`;

      const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `check-ins-${from}_to_${to}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export check-ins.");
    } finally {
      setExporting(false);
    }
  };

  // PDF export (no extra library): opens the print dialog, choose "Save as PDF"
  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await fetchAllRecords();
      const body = all
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(
              r.phone
            )}</td><td>${escapeHtml(r.pkg)}</td><td>${escapeHtml(
              fmtRecordDateTime(r.date, r.checkIn)
            )}</td></tr>`
        )
        .join("");

      const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Check-ins</title>
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
<h1>Check-ins</h1>
<p>${escapeHtml(rangeLabel)} &middot; ${all.length} records</p>
<table>
<thead><tr><th>#</th><th>Member Name</th><th>Phone</th><th>Package</th><th>Check-in Time</th></tr></thead>
<tbody>${body}</tbody>
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
    } catch {
      setError("Could not export check-ins.");
    } finally {
      setExporting(false);
    }
  };

  const STATS_CARDS = [
    { id: "today", title: "Today's Check-ins", period: "Today", value: stats?.today ?? "-", variant: "red", icon: <CalendarCheck size={26} /> },
    { id: "week", title: "Weekly Check-ins", period: "This Week", value: stats?.week ?? "-", variant: "green", icon: <CalendarDays size={26} /> },
    { id: "month", title: "Monthly Check-ins", period: "This Month", value: stats?.month ?? "-", variant: "amber", icon: <CalendarRange size={26} /> },
    { id: "total", title: "Total Check-ins", period: "All time", value: stats?.total ?? "-", variant: "orange", icon: <Users size={26} /> },
  ];

  return (
    <div className="ci-page" ref={pageRef} style={pageHeight ? { height: pageHeight } : undefined}>
      {/* Header */}
      <div className="ci-header">
        <div>
          <h1 className="ci-title">Check-ins</h1>
          <p className="ci-subtitle">View and manage all member check-in records.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
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
              <RefreshCw size={16} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <button
              type="button"
              style={{
                ...excelBtnStyle,
                opacity: exporting ? 0.7 : 1,
                cursor: exporting ? "not-allowed" : "pointer",
              }}
              onClick={handleExportExcel}
              disabled={exporting}
            >
              <FileSpreadsheet size={16} />
              <span>Excel</span>
            </button>
            <button
              type="button"
              style={{
                ...pdfBtnStyle,
                opacity: exporting ? 0.7 : 1,
                cursor: exporting ? "not-allowed" : "pointer",
              }}
              onClick={handleExportPdf}
              disabled={exporting}
            >
              <Download size={16} />
              <span>PDF</span>
            </button>
          </div>

          <div className="ci-datetime">
            <div className="ci-datetime-text">
              <span className="ci-date">{fmtDateLong(now)}</span>
              <span className="ci-time">{fmtTime(now)}</span>
            </div>
            <Calendar size={22} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="ci-stats">
        {STATS_CARDS.map((s) => (
          <div key={s.id} className="ci-stat-card">
            <div className={`ci-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="ci-stat-info">
              <span className="ci-stat-title">{s.title}</span>
              <span className="ci-stat-period">{s.period}</span>
              <span className="ci-stat-value">{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="pkg-error-banner" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Table panel */}
      <div className="ci-panel">
        <div className="ci-toolbar">
          <div className="ci-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`ci-tab ${range === t.key ? "active" : ""}`}
                onClick={() => applyPreset(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ci-toolbar-right">
            <div className="ci-range-wrap" ref={pickerRef}>
              <button type="button" className="ci-range" onClick={() => setPickerOpen((o) => !o)}>
                <Calendar size={15} />
                <span>{rangeLabel}</span>
              </button>

              {pickerOpen && (
                <div className="ci-popover">
                  <label className="ci-popover-field">
                    <span>From</span>
                    <input type="date" value={from} max={to} onChange={(e) => onFromChange(e.target.value)} />
                  </label>
                  <label className="ci-popover-field">
                    <span>To</span>
                    <input type="date" value={to} min={from} onChange={(e) => onToChange(e.target.value)} />
                  </label>
                  <button type="button" className="ci-popover-apply" onClick={() => setPickerOpen(false)}>
                    Apply
                  </button>
                </div>
              )}
            </div>

            <div className="ci-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone or CNIC..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="ci-table-wrap">
          <table className="ci-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Check-in Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="ci-empty">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ci-empty">
                    No check-in records found.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted">{(page - 1) * 10 + i + 1}</td>
                    <td className="member-name">{r.name}</td>
                    <td>{r.phone}</td>
                    <td>{r.pkg}</td>
                    <td>{fmtRecordDateTime(r.date, r.checkIn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="ci-footer">
          <span className="ci-showing">
            Showing {showingFrom} to {showingTo} of {total} results
          </span>

          <div className="ci-pagination">
            <button
              type="button"
              className="ci-page-btn"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, page).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="ci-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`ci-page-btn ${p === page ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="ci-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckIns;