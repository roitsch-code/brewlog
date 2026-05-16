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
  if (m.includes("orea"))                                       return "/brew-icons/orea-v4.png";
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
