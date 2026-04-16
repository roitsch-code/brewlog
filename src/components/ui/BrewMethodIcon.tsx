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
    <img
      src={brewIconSrc(method)}
      alt={method ?? "Brew device"}
      className={`object-contain opacity-80 ${className}`}
    />
  );
}
