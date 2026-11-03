"use client";
import { Suspense } from "react";
import Head from "next/head";
import CustomerShell from "@/components/common/layout/CustomerShell";
import TicketsList from "@/components/pages/TicketsList";

export default function TicketsPage() {
  return (
    <CustomerShell title="Support requests">
      <Head><title>Help | ippovae</title></Head>
      <Suspense>
        <TicketsList />
      </Suspense>
    </CustomerShell>
  );
}
