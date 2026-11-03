import { Button } from "@/components/ui/button";
import CardPayment from "@/components/checkout/CardPayment";
import { inr } from "@/data";
import AddressBlock from "./AddressBlock";
import Breakdown from "./Breakdown";
import MiniSummary from "./MiniSummary";
import { PAYMENT_METHODS } from "./paymentMethods";

export function submitLabel({ busy, method, cardStage, quote }) {
  if (busy) return "Placing order...";
  if (method === "cod") return "Place Order";
  if (method === "card" && cardStage === "front") return "Next";
  return `Pay ${inr((quote.total || 0) / 100)}`;
}

// Step 4: choose how to pay (and enter card details) and place the order. `payment` comes from usePayment.
// `formId` + `hideFooter`: the page renders the totals and pay button itself (beside the form) and submits this form by id.
export default function PaymentStep({ address, count, total, quote, method, onMethodChange, payment, onChangeAddress, formId, hideFooter = false }) {
  const { onCardBack } = payment;

  return (
    <form id={formId} onSubmit={payment.submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {!hideFooter && <MiniSummary count={count} total={total} />}
        {!onCardBack && <AddressBlock address={address} onChange={onChangeAddress} />}

        {!onCardBack && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Payment method</legend>
            {PAYMENT_METHODS.map(({ id, label, note, Icon }) => (
              <label
                key={id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                  method === id ? "border-foreground bg-accent" : "border-slate-200"
                }`}
              >
                <input type="radio" name="method" className="size-4 accent-foreground" checked={method === id} onChange={() => onMethodChange(id)} />
                <Icon className="size-5 text-foreground" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{note}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {method === "card" && (
          <CardPayment
            card={payment.card}
            setCard={payment.setCard}
            stage={payment.cardStage}
            errors={payment.cardErrors}
            onBack={payment.backToCardFront}
          />
        )}
      </div>

      {!hideFooter && <div className="border-t border-slate-200 p-4">
        <Breakdown quote={quote} />
        {payment.error && <p role="alert" className="mb-3 text-sm font-medium text-red-700">{payment.error}</p>}
        <Button type="submit" disabled={payment.busy || quote.status !== "ok"} className="h-11 w-full rounded-xl">
          {submitLabel({ busy: payment.busy, method, cardStage: payment.cardStage, quote })}
        </Button>
      </div>}
    </form>
  );
}
