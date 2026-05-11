"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  "admin-only": "Admin only.",
};

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

  const [visible, setVisible] = useState(!!message);

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
    // The hash is browser-only — Supabase duplicates the error params
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
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!message || !visible) return null;

  return (
    <div
      role="status"
      className="fixed top-4 right-4 z-50 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-md"
    >
      {message}
    </div>
  );
}
