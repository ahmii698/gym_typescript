import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { LuSmartphone, LuLandmark, LuUpload, LuTrash2, LuSave, LuCircleCheck, LuImage } from "react-icons/lu";
import { API_URL } from "../../../config"; // keep the same path used in payments.tsx
import Sidebar from "./sidebar";
import "./dashboard.css"; // sas-layout / sas-content
import "./moneychannel.css";

/* ------------------------------------------------------------------ */
/*  BACKEND SETTINGS                                                    */
/* ------------------------------------------------------------------ */
const LIST_ENDPOINT = `${API_URL}/super-admin/payment-channels`; // GET
const SAVE_ENDPOINT = (type: string) => `${API_URL}/super-admin/payment-channels/${type}`; // POST (multipart)

type ChannelType = "jazzcash" | "easypaisa" | "bank";

type Channel = {
  type: ChannelType;
  account_title: string;
  account_number: string;
  bank_name: string;
  iban: string;
  qr_url: string | null;
  is_active: boolean;
};

const META: Record<ChannelType, { name: string; icon: IconType; tone: "red" | "green" | "blue"; numberLabel: string }> = {
  jazzcash: { name: "JazzCash", icon: LuSmartphone, tone: "red", numberLabel: "Mobile Number" },
  easypaisa: { name: "Easypaisa", icon: LuSmartphone, tone: "green", numberLabel: "Mobile Number" },
  bank: { name: "Bank Transfer", icon: LuLandmark, tone: "blue", numberLabel: "Account Number" },
};

const ORDER: ChannelType[] = ["jazzcash", "easypaisa", "bank"];

// In-memory cache: coming back to this page shows the last data instantly
let channelsCache: Channel[] | null = null;

const normalize = (json: any): Channel[] => {
  const rows = Array.isArray(json?.data) ? json.data : [];
  return ORDER.map((type) => {
    const r = rows.find((x: any) => x.type === type) ?? {};
    return {
      type,
      account_title: r.account_title ?? "",
      account_number: r.account_number ?? "",
      bank_name: r.bank_name ?? "",
      iban: r.iban ?? "",
      qr_url: r.qr_url ?? null,
      is_active: r.is_active ?? true,
    };
  });
};

const MAX_QR_MB = 3;
const ALLOWED = ["image/jpeg", "image/png"];

