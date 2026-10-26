import { inr } from "@/lib/data";

/** Integer paise to INR text, same style as the shop. */
export const formatMoney = (paise) => (Number.isFinite(paise) ? inr(paise / 100) : "—");

export default function Money({ paise, className = "", signed = false }) {
  const neg = signed && paise < 0;
  return <span className={`tabular-nums ${className}`}>{neg ? "−" : ""}{formatMoney(neg ? -paise : paise)}</span>;
}
