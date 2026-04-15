"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { House, BookOpen, Plus, Radar, Compass } from "lucide-react";

const tabs = [
  { href: "/", label: "HOME", Icon: House },
  { href: "/coffees", label: "LIBRARY", Icon: BookOpen },
  { href: "/brew/new", label: "BREW", Icon: Plus, isBrew: true },
  { href: "/taste", label: "TASTE", Icon: Radar },
  { href: "/explore", label: "EXPLORE", Icon: Compass },
];

const SHOW_ON = ["/", "/coffees", "/explore", "/taste"];

export default function BottomNav() {
  const pathname = usePathname();
  const reset = useFlowStore(s => s.reset);

  if (!SHOW_ON.includes(pathname)) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: "4px",
        paddingLeft: "16px",
        paddingRight: "16px",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "#111111",
      }}
    >
      <div
        className="flex items-center w-full max-w-sm mx-auto border shadow-2xl"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          borderRadius: "36px",
          height: "62px",
          padding: "4px",
          gap: "2px",
        }}
      >
        {tabs.map(tab => {
          const active = pathname === tab.href;
          const { Icon } = tab;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={"isBrew" in tab && tab.isBrew ? reset : undefined}
              className="flex flex-col items-center justify-center"
              style={{
                flex: 1,
                borderRadius: "26px",
                paddingTop: "6px",
                paddingBottom: "6px",
                height: "100%",
                background: active ? "var(--primary)" : "transparent",
                color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span style={{ fontFamily: "var(--font-secondary)", fontSize: "10px", fontWeight: 500, marginTop: "2px", lineHeight: 1 }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
