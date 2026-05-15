"use client";

import { Camera as CameraIcon, Image as ImageIcon } from "lucide-react";

/**
 * BTTS `+`-Sheet — specs/home.md §5.1.
 *
 * Glass bottom-sheet that floats above the input bar, anchored to the
 * left so it visually drops out of the `+` button below. Tap-outside
 * dismisses without selection.
 *
 * Two options in PR2g — Camera and Photo library. The "Reference
 * coffee" row from §5.4 + the Reference Coffee Picker (§5.5) land in
 * PR2h, which extracts the picker UI from the existing /explore page.
 */

interface AttachmentSheetProps {
  onClose: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
}

export default function AttachmentSheet({
  onClose,
  onPickCamera,
  onPickLibrary,
}: AttachmentSheetProps) {
  return (
    <>
      {/* Tap-outside backdrop — invisible full-screen layer. Click closes
          the sheet without selecting anything. */}
      <button
        type="button"
        aria-label="Close attachments"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />

      <div className="relative z-50 mb-2 mr-auto max-w-[280px] rounded-2xl border border-light-foreground/10 bg-light-card-default p-2 backdrop-blur-[14px] backdrop-saturate-150">
        <button
          type="button"
          onClick={onPickCamera}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left"
        >
          <CameraIcon className="h-5 w-5 text-light-foreground/80" strokeWidth={1.5} />
          <span className="font-inter text-[15px] font-medium text-light-foreground">
            Camera
          </span>
        </button>
        <button
          type="button"
          onClick={onPickLibrary}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left"
        >
          <ImageIcon className="h-5 w-5 text-light-foreground/80" strokeWidth={1.5} />
          <span className="font-inter text-[15px] font-medium text-light-foreground">
            Photo library
          </span>
        </button>
      </div>
    </>
  );
}
