"use client";

// A warm bloom that follows the finger across the Field (fluidity pass). Driven
// entirely by --ptr-x / --ptr-y / --ptr-on (set by useFieldMotion) so it tracks
// touch/drag with zero React re-render. It lives behind all content (the Field
// is -z-10), so it glows *behind* the page — including behind the welcome
// haiku, which gets its own blur as you drag over it.
export default function FieldBloom() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "46vmax",
        height: "46vmax",
        transform:
          "translate3d(var(--ptr-x, -100vw), var(--ptr-y, -100vh), 0) translate(-50%, -50%)",
        opacity: "var(--ptr-on, 0)",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, hsl(36 96% 82% / 0.55) 0%, hsl(346 80% 80% / 0.28) 42%, transparent 70%)",
        filter: "blur(26px)",
        willChange: "transform, opacity",
      }}
    />
  );
}
