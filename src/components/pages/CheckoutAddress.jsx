"use client";
import { useRouter } from "next/navigation";
import AddressBook from "@/components/checkout/AddressBook";
import CheckoutLayout, { EmptyCart, Loading, OrderAside } from "@/components/checkout/CheckoutLayout";
import { useCheckoutData } from "@/components/checkout/useCheckoutData";

// Checkout step 1 as a page: choose or add the delivery address.
export default function CheckoutAddress() {
  const router = useRouter();
  const { lines, count, ready } = useCheckoutData();

  let content;
  if (!ready) content = <Loading />;
  else if (lines.length === 0) content = <EmptyCart />;
  else
    content = (
      <div className="space-y-4 p-4">
        <AddressBook mode="checkout" onDeliver={() => router.push("/checkout/summary")} />
      </div>
    );

  return (
    <CheckoutLayout
      step="address"
      title="Delivery Address"
      backHref="/products"
      backLabel="Continue shopping"
      aside={ready && lines.length > 0 ? <OrderAside lines={lines} count={count} /> : null}
    >
      {content}
    </CheckoutLayout>
  );
}
