"use client";
import { Suspense } from "react";
import CustomerShell from "@/components/customer/CustomerShell";
import TicketsList from "@/components/customer/TicketsList";

export default function TicketsPage() {
  return (
    <CustomerShell title="Support requests">
      <Suspense>
        <TicketsList />
      </Suspense>
    </CustomerShell>
  );
}
