import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Wallet,
  Calendar,
  Search,
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Coins,
  TrendingUp,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { API_URL } from "../../../config";
import "./Memberships.css";

/* ----------------------------- Types ----------------------------- */

type MembershipType = "Normal" | "Normal + Trainer" | "Package Only" | "Package + Trainer";
type PaymentStatus = "Paid" | "Unpaid";
type TabKey = "All" | MembershipType;

interface MonthlyFee {
  id: number;
  member_id: number;
  month_number: number;
  fee_amount: number;
  valid_from: string;
  valid_till: string;
  status: "paid" | "pending";
  paid_on?: string | null;
  note?: string | null;
}

interface ApiRow {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  package: string;
  type: MembershipType;
  trainer: string | null;
  payment_status: PaymentStatus;
  fees_paid_on: string | null;
  fees_expiry_on: string | null;
  joined_on: string | null;
  email: string;
  cnic_front_url: string | null;
  cnic_back_url: string | null;
  monthly_fees?: MonthlyFee[];
}

interface MembershipRecord {
  id: number;
  name: string;
  phone: string;
  cnic: string;
  email: string;
  pkg: string;
  plan: string;
  trainer: string;
  membershipType: MembershipType;
  paymentStatus: PaymentStatus;
  joinedOn: string;
  feesPaidOn: string;
  expiryDate: string;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
  monthlyFees: MonthlyFee[];
}

interface TrainerOption {
  id: number;
  name: string;
}

/* ----------------------------- Helpers ----------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALL_TRAINERS = "All Trainers";
const NO_TRAINER = "__no_trainer__";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDateLong = (d: Date) =>
  `${DAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toISO = (v: unknown): string => {
  if (!v || v === "-") return "";
  return String(v).slice(0, 10);
};

const fmtISO = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};

const dash = (v: unknown) =>
  v !== null && typeof v !== "undefined" && String(v).trim() !== "" ? String(v) : "—";

const formatPrice = (n: number | string): string => {
  const num = Number(n);
  if (isNaN(num)) return "Rs 0";
  return `Rs ${num.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
};

const daysBetween = (a: string, b: string) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
};

const planOf = (start: string, end: string): string => {
  const days = daysBetween(start, end);
  if (days <= 0) return "—";
  if (days <= 35) return "Monthly";
  if (days >= 80 && days <= 100) return "Quarterly";
  if (days >= 350 && days <= 380) return "Yearly";
  return `${Math.max(1, Math.round(days / 30))} Months`;
};

const getPages = (total: number, current: number): (number | "...")[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
};

const typeClass = (t: MembershipType) => {
  if (t === "Package Only") return "ms-badge package";
  if (t === "Package + Trainer") return "ms-badge trainer";
  if (t === "Normal + Trainer") return "ms-badge normal-trainer";
  return "ms-badge normal";
};

/* Membership type after a trainer is added / removed */
const typeAfterTrainerChange = (type: MembershipType, hasTrainer: boolean): MembershipType => {
  if (hasTrainer) {
    if (type === "Normal") return "Normal + Trainer";
    if (type === "Package Only") return "Package + Trainer";
    return type;
  }
  if (type === "Normal + Trainer") return "Normal";
  if (type === "Package + Trainer") return "Package Only";
  return type;
};

const extractList = (json: any): ApiRow[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
};

const mapRow = (m: ApiRow): MembershipRecord => {
  const joinedOn = toISO(m.joined_on);
  const expiryDate = toISO(m.fees_expiry_on);

  return {
    id: m.id,
    name: m.name ?? "",
    phone: m.phone ?? "",
    cnic: m.cnic ?? "",
    email: m.email ?? "",
    pkg: m.package || "—",
    plan: planOf(joinedOn, expiryDate),
    trainer: m.trainer ?? "",
    membershipType: m.type ?? "Normal",
    paymentStatus: m.payment_status ?? "Unpaid",
    joinedOn,
    feesPaidOn: toISO(m.fees_paid_on),
    expiryDate,
    cnicFrontUrl: m.cnic_front_url ?? null,
    cnicBackUrl: m.cnic_back_url ?? null,
    monthlyFees: Array.isArray(m.monthly_fees) ? m.monthly_fees : [],
  };
};

/* Helper: calculate the expiry date from the updated monthlyFees */
const computeExpiryFromMonthlyFees = (fees: MonthlyFee[], fallback: string): string => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.valid_till;
    }
  }

  const sorted = [...fees].sort((a, b) => a.month_number - b.month_number);
  const nextPending = sorted.find((mf) => mf.status === "pending");
  if (nextPending) return nextPending.valid_till;

  return sorted[sorted.length - 1]?.valid_till ?? fallback;
};

