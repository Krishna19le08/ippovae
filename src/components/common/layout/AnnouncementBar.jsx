import Link from "next/link";
import { HUB, SITE } from "@/data";

// Thin dark strip above the header (medium screens and up).
export default function AnnouncementBar() {
  return (
    <div role="region" aria-label="Announcement" className="surface-ink hidden bg-ink font-mono md:block text-[11px] tracking-wide text-white/80 uppercase">
      <div className="mx-auto flex max-w-[1312px] items-center justify-between px-4 py-2">
        <span>Trusted supplier of bearings &amp; belts · Fast delivery</span>
        <span className="hidden gap-3 sm:flex">
          <Link href="/products">Catalogue</Link>|<Link href={HUB} className="normal-case">ippovae Hub</Link>|
          <Link href={`${SITE}/faq`}>Contact</Link>
        </span>
      </div>
    </div>
  );
}
