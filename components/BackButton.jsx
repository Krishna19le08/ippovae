"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/components/icons";

export default function BackButton({ fallback = "/products", className = "mb-4", label = "Back" }) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push(fallback));
  return (
    <button
      type="button"
      onClick={back}
      aria-label="Go back"
      className={`inline-flex items-center gap-1 py-1.5 max-md:min-h-11 text-sm font-medium text-foreground hover:underline ${className}`}
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}
