"use client";

/**
 * Root viewport wrapper — owns 100dvh height and a single hidden scroll
 * axis. Pages render inside this container so the scroll bar is always
 * at the same place and the iOS PWA never gets a phantom Safari URL bar
 * eating into the bottom.
 *
 * Pages that need bottom-anchored UI (e.g. the brew flow's footer CTAs)
 * handle their own safe-area accounting via env(safe-area-inset-bottom).
 * No global bottom-padding reserve here — the legacy BottomNav was
 * retired with the last of the Light migration (PR #136).
 */
export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
      className="[&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
