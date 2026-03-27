import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

export default function RootLoading() {
  return (
    <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center gap-6">
      <CoffeeBeanGlow size={72} />
      <p className="font-display text-white/40 text-sm tracking-widest uppercase">BrewLog</p>
    </div>
  );
}
