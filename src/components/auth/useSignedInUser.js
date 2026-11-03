import { useCallback, useEffect, useRef, useState } from "react";
import { USER_EVENT } from "@/components/checkout/addresses";

// The signed-in user (an email, "" when signed out), stored in localStorage by the login form.
// `refresh` re-reads it after the login form saves a user; `isSignedIn` is safe to call from event handlers.
export function useSignedInUser() {
  const [user, setUser] = useState("");
  const userRef = useRef("");

  const refresh = useCallback(() => {
    let stored = "";
    try {
      stored = localStorage.getItem("kn-user") || "";
    } catch {}
    const changed = userRef.current !== stored;
    userRef.current = stored;
    setUser(stored);
    if (changed) window.dispatchEvent(new Event(USER_EVENT)); // saved addresses follow the signed-in user
  }, []);

  useEffect(refresh, [refresh]);

  const signOut = () => {
    try {
      localStorage.removeItem("kn-user");
      localStorage.removeItem("kn-user-name");
    } catch {}
    refresh();
  };

  const firstName =
    typeof window === "undefined" || !user ? "" : (localStorage.getItem("kn-user-name") || user).split(" ")[0];

  return { user, firstName, isSignedIn: () => !!userRef.current, refresh, signOut };
}
