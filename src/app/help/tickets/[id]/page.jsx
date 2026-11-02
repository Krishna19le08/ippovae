"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/layout/CustomerShell";
import TicketDetail from "@/features/support/components/TicketDetail";

// Ticket conversation: the id comes from the [id] route segment.
export default function TicketViewPage() {
  return (
    <CustomerShell>
      <Suspense>
        <TicketDetail />
      </Suspense>
    </CustomerShell>
  );
}
