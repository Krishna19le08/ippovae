import Link from "next/link";
import { MapPin } from "@/components/ui/icons";
import { addressLines } from "@/components/checkout/addresses";

// The chosen delivery address with a "Change" button.
export default function AddressBlock({ address, onChange }) {
  const { line1, line2 } = addressLines(address);
  return (
    <section aria-label="Delivery address" className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
      <MapPin className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {address.name} · {address.phone}
        </div>
        <div className="text-muted-foreground">{line1}</div>
        <div className="text-muted-foreground">{line2}</div>
        {address.coords && (
          <Link
            href={`https://www.google.com/maps?q=${address.coords.lat},${address.coords.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block py-1 text-xs font-medium text-foreground underline underline-offset-4"
          >
            View on map
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-label="Change delivery address"
        className="-m-1 min-h-10 rounded-md px-2 text-sm font-medium text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Change
      </button>
    </section>
  );
}
