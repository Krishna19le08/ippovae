import Head from "next/head";
import CheckoutSummary from "@/components/pages/CheckoutSummary";

export default function CheckoutSummaryPage() {
  return (
    <>
      <Head><title>Order Summary | ippovae</title></Head>
      <CheckoutSummary />
    </>
  );
}
