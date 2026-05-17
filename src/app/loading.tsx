import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";

/**
 * Root loading state — rendered during initial route segment mount,
 * BEFORE any LightShell wrapper has had a chance to mark the tree
 * with data-light-scope. Without an explicit cream background, the
 * dark default body color (still #0E0B0A in globals for the few
 * remaining dark surfaces) would briefly flash through. Setting the
 * cream baseline inline here guarantees the loading state matches
 * the post-mount Light view.
 */
export default function RootLoading() {
  return (
    <div
      className="min-h-svh flex flex-col items-center justify-center gap-6"
      style={{ background: "#F3E5DC" }}
    >
      <CoffeeBeanGlow size={72} />
      <p className="font-fraunces text-light-foreground/50 text-sm tracking-widest uppercase">BrewLog</p>
    </div>
  );
}