/* Helper: payment status based on the rolling window */
const computePaymentStatusFromMonthlyFees = (
  fees: MonthlyFee[],
  fallback: PaymentStatus
): PaymentStatus => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.status === "paid" ? "Paid" : "Unpaid";
    }
  }

  return "Unpaid";
};

/* Helper: feesPaidOn based on the rolling window */
const computeFeesPaidOnFromMonthlyFees = (
  fees: MonthlyFee[],
  fallback: string
): string => {
  if (!fees || fees.length === 0) return fallback;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf.status === "paid" && mf.paid_on ? mf.paid_on : "";
    }
  }

  return "";
};

/* Helper: find the monthly fee that covers today's date */
const findCurrentMonthFee = (fees: MonthlyFee[]): MonthlyFee | null => {
  if (!fees || fees.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  for (const mf of fees) {
    if (!mf.valid_from || !mf.valid_till) continue;
    if (today >= mf.valid_from && today <= mf.valid_till) {
      return mf;
    }
  }

  return null;
};

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

/* CNIC image */
const CnicImage = ({ url, label }: { url: string | null; label: string }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) return <span className="ms-detail-value">Not uploaded</span>;

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="ms-cnic-fail">
        Image failed to load, open the link
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ms-cnic-link">
      <img src={url} alt={label} className="ms-cnic-img" onError={() => setFailed(true)} />
    </a>
  );
};

const TABS: TabKey[] = ["All", "Normal", "Normal + Trainer", "Package Only", "Package + Trainer"];
const PAGE_SIZE = 10;
const BOTTOM_GAP = 24;

/* ----------------------------- Component ----------------------------- */

