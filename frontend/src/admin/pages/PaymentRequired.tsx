import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { QRCodeSVG } from "qrcode.react";
import {
  LuBan,
  LuCopy,
  LuCheck,
  LuSmartphone,
  LuLandmark,
  LuArrowLeft,
} from "react-icons/lu";
import { API_URL } from "../../../config";
import "./amounts.css";

// Gym admin login route (router file dekh kar confirm kar lena)
const LOGIN_ROUTE = "/login";

// PUBLIC endpoint: koi token / Authorization header nahi chahiye
const PUBLIC_CHANNELS_ENDPOINT = `${API_URL}/public/payment-channels`;

type ChannelType = "jazzcash" | "easypaisa" | "bank";

type Channel = {
  type: ChannelType;
  account_title: string;
  account_number: string;
  bank_name: string;
  iban: string;
  qr_url: string | null;
};

type Detail = { label: string; value: string };

const META: Record<ChannelType, { name: string; icon: IconType; tone: "red" | "green" | "blue" }> = {
  jazzcash: { name: "JazzCash", icon: LuSmartphone, tone: "red" },
  easypaisa: { name: "Easypaisa", icon: LuSmartphone, tone: "green" },
  bank: { name: "Bank Transfer", icon: LuLandmark, tone: "blue" },
};

const CHANNEL_ORDER: ChannelType[] = ["jazzcash", "easypaisa", "bank"];

/* Only the details that are filled in (empty ones are hidden) */
const detailsOf = (c: Channel): Detail[] => {
  const list: Detail[] =
    c.type === "bank"
      ? [
          { label: "Bank Name", value: c.bank_name },
          { label: "Account Title", value: c.account_title },
          { label: "Account Number", value: c.account_number },
          { label: "IBAN", value: c.iban },
        ]
      : [
          { label: "Account Title", value: c.account_title },
          { label: "Mobile Number", value: c.account_number },
        ];
  return list.filter((d) => d.value.trim() !== "");
};

/* ------------------------------------------------------------
   Copy button
   ------------------------------------------------------------ */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert("Couldn't copy. Please try again.");
    }
  };

  return (
    <button
      type="button"
      className={`amt-copy ${copied ? "amt-copy-done" : ""}`}
      onClick={handleCopy}
      title="Copy"
    >
      {copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
    </button>
  );
}

/* ------------------------------------------------------------
   Payment method card
   ------------------------------------------------------------ */
function MethodCard({ channel }: { channel: Channel }) {
  const meta = META[channel.type];
  const Icon = meta.icon;
  const details = detailsOf(channel);

  // If no QR image was uploaded, generate a QR code from the details instead
  const fallbackQr = `${meta.name}\n` + details.map((d) => `${d.label}: ${d.value}`).join("\n");

  return (
    <div className="amt-method">
      <div className={`amt-method-head amt-tone-${meta.tone}`}>
        <div className="amt-method-icon">
          <Icon size={20} />
        </div>
        <h3 className="amt-method-name">{meta.name}</h3>
      </div>

      <div className="amt-method-body">
        <div className="amt-qr-wrap">
          <div className="amt-qr">
            {channel.qr_url ? (
              <img
                src={channel.qr_url}
                alt={`${meta.name} QR`}
                style={{ width: 148, height: 148, objectFit: "contain", display: "block" }}
              />
            ) : (
              <QRCodeSVG value={fallbackQr} size={148} level="M" bgColor="#ffffff" fgColor="#000000" />
            )}
          </div>
          <p className="amt-qr-note">Scan to pay</p>
        </div>

        <div className="amt-details">
          {details.map((d) => (
            <div key={d.label} className="amt-detail">
              <div className="amt-detail-text">
                <span className="amt-detail-label">{d.label}</span>
                <span className="amt-detail-value">{d.value}</span>
              </div>
              <CopyButton value={d.value} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Main page (PUBLIC - koi auth check nahi)
   ------------------------------------------------------------ */
export default function PaymentRequired() {
  const navigate = useNavigate();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Bina Authorization header ke
      const res = await fetch(PUBLIC_CHANNELS_ENDPOINT, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];

      const list: Channel[] = rows
        .filter(
          (r: any) =>
            r &&
            r.type in META &&
            r.is_active !== false &&
            r.is_active !== 0 &&
            r.is_active !== "0"
        )
        .map((r: any) => ({
          type: r.type as ChannelType,
          account_title: r.account_title ?? "",
          account_number: r.account_number ?? "",
          bank_name: r.bank_name ?? "",
          iban: r.iban ?? "",
          qr_url: r.qr_url ?? null,
        }))
        .sort(
          (a: Channel, b: Channel) =>
            CHANNEL_ORDER.indexOf(a.type) - CHANNEL_ORDER.indexOf(b.type)
        );

      setChannels(list);
    } catch (e: any) {
      setError(e?.message || "Could not load payment details");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="amt-blocked-screen">
      <div className="amt-page">
        {/* Blocked banner */}
        <div className="amt-blocked-banner">
          <div className="amt-blocked-icon">
            <LuBan size={28} />
          </div>
          <div className="amt-blocked-body">
            <h1 className="amt-blocked-title">Account Blocked</h1>
            <p className="amt-blocked-text">
              Your account is blocked. Please clear your payment to restore access.
            </p>
            <p className="amt-blocked-hint">
              Neeche diye gaye kisi bhi ek method se payment karein. Payment verify hone ke baad aap ka account
              dobara chal jayega.
            </p>
          </div>
        </div>

        {/* Payment methods */}
        <div className="amt-methods-section">
          <h2 className="amt-section-title">Payment Methods</h2>
          <p className="amt-section-sub">Scan the QR code or copy the details to send your payment.</p>

          {loading ? (
            <div className="amt-notice">Loading...</div>
          ) : error ? (
            <div className="amt-notice amt-notice-error">
              {error}
              <button type="button" onClick={load}>
                Retry
              </button>
            </div>
          ) : channels.length === 0 ? (
            <div className="amt-notice">
              Payment details abhi add nahi hui. Please contact the admin.
            </div>
          ) : (
            <div className="amt-methods-grid">
              {channels.map((c) => (
                <MethodCard key={c.type} channel={c} />
              ))}
            </div>
          )}
        </div>

        {/* Back to login */}
        <div className="amt-back-wrap">
          <button
            type="button"
            className="amt-back-btn"
            onClick={() => navigate(LOGIN_ROUTE, { replace: true })}
          >
            <LuArrowLeft size={18} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}