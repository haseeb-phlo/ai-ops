"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "sending" });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "sent" });
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to Phlo Workshop
          </h1>
          <p className="text-sm text-zinc-500">
            Enter your @phlo.com email and we&apos;ll send you a magic link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@phlo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status.kind === "sending" || status.kind === "sent"}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status.kind === "sending" || status.kind === "sent"}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {status.kind === "sending" ? "Sending..." : "Send magic link"}
          </button>
        </form>

        {status.kind === "sent" && (
          <p className="text-sm text-green-700">
            Check your inbox — we sent a link to {email}.
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-red-600">{status.message}</p>
        )}
      </div>
    </div>
  );
}
