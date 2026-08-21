"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  "admin-only": "That page is for admins — you've been sent home.",
};

const AUTO_DISMISS_MS = 7000;
const EXIT_MS = 200;

// Params that Supabase's /verify endpoint dumps onto the Site URL when an
// OTP magic-link fails (expired, reused, etc.). When an *already-signed-in*
// user clicks a stale link in the same browser, the proxy lets them
// through to /, and these params would otherwise sit in the address bar.
const SUPABASE_AUTH_ERROR_PARAMS = [
  "error",
  "error_code",
  "error_description",
] as const;

export function RedirectToast() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.get("toast");
  const message = key ? MESSAGES[key] : null;

  // "init" renders the live-region container *empty*; the message is
  // injected one frame later so role="status" actually announces it -
  // content already present when a live region mounts is not read out.
  const [phase, setPhase] = useState<"init" | "open" | "closing" | "closed">(
    "init",
  );
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setPhase((p) => (p === "open" || p === "init" ? "closing" : p));
    exitTimer.current = setTimeout(() => setPhase("closed"), EXIT_MS);
  }, []);

  useEffect(() => {
    const clean = new URLSearchParams(params.toString());
    let mutated = false;
    if (clean.has("toast")) {
      clean.delete("toast");
      mutated = true;
    }
    for (const k of SUPABASE_AUTH_ERROR_PARAMS) {
      if (clean.has(k)) {
        clean.delete(k);
        mutated = true;
      }
    }
    // The hash is browser-only - Supabase duplicates the error params
    // there, so strip it too. Touch history directly so we don't push a
    // navigation entry just to scrub.
    const hasAuthHash =
      typeof window !== "undefined" &&
      /\b(error|error_code|error_description)=/.test(window.location.hash);
    if (hasAuthHash && typeof window !== "undefined") {
      const qs = clean.toString();
      history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    } else if (mutated) {
      const qs = clean.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }

    if (!message) return;
    const enter = requestAnimationFrame(() => setPhase("open"));
    const auto = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(auto);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!message || phase === "closed") return null;

  return (
    <div
      role="status"
      className={cn(
        // Sits below the mobile top bar (h-14) on small screens; clears to
        // the corner on md+ where the bar disappears.
        "fixed right-4 top-16 z-50 flex items-center gap-2 rounded-md border border-border bg-background py-2 pl-3 pr-1.5 text-sm text-foreground shadow-md transition-all duration-200 md:top-4",
        phase === "open"
          ? "translate-y-0 opacity-100"
          : "-translate-y-1 opacity-0",
      )}
    >
      {phase !== "init" && (
        <>
          <span>{message}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss notification"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
