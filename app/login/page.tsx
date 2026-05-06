"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isBusy = status.kind === "sending" || status.kind === "sent";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim().toLowerCase().endsWith("@wearephlo.com")) {
      setStatus({
        kind: "error",
        message: "Use your @wearephlo.com email to sign in.",
      });
      return;
    }

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
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Brand lockup centered above the form - sign-in convention used by
            Vercel / Linear / Figma. Lockup is logo + product name so the
            tool's purpose is obvious at first glance. */}
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/phlo-mark.svg" alt="Phlo" className="h-7 w-auto" />
            <span aria-hidden className="h-5 w-px bg-zinc-300" />
            <span className="text-sm font-medium tracking-tight text-zinc-600">
              AI Ops
            </span>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Phlo&apos;s internal register of recurring workflows and AI
            interventions.
          </p>
        </header>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Sign in
            </h1>
            <p className="text-sm text-zinc-500">
              We&apos;ll email you a magic link. No password needed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@wearephlo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status.kind === "error") setStatus({ kind: "idle" });
                }}
                disabled={isBusy}
                autoComplete="email"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={isBusy || email.trim() === ""}
              className="w-full"
            >
              {status.kind === "sending"
                ? "Sending"
                : status.kind === "sent"
                  ? "Link sent"
                  : "Send magic link"}
            </Button>
          </form>

          {status.kind === "sent" && (
            <p className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                Check your inbox - we sent a sign-in link to{" "}
                <strong>{email}</strong>.
              </span>
            </p>
          )}
          {status.kind === "error" && (
            <p className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{status.message}</span>
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Trouble signing in? Ping a super-admin in Slack.
        </p>
      </div>
    </div>
  );
}
