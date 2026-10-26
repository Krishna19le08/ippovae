import Link from "next/link";
import Choreo from "@/components/Choreo";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found | ippovae" };

export default function NotFound() {
  return (
    <>
      <Choreo />
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-[1312px] flex-col items-center gap-4 px-4 py-24 text-center outline-none">
        <p className="font-mono text-xs font-semibold tracking-[0.16em] text-foreground uppercase">Error 404</p>
        <h1 className="text-4xl font-bold tracking-tight">We could not find that page</h1>
        <p className="max-w-md text-muted-foreground">The part or page you are looking for may have moved. Browse the catalogue or search for a part number.</p>
        <Button asChild className="mt-2 h-11 rounded-full px-6 text-base">
          <Link href="/products">Shop all parts</Link>
        </Button>
      </main>
    </>
  );
}
