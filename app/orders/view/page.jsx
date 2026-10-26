"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/customer/CustomerShell";
import OrderDetail from "@/components/customer/OrderDetail";

// Order detail for the static export: the id comes from ?id= (no dynamic segment).
export default function OrderViewPage() {
  return (
    <CustomerShell>
      <Suspense>
        <OrderDetail />
      </Suspense>
    </CustomerShell>
  );
}
