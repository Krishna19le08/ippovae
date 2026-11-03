"use client";
import { Suspense } from "react";
import Head from "next/head";
import CustomerShell from "@/components/common/layout/CustomerShell";
import TicketDetail from "@/components/pages/TicketDetail";

// Ticket conversation: the id comes from the [id] route segment.
export default function TicketViewPage() {
  return (
    <CustomerShell>
      <Head><title>Help | ippovae</title></Head>
      <Suspense>
        <TicketDetail />
      </Suspense>
    </CustomerShell>
  );
}
