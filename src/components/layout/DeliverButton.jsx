import { MapPin } from "@/components/ui/icons";

const titleCase = (text) =>
  String(text || "").toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase());

// "Deliver to <city> <pincode>" button in the header. `onOpen(button)` gets the button so focus can return to it.
export default function DeliverButton({ address, onOpen, className }) {
  const place = address ? `${titleCase(address.city || address.name)} ${address.pincode}`.trim() : "Add delivery address";

  return (
    <button type="button" aria-haspopup="dialog" onClick={(e) => onOpen(e.currentTarget)} className={className}>
      <MapPin className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-col text-left leading-tight">
        {address && <span className="text-[11px] font-normal text-white/70">Deliver to</span>}
        <span className="truncate font-semibold">{place}</span>
      </span>
    </button>
  );
}