/* ------------------------------------------------------------------ */
/*  One channel card (form)                                             */
/* ------------------------------------------------------------------ */
function ChannelCard({ channel, token, onSaved }: { channel: Channel; token: string; onSaved: () => void }) {
  const meta = META[channel.type];
  const Icon = meta.icon;
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(channel.account_title);
  const [number, setNumber] = useState(channel.account_number);
  const [bankName, setBankName] = useState(channel.bank_name);
  const [iban, setIban] = useState(channel.iban);
  const [active, setActive] = useState(channel.is_active);

  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>(channel.qr_url ?? "");
  const [removeQr, setRemoveQr] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const pickQr = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("Please upload a JPG or PNG image only");
      return;
    }
    if (f.size > MAX_QR_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_QR_MB}MB`);
      return;
    }
    if (qrFile && qrPreview) URL.revokeObjectURL(qrPreview);
    setError("");
    setQrFile(f);
    setQrPreview(URL.createObjectURL(f));
    setRemoveQr(false);
  };

  const clearQr = () => {
    if (qrFile && qrPreview) URL.revokeObjectURL(qrPreview);
    setQrFile(null);
    setQrPreview("");
    setRemoveQr(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const fd = new FormData();
      fd.append("account_title", title.trim());
      fd.append("account_number", number.trim());
      if (channel.type === "bank") {
        fd.append("bank_name", bankName.trim());
        fd.append("iban", iban.trim());
      }
      fd.append("is_active", active ? "1" : "0");
      if (qrFile) fd.append("qr", qrFile);
      if (removeQr) fd.append("remove_qr", "1");

      const res = await fetch(SAVE_ENDPOINT(channel.type), {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, // the browser sets Content-Type automatically
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const firstError = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
        throw new Error(firstError || data?.message || `Server error ${res.status}`);
      }

      setQrFile(null);
      setRemoveQr(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mch-card">
      <div className={`mch-card-head mch-tone-${meta.tone}`}>
        <div className="mch-card-icon">
          <Icon size={20} />
        </div>
        <h3 className="mch-card-name">{meta.name}</h3>
        <label className="mch-switch" title="Show this channel to gym admins?">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>{active ? "Visible" : "Hidden"}</span>
        </label>
      </div>

      <div className="mch-card-body">
        {/* QR / scanner image */}
        <div className="mch-qr-box">
          {qrPreview ? (
            <img src={qrPreview} alt={`${meta.name} QR`} className="mch-qr-img" decoding="async" />
          ) : (
            <div className="mch-qr-empty">
              <LuImage size={28} />
              <span>No QR / scanner image uploaded</span>
            </div>
          )}
        </div>

        <div className="mch-qr-actions">
          <button type="button" className="mch-btn mch-btn-ghost" onClick={() => fileRef.current?.click()}>
            <LuUpload size={14} />
            {qrPreview ? "Change QR" : "Upload QR"}
          </button>
          {qrPreview && (
            <button type="button" className="mch-btn mch-btn-danger" onClick={clearQr}>
              <LuTrash2 size={14} />
              Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png, image/jpeg" hidden onChange={pickQr} />
        </div>

        {/* Details */}
        {channel.type === "bank" && (
          <div className="mch-field">
            <label>Bank Name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Meezan Bank" />
          </div>
        )}

        <div className="mch-field">
          <label>Account Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account holder name" />
        </div>

        <div className="mch-field">
          <label>{meta.numberLabel}</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={channel.type === "bank" ? "Account number" : "03XX-XXXXXXX"}
          />
        </div>

        {channel.type === "bank" && (
          <div className="mch-field">
            <label>IBAN</label>
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="PKXX XXXX XXXX XXXX XXXX XXXX" />
          </div>
        )}

        {error && <p className="mch-error">{error}</p>}

        <button type="button" className="mch-btn mch-btn-save" onClick={save} disabled={saving}>
          {saved ? <LuCircleCheck size={16} /> : <LuSave size={16} />}
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function MoneyChannel() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");

  const [channels, setChannels] = useState<Channel[]>(() => channelsCache ?? []);
  const [loading, setLoading] = useState(() => !channelsCache);
  const [error, setError] = useState("");

  // Used to cancel an older request when a newer one starts
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) navigate("/super-admin/login", { replace: true });
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/super-admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
    } catch {
      /* log out locally even if the server is unreachable */
    }
    channelsCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  /**
   * Cached data is shown right away and refreshed silently.
   * "Loading..." only appears on the very first visit (nothing cached yet),
   * and never after a Save, so the cards don't disappear.
   */
  const load = useCallback(async () => {
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (channelsCache === null) setLoading(true);
    setError("");

    try {
      const res = await fetch(LIST_ENDPOINT, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        channelsCache = null;
        localStorage.removeItem("sa_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const list = normalize(await res.json());
      channelsCache = list;
      setChannels(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return; // a newer load took over
      setError(e?.message || "Could not load channels");
      // keep showing the data we already have
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort(); // cancel the request when leaving the page
    };
  }, [load]);

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="mch-page">
          <div className="mch-header">
            <h1 className="mch-title">Money Channels</h1>
            <p className="mch-subtitle">
              Add your JazzCash, Easypaisa, and bank details along with the QR (scanner) image here. Gym admins will see
              them on the Amounts page.
            </p>
          </div>

          {error && (
            <div className="mch-alert">
              {error}
              <button className="mch-alert-btn" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {loading && channels.length === 0 ? (
            <div className="mch-loading">Loading...</div>
          ) : (
            channels.length > 0 && (
              <div className="mch-grid">
                {channels.map((c) => (
                  // The key uses only type + qr_url: the form remounts only when the QR image changes,
                  // so typing or saving never resets the card
                  <ChannelCard
                    key={`${c.type}-${c.qr_url ?? ""}`}
                    channel={c}
                    token={token}
                    onSaved={load}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}