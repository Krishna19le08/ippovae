import Head from "next/head";
import CheckoutPayment from "@/components/pages/CheckoutPayment";

export default function PaymentPage() {
  return (
    <>
      <Head><title>Payment | ippovae</title></Head>
      <CheckoutPayment />
    </>
  );
}
