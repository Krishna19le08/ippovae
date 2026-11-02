"use client";
import { Search } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Dims the page while the suggestion list is open; clicking it closes the list. Sits outside the (higher) header.
export function SearchBackdrop({ search }) {
  return (
    <div
      onClick={search.closeSuggestions}
      className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${
        search.open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden="true"
    />
  );
}

// The header search field with its suggestion list (an ARIA combobox). State comes from useSiteSearch.
export function SearchBox({ search, inputRef }) {
  const { text, suggestions, open, active } = search;

  return (
    <div className="relative order-last min-w-0 basis-full md:order-none md:max-w-2xl md:flex-1 md:basis-auto">
      <form onSubmit={search.onSubmit} className="relative flex rounded-md has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring">
        <Input
          ref={inputRef}
          value={text}
          role="combobox"
          aria-label="Search products"
          enterKeyHint="search"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? "search-suggestions" : undefined}
          aria-activedescendant={open && active >= 0 ? `search-option-${active}` : undefined}
          onKeyDown={search.onKeyDown}
          onChange={search.onChange}
          className="h-11 rounded-r-none border-r-0 border-white bg-white text-foreground placeholder:text-slate-500 focus-visible:border-white focus-visible:outline-none"
        />
        {!text && (
          // two lengths of placeholder text: the long one does not fit a 320px screen
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex w-[calc(100%-4.5rem)] items-center text-base text-slate-500 md:text-sm">
            <span className="truncate sm:hidden">Search products…</span>
            <span className="hidden truncate sm:inline">Search bearings, belts, parts…</span>
          </span>
        )}
        <Button type="submit" size="icon" className="btn-flat h-11 w-14 rounded-l-none shadow-none focus-visible:outline-ring" aria-label="Search">
          <Search />
        </Button>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {open ? `${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"} available` : ""}
      </p>

      {open && (
        <ul
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-foreground shadow-xl [--ring:#0b0b0b]"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.slug}
              id={`search-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => search.runSearch(p.name)}
              className={`flex w-full cursor-pointer items-center gap-3 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-accent ${
                i === active ? "bg-accent" : ""
              }`}
            >
              <img src={p.img} alt="" className="size-9 shrink-0 rounded-md bg-slate-50 object-contain" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.cat}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
