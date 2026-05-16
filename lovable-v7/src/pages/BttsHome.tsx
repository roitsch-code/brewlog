import { Menu, Plus, AudioWaveform, X, ArrowUp } from "lucide-react";

const GLASS =
  "bg-[hsl(36_55%_96%_/_0.55)] backdrop-blur-[14px] backdrop-saturate-150 border border-[hsl(28_20%_75%_/_0.4)]";

const Frame = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col items-center">
    <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-foreground/70">
      {label}
    </p>
    <div
      className="relative overflow-hidden"
      style={{ width: 390, height: 844 }}
    >
      {/* Field */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-brew-field absolute inset-[-10%]" />
      </div>
      {children}
    </div>
  </div>
);

const Header = () => (
  <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between pt-12 pl-5 pr-5">
    <div
      className={`${GLASS} rounded-lg px-4 py-2 text-[18px] font-medium leading-tight text-foreground`}
    >
      Better taste than sorry
    </div>
    <button
      aria-label="Menu"
      className={`${GLASS} flex h-11 w-11 items-center justify-center rounded-full`}
    >
      <Menu className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
    </button>
  </header>
);

const InputPill = ({ cursor = false }: { cursor?: boolean }) => (
  <div
    className={`${GLASS} flex h-11 flex-1 items-center rounded-full pl-5 pr-3`}
  >
    <div className="flex flex-1 items-center text-[15px] font-normal text-muted-foreground">
      {cursor && (
        <span className="mr-0.5 inline-block h-[18px] w-px animate-pulse bg-foreground" />
      )}
      <span>Ask anything…</span>
    </div>
    <AudioWaveform
      className="mr-2 h-5 w-5 text-foreground/60"
      strokeWidth={1.75}
    />
  </div>
);

const BttsHome = () => {
  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto flex w-fit flex-col items-center gap-10">
        {/* FRAME 1 — Default */}
        <Frame label="Default">
          <Header />

          {/* Conversation Starter centered between header (~96px) and input bar (~88px) */}
          <div
            className="absolute inset-x-0 flex items-center justify-center px-6"
            style={{ top: 96, bottom: 88 }}
          >
            <p className="text-center text-[18px] font-normal leading-snug text-foreground/80">
              Good morning.
              <br />
              DAK Coffee Roasters yesterday —
              <br />
              try Process or anything new today?
            </p>
          </div>

          {/* Input bar */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-5 pb-6">
            <button
              aria-label="Add"
              className={`${GLASS} flex h-11 w-11 shrink-0 items-center justify-center rounded-full`}
            >
              <Plus className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
            </button>
            <InputPill />
          </div>
        </Frame>

        {/* FRAME 2 — Tapped Input */}
        <Frame label="Tapped Input">
          <Header />

          {/* Keyboard sim */}
          <div
            className="absolute inset-x-0 bottom-0 bg-[hsl(36_20%_92%)]"
            style={{ height: 280 }}
          />

          {/* Input bar — sits above keyboard */}
          <div
            className="absolute inset-x-0 flex items-center gap-3 px-5"
            style={{ bottom: 280 + 12 }}
          >
            <button
              aria-label="Close"
              className={`${GLASS} flex h-11 w-11 shrink-0 items-center justify-center rounded-full`}
            >
              <X className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
            </button>
            <InputPill cursor />
          </div>
        </Frame>

        {/* FRAME 3 — Composing */}
        <Frame label="Composing">
          <Header />

          {/* Keyboard sim */}
          <div
            className="absolute inset-x-0 bottom-0 bg-[hsl(36_20%_92%)]"
            style={{ height: 280 }}
          />

          {/* Input bar */}
          <div
            className="absolute inset-x-0 flex flex-col gap-2 px-5"
            style={{ bottom: 280 + 12 }}
          >
            {/* Pre-Composition Bubble — right aligned, max-w calc(100% - 64px)
                accounts for the 44px close button + 12px gap + 8px breathing */}
            <div className="flex justify-end pl-[64px]">
              <div
                className={`${GLASS} relative rounded-2xl p-3 pb-12`}
                style={{ maxWidth: "100%" }}
              >
                <p className="pr-2 text-[15px] font-normal leading-snug text-foreground">
                  What should I brew this morning? Something fruity, not too
                  acidic.
                </p>
                <button
                  aria-label="Send"
                  className="absolute bottom-0 right-0 m-2 flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "hsl(20 14% 12%)" }}
                >
                  <ArrowUp
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    style={{ color: "hsl(30 40% 97%)" }}
                  />
                </button>
              </div>
            </div>

            {/* Pill row */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Close"
                className={`${GLASS} flex h-11 w-11 shrink-0 items-center justify-center rounded-full`}
              >
                <X className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
              </button>
              <InputPill cursor />
            </div>
          </div>
        </Frame>
      </div>
    </div>
  );
};

export default BttsHome;
