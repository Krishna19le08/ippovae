"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/customer/CustomerShell";
import TicketDetail from "@/components/customer/TicketDetail";

// Ticket conversation for the static export: the id comes from ?id=.
export default function TicketViewPage() {
  return (
    <CustomerShell>
      <Suspense>
        <TicketDetail />
      </Suspense>
    </CustomerShell>
  );
}
