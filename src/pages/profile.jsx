import { Fragment, Suspense } from "react";
import Head from "next/head";
import BackButton from "@/components/common/BackButton";
import ProfilePage from "@/components/pages/ProfilePage";

export default function Page() {
  return (
    <Fragment>
      <Head><title>Your Profile | ippovae</title></Head>
      <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-[1312px] px-4 pt-10 pb-28 outline-none lg:pb-16">
        <div className="mb-6 flex items-center gap-3">
          <BackButton fallback="/" label="" className="mb-0 size-9 max-md:size-11 shrink-0 justify-center rounded-full border border-border hover:bg-accent hover:no-underline" />
          <h1 className="text-3xl font-extrabold tracking-tight">Your Profile</h1>
        </div>
        <Suspense>
          <ProfilePage />
        </Suspense>
      </main>
    </Fragment>
  );
}
