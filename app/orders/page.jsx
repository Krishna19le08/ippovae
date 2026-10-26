import Header from "@/components/Header";
import OrdersList from "@/components/OrdersList";
import PlatformOrders from "@/components/customer/PlatformOrders";

export const metadata = { title: "Your Orders | ippovae" };

export default function OrdersPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-[1312px] px-4 pt-10 pb-28 outline-none lg:pb-16">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Your Orders</h1>
        <PlatformOrders />
        <OrdersList />
      </main>
    </>
  );
}
