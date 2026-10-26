import localFont from "next/font/local";
import "./globals.css";
import KeyboardAssist from "@/components/KeyboardAssist";
import { withBase } from "@/lib/asset";

const inter = localFont({
  src: [
    { path: "./fonts/Inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Inter-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Inter-800.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

// resizes-content: the on-screen keyboard shrinks the page (and fixed drawers) instead of covering the bottom of it
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0B0B0B", interactiveWidget: "resizes-content" };

export const metadata = {
  manifest: withBase("/manifest.webmanifest"),
  appleWebApp: { capable: true, title: "ippovae", statusBarStyle: "black-translucent" },
  icons: { icon: withBase("/icon-192.png"), apple: withBase("/icon-192.png") },
  title: "ippovae | Parts at your doorstep.",
  description:
    "Industrial spare parts, bearings, belts and more with fast delivery. What do you need right now?",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-xl"
        >
          Skip to main content
        </a>
        {children}
        <KeyboardAssist />
      </body>
    </html>
  );
}
