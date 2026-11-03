import localFont from "next/font/local";
import Head from "next/head";
import Link from "next/link";
import "../styles/globals.css";
import Header from "@/components/common/layout/Header";
import KeyboardAssist from "@/components/common/layout/KeyboardAssist";
import { Fragment } from "react";
import { withBase } from "@/lib/asset";

const inter = localFont({
  src: [
    { path: "../assets/fonts/Inter-400.woff", weight: "400", style: "normal" },
    { path: "../assets/fonts/Inter-500.woff", weight: "500", style: "normal" },
    { path: "../assets/fonts/Inter-600.woff", weight: "600", style: "normal" },
    { path: "../assets/fonts/Inter-700.woff", weight: "700", style: "normal" },
    { path: "../assets/fonts/Inter-800.woff", weight: "800", style: "normal" },
  ],
  display: "swap",
});

export default function App({ Component, pageProps }) {
  return (
    <Fragment>
      <Head>
        {/* resizes-content: the on-screen keyboard shrinks the page (and fixed drawers) instead of covering the bottom of it */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#0B0B0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ippovae" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href={withBase("/manifest.webmanifest")} />
        <link rel="icon" href={withBase("/icon-192.png")} />
        <link rel="apple-touch-icon" href={withBase("/icon-192.png")} />
        <title>ippovae | Parts at your doorstep.</title>
        <meta name="description" content="Industrial spare parts, bearings, belts and more with fast delivery. What do you need right now?" />
      </Head>
      <style jsx global>{`
        :root {
          --font-inter: ${inter.style.fontFamily};
        }
      `}</style>
      <Link
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-xl"
      >
        Skip to main content
      </Link>
      <Header />
      <Component {...pageProps} />
      <KeyboardAssist />
    </Fragment>
  );
}
