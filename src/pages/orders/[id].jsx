"use client";
import { Suspense } from "react";
import Head from "next/head";
import CustomerShell from "@/components/common/layout/CustomerShell";
import OrderDetail from "@/components/pages/OrderDetail";

// Order detail: the id comes from the [id] route segment; the order itself lives in this browser.
export default function OrderViewPage() {
  return (
    <CustomerShell>
      <Head><title>Order | ippovae</title></Head>
      <Suspense>
        <OrderDetail />
      </Suspense>
    </CustomerShell>
  );
}
