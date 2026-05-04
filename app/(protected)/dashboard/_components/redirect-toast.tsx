"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  "admin-only": "Admin only.",
};

export function RedirectToast() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.get("toast");
  const message = key ? MESSAGES[key] : null;

  const [visible, setVisible] = useState(!!message);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setVisible(false), 4000);
    // Strip the param so a refresh doesn't replay the toast.
    const clean = new URLSearchParams(params.toString());
    clean.delete("toast");
    const qs = clean.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    return () => clearTimeout(t);
    // We deliberately only run this on initial mount with a message.
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
