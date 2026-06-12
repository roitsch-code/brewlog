"use client";

import { Image as ImageIcon, Coffee as CoffeeIcon } from "lucide-react";

/**
 * BTTS `+`-Sheet — specs/home.md §5.1 (post-PR2g revision).
 *
 * Original spec had three options (Camera, Photo library, Reference
 * coffee). On iOS WebKit `<input type="file" accept="image/*">` always
 * shows the system action sheet when there's no `capture` attribute —
 * so splitting Camera and Photo library at our level produced a double
 * sheet (ours then iOS's). Collapsed to a single "Photo" entry that
 * defers to the iOS picker for source choice (camera vs. library vs.
 * files), and a "Reference coffee" entry that opens the BTTS picker
 * (§5.5).
 *
 * Reference coffee is disabled when the user's library is empty
 * (§5.4).
 */

interface AttachmentSheetProps {
  onClose: () => void;
  onPickPhoto: () => void;
  onPickCoffee: () => void;
  coffeeLibraryEmpty?: boolean;
}

export default function AttachmentSheet({
  onClose,
  onPickPhoto,
  onPickCoffee,
  coffeeLibraryEmpty = false,
}: AttachmentSheetProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close attachments"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />

      <div className="absolute bottom-full left-0 z-50 mb-2 mr-auto max-w-[280px] rounded-2xl bg-light-foreground p-2 shadow-light-float">
        <button
          type="button"
          onClick={onPickPhoto}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-light-text-on-dark/10"
        >
          <ImageIcon className="h-5 w-5 text-light-text-on-dark/80" strokeWidth={1.5} />
          <span className="font-chivo text-[15px] font-medium text-light-text-on-dark">
            Photo
          </span>
        </button>
        <button
          type="button"
          onClick={onPickCoffee}
          disabled={coffeeLibraryEmpty}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-light-text-on-dark/10 disabled:opacity-40"
        >
          <CoffeeIcon className="h-5 w-5 text-light-text-on-dark/80" strokeWidth={1.5} />
          <span className="font-chivo text-[15px] font-medium text-light-text-on-dark">
            {coffeeLibraryEmpty ? "Reference coffee (library empty)" : "Reference coffee"}
          </span>
        </button>
      </div>
    </>
  );
}
