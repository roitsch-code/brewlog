import { Menu, Plus, AudioLines } from "lucide-react";

/**
 * BTTS Home — Starter state (specs/home.md §11.1).
 *
 * PR2b scope: render only the Starter view of Home. Static layout, no
 * interactivity yet. Conversation Starter is hardcoded from §8.1; real
 * Haiku generation lands in PR2j. Burger, input pill, plus button, and
 * waveform render as visual scaffolding — taps do nothing.
 *
 * Layout (specs/home.md §11.0 — Hero-slot geometry):
 *   - Header (sticky-top role): pt-12 + h-11 content + pb-3 breathing
 *   - Hero slot (flex-1, flex items-center): Starter vertically centred
 *   - Input bar (sticky-bottom role): pt-3 + h-11 content + safe-area pb
 *
 * Single-screen so nothing actually scrolls — sticky semantics are
 * implicit in the flex-column geometry. When the live thread lands
 * (PR2e), the Hero slot becomes scrollable inside the same column.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Header — specs/home.md §1.
          Title is plain text (no Glass, no border, no pill). Burger is a
          Glass pill with hairline border. Burger is not interactive in
          PR2b; tap target intentionally inert. */}
      <header className="flex items-center justify-between pl-5 pr-5 pt-12 pb-3">
        <h1 className="font-inter text-[14px] font-medium text-light-foreground/60">
          Better taste than sorry
        </h1>
        <div
          aria-label="Menu"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </div>
      </header>

      {/* Hero slot — specs/home.md §11.0 + §8.1.
          Vertically centred in the slot between Header and Input Bar.
          Fraunces 40/600, left-aligned at pl-5 (matches Title's left
          edge), foreground at full opacity. Hardcoded Starter from §8.1
          until PR2j wires real Haiku generation. */}
      <section className="flex flex-1 items-center pl-5 pr-5">
        <p className="font-fraunces text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-light-foreground">
          Good morning. DAK Coffee Roasters yesterday — try Process or anything new today?
        </p>
      </section>

      {/* Input bar — specs/home.md §2.1 (idle state).
          Static visual scaffolding. Plus, pill, and waveform are not
          interactive in PR2b. Composition states (typing, attachments,
          voice, transcript review) land in PR2d–f. */}
      <footer className="flex items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div
          aria-label="Attach"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150"
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div className="flex h-11 flex-1 items-center justify-between rounded-full border border-light-foreground/10 bg-light-card-default pl-5 pr-3 backdrop-blur-[14px] backdrop-saturate-150">
          <span className="font-inter text-[15px] font-normal text-light-muted-foreground">
            Ask anything…
          </span>
          <AudioLines
            className="mr-2 h-5 w-5 text-light-foreground/60"
            strokeWidth={1.5}
          />
        </div>
      </footer>
    </main>
  );
}
