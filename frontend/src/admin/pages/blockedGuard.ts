import axios from "axios";

/* ============================================================
   Company Block guard
   Backend jab 403 + { code: "company_blocked" } bheje to:
   token / role / name saaf karo aur /payment-required par bhej do.
   Dono ke liye kaam karta hai: fetch (apiFetch / blockedGuard)
   aur axios (neeche global interceptor).
   ============================================================ */

export const PAYMENT_REQUIRED_ROUTE = "/payment-required";

// Gym admin panel (admin / frontdesk / trainer) ki localStorage keys.
// Login ye 3 keys save karta hai: token, role, name.
// NOTE: "sa_token" / "sa_user" super admin ke hain, unhe yahan mat daalna.
const ADMIN_STORAGE_KEYS = ["token", "role", "name"];

/* Sab admin related data saaf karke payment-required page par bhejta hai */
export function handleCompanyBlocked() {
  // Pehle se payment page par ho to dobara redirect mat karo
  if (window.location.pathname === PAYMENT_REQUIRED_ROUTE) return;

  try {
    ADMIN_STORAGE_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {
    /* storage blocked ho to bhi redirect chalega */
  }
  // Full redirect: pending requests aur purani state dono khatam
  window.location.replace(PAYMENT_REQUIRED_ROUTE);
}

/* Response 403 + code "company_blocked" hai ya nahi (body consume nahi karta) */
export async function isCompanyBlocked(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const data = await res.clone().json().catch(() => null);
  return data?.code === "company_blocked";
}

/* Response check karo; blocked ho to redirect karo aur true return karo */
export async function blockedGuard(res: Response): Promise<boolean> {
  if (await isCompanyBlocked(res)) {
    handleCompanyBlocked();
    return true;
  }
  return false;
}

/* Normal fetch jaisa hi, bas blocked hone par khud redirect kar deta hai */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  await blockedGuard(res);
  return res;
}

/* ------------------------------------------------------------
   Global axios interceptor: kisi bhi axios call par 403
   "company_blocked" aaye to khud redirect ho jayega.
   (Login page apna 403 khud sambhalta hai, dono ka nateeja same hai.)
   ------------------------------------------------------------ */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 403 && error?.response?.data?.code === "company_blocked") {
      handleCompanyBlocked();
    }
    return Promise.reject(error);
  }
);