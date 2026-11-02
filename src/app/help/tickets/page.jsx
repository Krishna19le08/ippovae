"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/layout/CustomerShell";
import TicketsList from "@/features/support/components/TicketsList";

export default function TicketsPage() {
  return (
    <CustomerShell title="Support requests">
      <Suspense>
        <TicketsList />
      </Suspense>
    </CustomerShell>
  );
}
