import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// set when a search is submitted: the next page's header takes focus back into the search box (navigation remounts it)
let refocusSearch = false;

// Typing re-renders the page; if that makes the browser jump to the top, put the scroll back.
function keepScroll() {
  const y = window.scrollY;
  const restore = () => {
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
  };
  requestAnimationFrame(() => requestAnimationFrame(restore));
}

const MAX_SUGGESTIONS = 6;

// State and handlers for the header search box: the text, the suggestion list and keyboard navigation.
// Submitting goes to /products?q=...; `inputRef` is the search <input>.
export function useSiteSearch(products, inputRef) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false); // search submitted: hide the suggestions
  const [active, setActive] = useState(-1); // highlighted suggestion (keyboard)

  // keep the search bar (and its text) after a search lands on /products?q=
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) {
      setText(fromUrl);
      setSubmitted(true);
    }
    if (refocusSearch) {
      refocusSearch = false;
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const term = text.trim().toLowerCase();
  const suggestions =
    term && !submitted
      ? products.filter((p) => `${p.name} ${p.cat} ${p.brand || ""}`.toLowerCase().includes(term)).slice(0, MAX_SUGGESTIONS)
      : [];
  const open = suggestions.length > 0;

  const runSearch = (query) => {
    setText(query);
    setSubmitted(true);
    refocusSearch = true;
    setTimeout(() => (refocusSearch = false), 3000);
    inputRef.current?.focus({ preventScroll: true });
    router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  };

  const onChange = (e) => {
    keepScroll();
    setText(e.target.value);
    setSubmitted(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault(); // an empty field has nothing to delete, so the browser would scroll the page up instead
    } else if (e.key === "ArrowDown" && !open && term) {
      e.preventDefault();
      setSubmitted(false); // reopen the list for the text that is there
      setActive(-1);
    } else if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      runSearch(suggestions[active].name);
    } else if (e.key === "Escape" && open) {
      setSubmitted(true); // close the list, keep the text
      setActive(-1);
    }
  };

  return {
    text,
    suggestions,
    open,
    active,
    onChange,
    onKeyDown,
    runSearch,
    closeSuggestions: () => setSubmitted(true),
    onSubmit: (e) => {
      e.preventDefault();
      runSearch(text);
    },
  };
}
