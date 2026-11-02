import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { inr } from "@/data";
import { PAYMENT_METHODS } from "./paymentMethods";

const REMOVE_BUTTON = "-m-2.5 self-start rounded-md p-3 text-muted-foreground transition-colors hover:text-red-600";

function CartLine({ product: p, qty, setQty }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
      <div className="size-20 shrink-0 rounded-lg bg-slate-50">
        <img src={p.img} alt={p.name} className="size-full object-contain p-1 mix-blend-multiply" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.cat}</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200">
            <button className="p-3" aria-label={`Decrease quantity of ${p.name}`} onClick={() => setQty(p.slug, qty - 1)}>
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-5 text-center text-sm">{qty}</span>
            <button className="p-3" aria-label={`Increase quantity of ${p.name}`} onClick={() => setQty(p.slug, qty + 1)}>
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <span className="font-bold whitespace-nowrap">{inr(p.price * qty)}</span>
        </div>
      </div>
      <button aria-label={`Remove ${p.name} from cart`} className={REMOVE_BUTTON} onClick={() => setQty(p.slug, 0)}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// A cart entry whose product was deleted from the catalogue.
function UnavailableLine({ slug, qty, setQty }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
      <div className="size-20 shrink-0 rounded-lg bg-slate-50" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-muted-foreground">Unavailable item</div>
        <div className="truncate text-xs text-muted-foreground">{slug}</div>
        <div className="text-xs text-red-700">No longer available (Qty {qty}). It is not included in your total.</div>
      </div>
      <button aria-label={`Remove ${slug} from cart`} className={REMOVE_BUTTON} onClick={() => setQty(slug, 0)}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// Step 1: the items in the cart, with quantity controls and the subtotal.
export default function CartStep({ lines, unavailable, total, setQty, onClose, onCheckout }) {
  const isEmpty = lines.length === 0 && unavailable.length === 0;
  const methodNames = PAYMENT_METHODS.map((m) => m.label);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ShoppingCart className="size-10" />
            <p>Your cart is empty</p>
            <Button asChild className="mt-2 h-11 rounded-xl px-6" onClick={onClose}>
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        ) : (
          lines.map(({ p, qty }) => <CartLine key={p.slug} product={p} qty={qty} setQty={setQty} />)
        )}
        {unavailable.map(({ slug, qty }) => (
          <UnavailableLine key={slug} slug={slug} qty={qty} setQty={setQty} />
        ))}
      </div>

      {lines.length > 0 && (
        <div className="border-t border-slate-200 p-4 [@media(max-height:500px)]:flex [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:p-2">
          <div className="mb-3 flex justify-between gap-3 font-semibold [@media(max-height:500px)]:mb-0">
            <span>Subtotal</span>
            <span>{inr(total)}</span>
          </div>
          <Button onClick={onCheckout} className="h-11 w-full rounded-xl [@media(max-height:500px)]:flex-1">
            Proceed to Payment
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground [@media(max-height:500px)]:hidden">
            Pay by {methodNames.slice(0, -1).join(", ")} or {methodNames[methodNames.length - 1]}.
          </p>
        </div>
      )}
    </>
  );
}
