"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/layout/CustomerShell";
import OrderDetail from "@/features/orders/components/OrderDetail";

// Order detail: the id comes from the [id] route segment; the order itself lives in this browser.
export default function OrderViewPage() {
  return (
    <CustomerShell>
      <Suspense>
        <OrderDetail />
      </Suspense>
    </CustomerShell>
  );
}
