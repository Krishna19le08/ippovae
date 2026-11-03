import { Fragment } from "react";
import Head from "next/head";
import PlatformOrders from "@/components/pages/PlatformOrders";

export default function OrdersPage() {
  return (
    <Fragment>
      <Head><title>Your Orders | ippovae</title></Head>
      <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-[1312px] px-4 pt-10 pb-28 outline-none lg:pb-16">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Your Orders</h1>
        <PlatformOrders />
      </main>
    </Fragment>
  );
}
