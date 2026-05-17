interface BrewMethodIconProps {
  method?: string;
  className?: string;
}

export function brewIconSrc(method?: string): string {
  const m = (method ?? "").toLowerCase();
  if (m.includes("drip assist") || m.includes("drip-assist")) return "/brew-icons/v60-drip-assist.png";
  if (m.includes("aeropress"))                                  return "/brew-icons/aeropress.png";
  if (m.includes("kalita"))                                     return "/brew-icons/kalita.png";
  if (m.includes("chemex"))                                     return "/brew-icons/chemex.svg";
  if (m.includes("clever"))                                     return "/brew-icons/clever-dripper.png";
  // Orea V4 — four bottom variants share the same brewer body but
  // visually differ from above. Each gets a top-down filter-plate
  // icon. Legacy sessions whose method was just "Orea V4 Wide" or
  // "Orea" with no bottom keyword fall through to Classic.
  if (m.includes("orea")) {
    if (m.includes("open")) return "/brew-icons/orea-open.svg";
    if (m.includes("apex")) return "/brew-icons/orea-apex.svg";
    if (m.includes("fast")) return "/brew-icons/orea-fast.svg";
    return "/brew-icons/orea-classic.svg";
  }
  if (m.includes("moccamaster") || m.includes("mocca"))         return "/brew-icons/moccamaster.png";
  return "/brew-icons/v60.png";
}

export default function BrewMethodIcon({ method, className = "w-6 h-6" }: BrewMethodIconProps) {
  return (
    // data-brew-method-icon is the hook globals.css uses under
    // [data-light-scope] to invert the white-stroke icon assets to
    // anthracite for the (light) route group. Dark routes get the
    // original white art unchanged.
    <img
      src={brewIconSrc(method)}
      alt={method ?? "Brew device"}
      data-brew-method-icon=""
      className={`object-contain opacity-80 ${className}`}
    />
  );
}
