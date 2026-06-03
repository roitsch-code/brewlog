"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";

type Mode = "loading" | "login" | "register" | "pin";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/status");
        const { registered } = await res.json();
        if (registered) {
          setMode("login");
          await triggerFaceID();
        } else {
          setMode("register");
        }
      } catch {
        setMode("register");
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerFaceID() {
    setError("");
    setWorking(true);
    try {
      const challengeRes = await fetch("/api/auth/login-challenge", { method: "POST" });
      if (!challengeRes.ok) throw new Error("Challenge failed");
      const options = await challengeRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      if (verifyRes.ok) {
        router.replace("/");
      } else {
        const data = await verifyRes.json().catch(() => ({}));
        setError(data.error || "Face ID failed — try again");
      }
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      const msg  = err instanceof Error ? err.message : "";
      if (name === "NotAllowedError") {
        setError(""); // user cancelled — stay quiet
      } else {
        setError(`Face ID unavailable${msg ? `: ${msg}` : ""} — use PIN below`);
      }
    } finally {
      setWorking(false);
      setMode("login");
    }
  }

  async function handleRegister() {
    setError("");
    setWorking(true);
    try {
      const challengeRes = await fetch("/api/auth/register-challenge", { method: "POST" });
      if (!challengeRes.ok) throw new Error("Challenge request failed");
      const options = await challengeRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      if (verifyRes.ok) {
        router.replace("/");
      } else {
        const data = await verifyRes.json().catch(() => ({}));
        setError(data.error || "Setup failed — try again");
      }
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      const msg  = err instanceof Error ? err.message : "";
      if (name === "InvalidStateError") {
        setMode("login");
        setError("Already set up — tap Use Face ID");
      } else {
        setError(`Setup failed${msg ? `: ${msg}` : ""}`);
      }
    } finally {
      setWorking(false);
    }
  }

  async function handlePin() {
    setPinError("");
    setWorking(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pin", pin }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setPinError("Wrong PIN");
        setPin("");
      }
    } finally {
      setWorking(false);
    }
  }

  async function handleResetPasskey() {
    setPinError("");
    setWorking(true);
    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pin", pin }),
      });
      if (!loginRes.ok) {
        setPinError("Wrong PIN");
        setPin("");
        return;
      }
      const resetRes = await fetch("/api/auth/reset-passkey", { method: "POST" });
      if (!resetRes.ok) {
        setPinError("Reset failed — try again");
        return;
      }
      setPin("");
      setError("");
      setMode("register");
    } finally {
      setWorking(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (mode === "loading") {
    return (
      <div className="min-h-svh bg-transparent flex flex-col items-center justify-center gap-6">
        <CoffeeBeanGlow size={72} />
        <h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground text-center">
          Better taste<br />than sorry.
        </h1>
      </div>
    );
  }

  // ── PIN entry ────────────────────────────────────────────────────────────
  if (mode === "pin") {
    return (
      <div className="min-h-svh bg-transparent flex flex-col items-center justify-center px-8 gap-10">
        <div className="flex flex-col items-center gap-4">
          <CoffeeBeanGlow size={56} />
          <p className="font-fraunces text-light-foreground/60 text-lg leading-tight text-center whitespace-pre-line">
            {"Better taste\nthan sorry."}
          </p>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-4">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/20 rounded-2xl px-4 py-4 text-light-foreground text-center text-2xl tracking-widest placeholder:text-light-muted-foreground focus:outline-none focus:border-light-foreground/40"
            autoFocus
          />
          {pinError && <p className="text-light-destructive text-sm text-center">{pinError}</p>}
          <button
            onClick={handlePin}
            disabled={pin.length < 4 || working}
            className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold text-base disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {working ? "Checking…" : "Unlock"}
          </button>
          <button
            onClick={() => { setMode("login"); setPin(""); setPinError(""); }}
            className="text-light-muted-foreground text-sm text-center py-2"
          >
            ← Use Face ID
          </button>
          <button
            onClick={handleResetPasskey}
            disabled={pin.length < 4 || working}
            className="text-light-muted-foreground text-xs text-center py-2 underline-offset-4 hover:underline disabled:opacity-40"
          >
            Reset Face ID on this device
          </button>
        </div>
      </div>
    );
  }

  // ── Face ID (login or register) ──────────────────────────────────────────
  return (
    <div className="min-h-svh bg-transparent flex flex-col items-center justify-center px-8 gap-10">
      <div className="flex flex-col items-center gap-4">
        <CoffeeBeanGlow size={72} />
        <h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground text-center">
          Better taste<br />than sorry.
        </h1>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-4">
        {error && (
          <p className="text-light-foreground/75 text-sm text-center leading-relaxed">{error}</p>
        )}

        {mode === "register" ? (
          <button
            onClick={handleRegister}
            disabled={working}
            className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {working ? <Spinner /> : <FaceIDIcon />}
            {working ? "Setting up…" : "Set up Face ID"}
          </button>
        ) : (
          <button
            onClick={triggerFaceID}
            disabled={working}
            className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {working ? <Spinner /> : <FaceIDIcon />}
            {working ? "Verifying…" : "Use Face ID"}
          </button>
        )}

        <button
          onClick={() => setMode("pin")}
          className="text-light-muted-foreground text-sm text-center py-2"
        >
          Use PIN instead
        </button>
      </div>
    </div>
  );
}

function FaceIDIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7V4a2 2 0 0 1 2-2h3" />
      <path d="M17 2h3a2 2 0 0 1 2 2v3" />
      <path d="M22 17v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-3" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 15a3 3 0 0 0 6 0" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-light-text-on-dark/30 border-t-light-text-on-dark animate-spin" />
  );
}
