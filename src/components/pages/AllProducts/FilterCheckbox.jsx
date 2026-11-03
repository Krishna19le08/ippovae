import { Check } from "@/components/ui/icons";

// One checkbox row in the filter panel, with an optional result count.
export default function FilterCheckbox({ checked, onChange, label, count }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 max-lg:min-h-11 text-sm transition-colors ${
        checked ? "bg-accent font-medium text-foreground" : "hover:bg-slate-50"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-1 ${
          checked ? "border-foreground bg-primary text-primary-foreground" : "border-input bg-white"
        }`}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {count != null && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] leading-none ${
            checked ? "bg-accent text-foreground" : "bg-slate-100 text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );
}
