"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth-domain";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "awaiting-code" }
  | { kind: "verifying" }
  | { kind: "error"; message: string };

function friendlySignInError({
  slug,
  errorCode,
  errorDescription,
}: {
  slug: string | null;
  errorCode: string | null;
  errorDescription: string | undefined;
}): string {
  if (slug === "domain_blocked") {
    return `Sign-in is restricted to @${ALLOWED_EMAIL_DOMAIN} email addresses.`;
  }
  const description = errorDescription?.toLowerCase() ?? "";
  // `otp_expired` is Supabase's canonical code for an expired magic-link
  // / OTP. The description text is a fallback for older SDK versions and
  // adjacent failure modes ("Email link is invalid or has expired").
  const isExpired =
    errorCode === "otp_expired" ||
    description.includes("expired") ||
    description.includes("invalid");
  if (slug === "link_invalid" || isExpired) {
    return "Your sign-in link has expired. Enter your email below to send a fresh one.";
  }
  return "We couldn't sign you in with that link. Enter your email below to try again.";
}

// Map raw Supabase auth errors to a small, user-friendly set. Never echo
// the raw `error.message` to the UI - it can leak SDK internals (HTTP
// status, server identifiers, gated-feature flags) that aren't useful to
// the user and broaden what an attacker can probe.
function mapAuthError(
  message: string | undefined,
  ctx: "send" | "verify",
): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Couldn't reach the sign-in server. Try again.";
  }
  if (ctx === "verify") {
    return "That code is invalid or has expired. Request a new one.";
  }
  return "We couldn't send the sign-in code. Try again in a moment.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [linkError, setLinkError] = useState<string | null>(null);

  // Surface sign-in errors from two carriers:
  //   1) Query string - set by /auth/callback when exchangeCodeForSession
  //      fails, AND by Supabase's own /verify endpoint, which on failure
  //      duplicates the error params into both query and hash.
  //   2) Hash fragment - also written by Supabase's /verify endpoint. The
  //      server can't read it, so we parse it on the client.
  // Read from both because the carrier varies by SDK version, redirect
  // chain (proxy.ts → /login can preserve query but may drop the hash if
  // the Location header carries its own fragment), and even browser. We
  // map both to a small set of friendly messages - never echo raw error
  // strings, which can leak SDK internals and confuse the user.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const slug = query.get("error");
    // Prefer the hash copy when both are present - Supabase's /verify
    // endpoint writes it there first; the query copy only exists because
    // some redirect targets surface it for server-side handlers.
    const errorCode = hash.get("error_code") ?? query.get("error_code");
    const errorDescription =
      hash.get("error_description") ?? query.get("error_description") ?? undefined;

    if (!slug && !errorCode && !errorDescription) return;

    const message = friendlySignInError({ slug, errorCode, errorDescription });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkError(message);
    // Scrub both query and hash so a refresh doesn't re-trigger the
    // banner and the address bar isn't full of scary auth params.
    history.replaceState(null, "", window.location.pathname);
  }, []);

  const isBusy = status.kind === "sending" || status.kind === "verifying";

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLinkError(null);

    if (!isAllowedEmail(email)) {
      setStatus({
        kind: "error",
        message: `Use your @${ALLOWED_EMAIL_DOMAIN} email to sign in.`,
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
      setStatus({ kind: "error", message: mapAuthError(error.message, "send") });
      return;
    }
    setStatus({ kind: "awaiting-code" });
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;

    setStatus({ kind: "verifying" });

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setStatus({
        kind: "error",
        message: mapAuthError(error.message, "verify"),
      });
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function handleResend() {
    setCode("");
    setStatus({ kind: "idle" });
  }

  const awaitingCode = status.kind === "awaiting-code" || status.kind === "verifying";

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
            <span aria-hidden className="h-5 w-px bg-muted-foreground/60" />
            <span className="text-sm font-medium tracking-tight text-muted-foreground">
              AI Ops
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Phlo&apos;s internal register of recurring workflows and AI
            interventions.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {awaitingCode ? "Check your email" : "Sign in"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {awaitingCode ? (
                <>
                  We sent a 6-digit code to{" "}
                  <strong className="text-foreground">{email}</strong>. Paste it
                  below to sign in.
                </>
              ) : (
                "We'll email you a 6-digit code to sign in. No password needed."
              )}
            </p>
          </div>

          {!awaitingCode ? (
            <form onSubmit={handleSendCode} className="mt-5 space-y-3">
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
                {status.kind === "sending" ? "Sending" : "Send code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  // Supabase OTP length is configurable (typically 6 or 8).
                  // Accept up to 8; verifyOtp will reject the wrong length.
                  maxLength={8}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    // Clear stale error state if the user re-enters a code.
                    setStatus((s) =>
                      s.kind === "error" ? { kind: "awaiting-code" } : s,
                    );
                  }}
                  disabled={status.kind === "verifying"}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={status.kind === "verifying" || code.trim().length < 6}
                className="w-full"
              >
                {status.kind === "verifying" ? "Verifying" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={handleResend}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </form>
          )}

          {linkError && status.kind !== "error" && (
            <p className="mt-4 text-sm text-amber-700">
              <span
                aria-hidden
                className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
              />
              {linkError}
            </p>
          )}
          {status.kind === "error" && (
            <p className="mt-4 text-sm text-red-700">
              <span
                aria-hidden
                className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle"
              />
              {status.message}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in? Ping a super-admin in Slack.
        </p>
      </div>
    </div>
  );
}