const Memberships = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const [members, setMembers] = useState<MembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<TabKey>("All");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("All Plans");
  const [trainerFilter, setTrainerFilter] = useState(ALL_TRAINERS);
  const [trainerList, setTrainerList] = useState<TrainerOption[]>([]);
  const [page, setPage] = useState(1);
  const [activeMember, setActiveMember] = useState<MembershipRecord | null>(null);

  const [togglingFeeId, setTogglingFeeId] = useState<number | null>(null);

  // Trainer change / remove (inside the modal)
  const [editingTrainer, setEditingTrainer] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [savingTrainer, setSavingTrainer] = useState(false);

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
    if (!activeMember) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMember(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMember]);

  // Reset the trainer editor whenever a different member is opened / modal closed
  const activeMemberId = activeMember?.id ?? null;
  useEffect(() => {
    setEditingTrainer(false);
    setSelectedTrainerId("");
    setSavingTrainer(false);
  }, [activeMemberId]);

  const loadMembers = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/attendance?date=${localISO(new Date())}`, {
        signal,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (!res.ok) throw new Error(`Could not load members (${res.status}).`);

      const list = extractList(await res.json()).map(mapRow);
      list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      setMembers(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Something went wrong.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadMembers(controller.signal);
    return () => controller.abort();
  }, [loadMembers, reloadKey]);

  // Load all trainers (id + name) for the filter dropdown and the change-trainer dropdown
  useEffect(() => {
    const controller = new AbortController();

    const loadTrainers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/trainers`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const list: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        const trainers: TrainerOption[] = list
          .map((t) => ({ id: Number(t?.id), name: String(t?.name ?? "").trim() }))
          .filter((t) => !Number.isNaN(t.id) && t.name !== "");
        setTrainerList(trainers);
      } catch {
        /* ignore: the filter falls back to trainers found in members */
      }
    };

    loadTrainers();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, plan, trainerFilter]);

  // Stop the header Refresh button's "Refreshing..." state once loading finishes
  useEffect(() => {
    if (!loading) setRefreshing(false);
  }, [loading]);

  /* ---- Stats ---- */
  const todayISO = localISO(now);

  const stats = useMemo(() => {
    const expired = members.filter((m) => m.expiryDate && m.expiryDate < todayISO).length;
    const unpaid = members.filter((m) => m.paymentStatus === "Unpaid").length;

    // Calculate this month's fees
    let totalMonthFees = 0;
    let collectedMonthFees = 0;

    members.forEach((m) => {
      const currentFee = findCurrentMonthFee(m.monthlyFees);
      if (currentFee) {
        totalMonthFees += Number(currentFee.fee_amount);
        if (currentFee.status === "paid") {
          collectedMonthFees += Number(currentFee.fee_amount);
        }
      }
    });

    const remainingMonthFees = Math.max(0, totalMonthFees - collectedMonthFees);

    return [
      {
        id: "total",
        title: "Total Members",
        period: "All time",
        value: String(members.length),
        variant: "red",
        icon: <Users size={26} />,
      },
      {
        id: "active",
        title: "Active Members",
        period: "Fees valid",
        value: String(members.length - expired),
        variant: "green",
        icon: <UserCheck size={26} />,
      },
      {
        id: "expired",
        title: "Expired Members",
        period: "Fees expired",
        value: String(expired),
        variant: "amber",
        icon: <UserX size={26} />,
      },
      {
        id: "unpaid",
        title: "Unpaid Members",
        period: "Payment pending",
        value: String(unpaid),
        variant: "orange",
        icon: <Wallet size={26} />,
      },
      {
        id: "total-month",
        title: "This Month Fees",
        period: "Total Expected",
        value: formatPrice(totalMonthFees),
        variant: "red",
        icon: <Coins size={26} />,
      },
      {
        id: "collected-month",
        title: "Collected This Month",
        period: "Received",
        value: formatPrice(collectedMonthFees),
        variant: "green",
        icon: <TrendingUp size={26} />,
      },
      {
        id: "remaining-month",
        title: "Remaining This Month",
        period: "Pending",
        value: formatPrice(remainingMonthFees),
        variant: "amber",
        icon: <Clock size={26} />,
      },
    ];
  }, [members, todayISO]);

  const planOptions = useMemo(() => {
    const set = new Set(members.map((m) => m.plan).filter((p) => p && p !== "—"));
    return ["All Plans", ...Array.from(set).sort()];
  }, [members]);

  // Trainer filter options: all trainers from /trainers + any trainer found in members
  const trainerOptions = useMemo(() => {
    const set = new Set<string>(trainerList.map((t) => t.name));
    members.forEach((m) => {
      const t = m.trainer.trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [members, trainerList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[\s-]/g, "");

    return members.filter((m) => {
      if (tab !== "All" && m.membershipType !== tab) return false;
      if (plan !== "All Plans" && m.plan !== plan) return false;

      if (trainerFilter === NO_TRAINER) {
        if (m.trainer.trim() !== "") return false;
      } else if (trainerFilter !== ALL_TRAINERS) {
        if (m.trainer.trim().toLowerCase() !== trainerFilter.trim().toLowerCase()) return false;
      }

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.pkg.toLowerCase().includes(q) ||
        m.trainer.toLowerCase().includes(q) ||
        (qDigits.length > 0 &&
          (m.phone.replace(/\s/g, "").includes(qDigits) || m.cnic.replace(/-/g, "").includes(qDigits)))
      );
    });
  }, [members, tab, query, plan, trainerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = startIdx + rows.length;

  const payClass = (s: PaymentStatus) => `ms-pay ${s.toLowerCase()}`;

  /* ---------- Header actions (Refresh / Excel / PDF) ---------- */
  const handleRefresh = () => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  };

  // Excel export (no extra library): downloads an .xls file built from an HTML table
  const handleExportExcel = () => {
    const body = filtered
      .map(
        (m, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(
            dash(m.phone)
          )}</td><td>${escapeHtml(dash(m.cnic))}</td><td>${escapeHtml(m.pkg)}</td><td>${escapeHtml(
            m.plan
          )}</td><td>${escapeHtml(m.trainer || "—")}</td><td>${escapeHtml(
            m.paymentStatus
          )}</td><td>${escapeHtml(fmtISO(m.feesPaidOn))}</td><td>${escapeHtml(
            fmtISO(m.expiryDate)
          )}</td><td>${escapeHtml(m.membershipType)}</td></tr>`
      )
      .join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
<thead><tr><th>#</th><th>Member Name</th><th>Phone</th><th>CNIC</th><th>Package</th><th>Plan</th><th>Trainer</th><th>Payment</th><th>Fees Paid On</th><th>Expiry Date</th><th>Membership Type</th></tr></thead>
<tbody>${body}</tbody>
</table>
</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memberships-${localISO(new Date())}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF export (no extra library): opens the print dialog, choose "Save as PDF"
  const handleExportPdf = () => {
    const body = filtered
      .map(
        (m, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(
            dash(m.phone)
          )}</td><td>${escapeHtml(dash(m.cnic))}</td><td>${escapeHtml(m.pkg)}</td><td>${escapeHtml(
            m.plan
          )}</td><td>${escapeHtml(m.trainer || "—")}</td><td>${escapeHtml(
            m.paymentStatus
          )}</td><td>${escapeHtml(fmtISO(m.feesPaidOn))}</td><td>${escapeHtml(
            fmtISO(m.expiryDate)
          )}</td><td>${escapeHtml(m.membershipType)}</td></tr>`
      )
      .join("");

    const html = `<html>
<head>
<meta charset="UTF-8" />
<title>Memberships</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
  th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>Memberships</h1>
<p>Generated on ${escapeHtml(localISO(new Date()))} &middot; ${filtered.length} members</p>
<table>
<thead><tr><th>#</th><th>Member Name</th><th>Phone</th><th>CNIC</th><th>Package</th><th>Plan</th><th>Trainer</th><th>Payment</th><th>Fees Paid On</th><th>Expiry Date</th><th>Membership Type</th></tr></thead>
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
  };

  /* ---------- Toggle Monthly Fee (Mark Paid / Unmark) ---------- */
  const toggleMonthlyFee = async (feeId: number) => {
    setTogglingFeeId(feeId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/member-monthly-fees/${feeId}/toggle`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.message ?? "Could not update");
        return;
      }

      if (activeMember) {
        const updatedMonthlyFees = activeMember.monthlyFees.map((mf) =>
          mf.id === feeId
            ? {
                ...mf,
                status: mf.status === "paid" ? ("pending" as const) : ("paid" as const),
                paid_on: mf.status === "paid" ? null : new Date().toISOString().slice(0, 10),
              }
            : mf
        );

        const newPaymentStatus = computePaymentStatusFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.paymentStatus
        );

        const newFeesPaidOn = computeFeesPaidOnFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.feesPaidOn
        );

        const newExpiry = computeExpiryFromMonthlyFees(
          updatedMonthlyFees,
          activeMember.expiryDate
        );

        const updatedMember: MembershipRecord = {
          ...activeMember,
          monthlyFees: updatedMonthlyFees,
          paymentStatus: newPaymentStatus,
          expiryDate: newExpiry,
          feesPaidOn: newFeesPaidOn,
        };

        setActiveMember(updatedMember);

        setMembers((prev) =>
          prev.map((m) => (m.id === activeMember.id ? updatedMember : m))
        );
      }
    } catch {
      alert("Could not connect to the server.");
    } finally {
      setTogglingFeeId(null);
    }
  };

  /* ---------- Change / Remove trainer ---------- */
  const startEditTrainer = () => {
    if (!activeMember) return;
    const current = trainerList.find(
      (t) => t.name.trim().toLowerCase() === activeMember.trainer.trim().toLowerCase()
    );
    setSelectedTrainerId(current ? String(current.id) : "");
    setEditingTrainer(true);
  };

  const saveTrainer = async (trainerId: number | null) => {
    if (!activeMember) return;
    setSavingTrainer(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/members/${activeMember.id}/trainer`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ trainer_id: trainerId }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.message ?? "Could not update trainer");
        return;
      }

      const newName =
        trainerId === null ? "" : trainerList.find((t) => t.id === trainerId)?.name ?? "";

      const updatedMember: MembershipRecord = {
        ...activeMember,
        trainer: newName,
        membershipType: typeAfterTrainerChange(activeMember.membershipType, trainerId !== null),
      };

      setActiveMember(updatedMember);
      setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
      setEditingTrainer(false);
    } catch {
      alert("Could not connect to the server.");
    } finally {
      setSavingTrainer(false);
    }
  };

  const handleSaveTrainer = () => {
    if (!selectedTrainerId) {
      alert("Please select a trainer.");
      return;
    }
    saveTrainer(Number(selectedTrainerId));
  };

  const handleRemoveTrainer = () => {
    if (!activeMember) return;
    if (!window.confirm(`Remove trainer "${activeMember.trainer}" from ${activeMember.name}?`)) return;
    saveTrainer(null);
  };

  return (
    <div
      className="ms-page"
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
    >
      {/* Header */}
      <div className="ms-header">
        <div>
          <h1 className="ms-title">Memberships</h1>
          <p className="ms-subtitle">View and manage all gym memberships and their details.</p>
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
            <button type="button" style={excelBtnStyle} onClick={handleExportExcel}>
              <FileSpreadsheet size={16} />
              <span>Excel</span>
            </button>
            <button type="button" style={pdfBtnStyle} onClick={handleExportPdf}>
              <Download size={16} />
              <span>PDF</span>
            </button>
          </div>

          <div className="ms-datetime">
            <div className="ms-datetime-text">
              <span className="ms-date">{fmtDateLong(now)}</span>
              <span className="ms-time">{fmtTime(now)}</span>
            </div>
            <Calendar size={22} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="ms-stats">
        {stats.map((s) => (
          <div key={s.id} className="ms-stat-card">
            <div className={`ms-stat-icon ${s.variant}`}>{s.icon}</div>
            <div className="ms-stat-info">
              <span className="ms-stat-title">{s.title}</span>
              <span className="ms-stat-period">{s.period}</span>
              <span className="ms-stat-value">{loading ? "—" : s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="ms-panel">
        <div className="ms-toolbar">
          <div className="ms-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`ms-tab ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ms-toolbar-right">
            <div className="ms-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, phone or CNIC..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Trainer filter */}
            <div className="ms-select-wrap">
              <Users size={14} className="ms-select-lead" />
              <select
                className="ms-select"
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
              >
                <option value={ALL_TRAINERS}>{ALL_TRAINERS}</option>
                {trainerOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value={NO_TRAINER}>No Trainer</option>
              </select>
              <ChevronDown size={14} className="ms-select-icon" />
            </div>

            <div className="ms-select-wrap">
              <LayoutGrid size={14} className="ms-select-lead" />
              <select className="ms-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {planOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="ms-select-icon" />
            </div>
          </div>
        </div>

        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member Name</th>
                <th>Phone</th>
                <th>CNIC</th>
                <th>Package</th>
                <th>Plan</th>
                <th>Trainer</th>
                <th className="center">Payment</th>
                <th>Fees Paid On</th>
                <th>Expiry Date</th>
                <th className="center">Membership Type</th>
                <th className="center">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="ms-empty">
                    Loading members...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="ms-empty ms-error">
                    <div>{error}</div>
                    <button type="button" className="ms-retry" onClick={() => setReloadKey((k) => k + 1)}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="ms-empty">
                    No memberships found.
                  </td>
                </tr>
              ) : (
                rows.map((m, i) => (
                  <tr key={m.id}>
                    <td className="muted">{startIdx + i + 1}</td>
                    <td className="member-name">{m.name}</td>
                    <td>{dash(m.phone)}</td>
                    <td>{dash(m.cnic)}</td>
                    <td>{m.pkg}</td>
                    <td>{m.plan}</td>
                    <td>{m.trainer || "—"}</td>
                    <td className="center">
                      <span className={payClass(m.paymentStatus)}>{m.paymentStatus}</span>
                    </td>
                    <td>{fmtISO(m.feesPaidOn)}</td>
                    <td>{fmtISO(m.expiryDate)}</td>
                    <td className="center">
                      <span className={typeClass(m.membershipType)}>{m.membershipType}</span>
                    </td>
                    <td className="center">
                      <button
                        type="button"
                        className="ms-view-btn"
                        aria-label={`View ${m.name}`}
                        onClick={() => setActiveMember(m)}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ms-footer">
          <span className="ms-showing">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </span>

          <div className="ms-pagination">
            <button
              type="button"
              className="ms-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPages(totalPages, currentPage).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="ms-page-btn dots">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`ms-page-btn ${p === currentPage ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="ms-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Member Details modal */}
      {activeMember && (
        <div className="ms-overlay" onClick={() => setActiveMember(null)}>
          <div
            className="ms-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ms-modal-header">
              <h2>Member Details</h2>
              <button
                type="button"
                className="ms-modal-close"
                aria-label="Close"
                onClick={() => setActiveMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ms-modal-profile">
              <div>
                <h3>{activeMember.name}</h3>
                <p>{dash(activeMember.email)}</p>
              </div>
              <div className="ms-modal-badges">
                <span className={payClass(activeMember.paymentStatus)}>{activeMember.paymentStatus}</span>
              </div>
            </div>

            <div className="ms-modal-grid">
              <div className="ms-detail">
                <span className="ms-detail-label">Phone</span>
                <span className="ms-detail-value">{dash(activeMember.phone)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">CNIC</span>
                <span className="ms-detail-value">{dash(activeMember.cnic)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Package</span>
                <span className="ms-detail-value">{activeMember.pkg}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Member Type</span>
                <span className="ms-detail-value">{activeMember.membershipType}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Plan</span>
                <span className="ms-detail-value">{activeMember.plan}</span>
              </div>

              {/* Trainer + Change / Remove */}
              <div className="ms-detail">
                <span className="ms-detail-label">Trainer</span>
                <span className="ms-detail-value">{activeMember.trainer || "No trainer assigned"}</span>

                {editingTrainer ? (
                  <div className="ms-trainer-actions">
                    <select
                      className="ms-trainer-select"
                      value={selectedTrainerId}
                      onChange={(e) => setSelectedTrainerId(e.target.value)}
                      disabled={savingTrainer}
                    >
                      <option value="">Select trainer</option>
                      {trainerList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ms-trainer-btn save"
                      onClick={handleSaveTrainer}
                      disabled={savingTrainer}
                    >
                      {savingTrainer ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="ms-trainer-btn danger"
                      onClick={() => setEditingTrainer(false)}
                      disabled={savingTrainer}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="ms-trainer-actions">
                    <button
                      type="button"
                      className="ms-trainer-btn"
                      onClick={startEditTrainer}
                      disabled={savingTrainer}
                    >
                      {activeMember.trainer ? "Change" : "Assign Trainer"}
                    </button>
                    {activeMember.trainer && (
                      <button
                        type="button"
                        className="ms-trainer-btn danger"
                        onClick={handleRemoveTrainer}
                        disabled={savingTrainer}
                      >
                        {savingTrainer ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="ms-detail">
                <span className="ms-detail-label">Joined On</span>
                <span className="ms-detail-value">{fmtISO(activeMember.joinedOn)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Fees Paid On</span>
                <span className="ms-detail-value">{fmtISO(activeMember.feesPaidOn)}</span>
              </div>
              <div className="ms-detail">
                <span className="ms-detail-label">Fees Expiry On</span>
                <span className="ms-detail-value ms-detail-highlight">{fmtISO(activeMember.expiryDate)}</span>
              </div>
            </div>

            {/* Monthly Fee Breakdown */}
            {activeMember.monthlyFees && activeMember.monthlyFees.length > 0 && (
              <div className="ms-monthly-breakdown">
                <h4 className="ms-breakdown-title">
                  Monthly Fee Breakdown
                  <span className="ms-breakdown-sub">
                    {activeMember.monthlyFees.length} month
                    {activeMember.monthlyFees.length > 1 ? "s" : ""} ×{" "}
                    {formatPrice(activeMember.monthlyFees[0]?.fee_amount ?? 0)} each
                  </span>
                </h4>
                <div className="ms-breakdown-table-wrap">
                  <table className="ms-breakdown-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Month</th>
                        <th className="center">Fee</th>
                        <th className="center">Valid From</th>
                        <th className="center">Valid Till</th>
                        <th className="center">Status</th>
                        <th className="center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMember.monthlyFees.map((mf) => {
                        const isToggling = togglingFeeId === mf.id;
                        const isPaid = mf.status === "paid";

                        return (
                          <tr key={mf.id}>
                            <td className="muted">{mf.month_number}</td>
                            <td className="member-name">Month {mf.month_number}</td>
                            <td className="center salary-cell">{formatPrice(mf.fee_amount)}</td>
                            <td className="center">{fmtISO(mf.valid_from)}</td>
                            <td className="center">{fmtISO(mf.valid_till)}</td>
                            <td className="center">
                              <span className={`ms-pay ${isPaid ? "paid" : "unpaid"}`}>
                                {isPaid ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="center">
                              <button
                                type="button"
                                className={`ms-toggle-fee-btn ${isPaid ? "paid" : "pending"}`}
                                onClick={() => toggleMonthlyFee(mf.id)}
                                disabled={isToggling}
                                title={isPaid ? "Mark as Pending" : "Mark as Paid"}
                              >
                                {isToggling ? "..." : isPaid ? "Unmark" : "Mark Paid"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="ms-total-label">
                          Grand Total
                        </td>
                        <td className="center ms-total-value">
                          {formatPrice(
                            activeMember.monthlyFees.reduce((s, mf) => s + Number(mf.fee_amount), 0)
                          )}
                        </td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="ms-cnic-images">
              <div className="ms-cnic-block">
                <span className="ms-detail-label">CNIC Front</span>
                <CnicImage url={activeMember.cnicFrontUrl} label="CNIC Front" />
              </div>
              <div className="ms-cnic-block">
                <span className="ms-detail-label">CNIC Back</span>
                <CnicImage url={activeMember.cnicBackUrl} label="CNIC Back" />
              </div>
            </div>

            <div className="ms-modal-footer">
              <button type="button" className="ms-btn-secondary" onClick={() => setActiveMember(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Memberships;