"use client";

import { useEffect } from "react";
import { useOnline } from "@/hooks/useOnline";
import { parkCurrentBrew } from "@/lib/flow/parkBrew";

/**
 * Parks the brew server-side the moment the Log screen opens (migration 0025).
 *
 * Before this, a finished brew existed only in the single localStorage draft
 * until the Summary's Save — and the next New Session / Brew Again / widget
 * entry called reset() and erased it. Now the draft is PUT to
 * /api/pending-brews/<id> (see parkCurrentBrew), the Home card lists it until
 * it is rated, and the Summary save sends the id so the server drops the row.
 *
 * Home brews only: a café visit is logged on the spot and has no timer data to
 * lose. Offline → nothing is sent; the effect retries when the phone is back
 * online while the Log screen is still open (the local draft still holds the
 * brew meanwhile, exactly as before).
 */
export function useParkPendingBrew(): void {
  const online = useOnline();
  useEffect(() => {
    parkCurrentBrew();
  }, [online]);
}
