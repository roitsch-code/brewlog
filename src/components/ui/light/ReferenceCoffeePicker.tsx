"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coffee as CoffeeIcon } from "lucide-react";

/**
 * BTTS Reference Coffee Picker — specs/home.md §5.5.
 *
 * Bottom sheet that replaces the +-Sheet when "Reference coffee" is
 * tapped. Glass container, full-width, ≥ 60% viewport tall, scrollable
 * coffee list, search pill at the top, header row.
 *
 * Data: parent passes the compact coffee list (id / roaster / name)
 * already fetched on mount. Filtering happens client-side — list is
 * small (max 50 displayed).
 *
 * Tap on a row → onSelect(coffee) (parent closes the picker and
 * stashes the reference). Tap-outside / drag-handle closes without
 * selection.
 */

export interface CompactCoffee {
  id: string;
  roaster: string;
  name: string;
}

interface ReferenceCoffeePickerProps {
  coffees: CompactCoffee[];
  onSelect: (coffee: CompactCoffee) => void;
  onClose: () => void;
}

export default function ReferenceCoffeePicker({
  coffees,
  onSelect,
  onClose,
}: ReferenceCoffeePickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? coffees.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.roaster.toLowerCase().includes(q)
        )
      : coffees;
    return list.slice(0, 50);
  }, [coffees, query]);

  return (
    <>
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-default bg-light-foreground/10 backdrop-blur-[2px]"
      />

      <div className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[80vh] min-h-[60vh] flex-col rounded-t-2xl border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150">
        <div className="mt-2 self-center">
          <span className="block h-1 w-10 rounded-full bg-light-foreground/30" />
        </div>

        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-light-foreground/10 px-5">
          <CoffeeIcon className="h-5 w-5 text-light-foreground/80" strokeWidth={1.5} />
          <p className="font-inter text-[17px] font-medium text-light-foreground">
            Reference coffee
          </p>
        </div>

        <div className="mx-5 mt-3 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roaster or coffee"
            className="block h-11 w-full rounded-full border-0 bg-light-card-default px-5 font-inter text-[15px] font-normal text-light-foreground placeholder:text-light-muted-foreground focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0"
            style={{ background: "hsl(36 55% 96% / 0.45)" }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {filtered.length === 0 ? (
            <p className="py-6 text-center font-inter text-[13px] text-light-muted-foreground">
              No matching coffees
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className="flex w-full flex-col gap-0.5 px-0 py-3 text-left"
                  >
                    <span className="font-inter text-[13px] font-normal text-light-muted-foreground">
                      {c.roaster}
                    </span>
                    <span className="font-inter text-[17px] font-medium text-light-foreground">
                      {c.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
