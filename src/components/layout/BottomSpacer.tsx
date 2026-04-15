// Prevents content from being hidden behind the bottom nav + iPhone home indicator
export default function BottomSpacer() {
  return (
    <div style={{ height: "calc(4.5rem + env(safe-area-inset-bottom))" }} aria-hidden />
  );
}
