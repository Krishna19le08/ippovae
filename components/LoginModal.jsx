"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "@/components/icons";
import LoginForm from "@/components/LoginForm";
import { useDialogFocus } from "@/lib/useDialogFocus";

export default function LoginModal({ open, onClose, onLogin, startSignup, context = "", returnRef }) {
  const dialogRef = useDialogFocus(open, returnRef);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 max-md:items-stretch max-md:p-0">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Login"
        aria-modal="true"
        className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white text-foreground shadow-2xl max-md:h-full max-md:max-w-none max-md:rounded-none max-md:shadow-none"
      >
        {/* the card clips to its rounded corners; the inner box scrolls, inset on desktop so the scrollbar floats clear of the corners and edge */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 max-md:p-4 max-md:pt-0 max-md:pb-8 md:p-8">
        {/* phones: full-screen page with an app bar instead of a floating card */}
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-1 border-b border-slate-200 bg-white px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <button type="button" onClick={onClose} aria-label="Back" className="flex size-11 items-center justify-center rounded-full active:bg-slate-100">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-lg font-bold">Account</span>
        </div>
        <button onClick={onClose} aria-label="Close login" className="absolute top-2 right-2 rounded-md p-2.5 text-muted-foreground hover:text-foreground max-md:hidden">
          <X className="size-5" />
        </button>
        <LoginForm
          startSignup={startSignup}
          context={context}
          onDone={() => {
            onClose();
            onLogin?.();
          }}
        />
        </div>
      </div>
    </div>,
    document.body,
  );
}
