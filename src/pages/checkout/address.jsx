import Head from "next/head";
import CheckoutAddress from "@/components/pages/CheckoutAddress";

export default function CheckoutAddressPage() {
  return (
    <>
      <Head><title>Delivery Address | ippovae</title></Head>
      <CheckoutAddress />
    </>
  );
}
