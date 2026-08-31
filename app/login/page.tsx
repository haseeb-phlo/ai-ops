"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth-domain";

// Which form is on screen. Deliberately separate from `status` so an async
// failure (e.g. a bad code) never knocks the user off the step they were
// on - a failed verification keeps the code form visible with an inline
// error instead of bouncing back to the email form.
type Step = "email" | "code";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "verifying" }
  | { kind: "error"; message: string };

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Where to go after signing in.
 *
 * Open-redirect guard, the same rule /auth/callback applies to its own `next`:
 * relative paths under our origin only. This copy is NOT redundant - the
 * 6-digit code path verifies in the browser and never reaches the callback, so
 * it is the only guard on that route.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

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
    return "That code didn't work — check it and try again.";
  }
  return "We couldn't send the sign-in code. Try again in a moment.";
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [linkError, setLinkError] = useState<string | null>(null);
  // Where proxy.ts wanted to send them before the sign-in gate.
  //
  // Read once, in a lazy initialiser, for two reasons: the error handling
  // below rewrites the URL and would otherwise take `next` with it, and this
  // value is only ever read inside submit handlers - never rendered - so
  // resolving to "/" on the server costs no hydration mismatch.
  const [nextPath] = useState(() =>
    typeof window === "undefined"
      ? "/"
      : safeNext(new URLSearchParams(window.location.search).get("next")),
  );
  // Seconds remaining before "Resend code" re-enables. Started after every
  // successful send so a user can't hammer the OTP endpoint.
  const [resendCooldown, setResendCooldown] = useState(0);

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

  // Tick the resend cooldown down once a second while it's running.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const isBusy = status.kind === "sending" || status.kind === "verifying";

  // Shared by the initial "Send code" submit and the "Resend code" action
  // on the code step. Returns true when the email went out.
  async function sendCode(): Promise<boolean> {
    setLinkError(null);
    setStatus({ kind: "sending" });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // The link half of the email. `next` rides through the callback,
        // which applies its own open-redirect guard before honouring it.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setStatus({ kind: "error", message: mapAuthError(error.message, "send") });
      return false;
    }
    setStatus({ kind: "idle" });
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isAllowedEmail(email)) {
      setStatus({
        kind: "error",
        message: `Use your @${ALLOWED_EMAIL_DOMAIN} email to sign in.`,
      });
      return;
    }

    if (await sendCode()) {
      setStep("code");
    }
  }

  async function handleResendCode() {
    if (isBusy || resendCooldown > 0) return;
    setCode("");
    await sendCode();
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
      // Stay on the code step: `step` is untouched, so the form (and the
      // entered email) survive - only an inline error appears.
      setStatus({
        kind: "error",
        message: mapAuthError(error.message, "verify"),
      });
      return;
    }

    // The two first-sign-in claims that /auth/callback runs. This path never
    // reaches it - verifyOtp completes in the browser - so without these,
    // whether your roster enrolment materialises depends on whether you
    // clicked the link in the email or typed the code out of it. Both are
    // granted to `authenticated` and are idempotent.
    //
    // Non-fatal, exactly as in the callback: failing to sign in because of a
    // training enrolment would be far worse than an enrolment that waits for
    // the next visit.
    const [linkResult, claimResult] = await Promise.all([
      supabase.rpc("link_ai_score_responses"),
      supabase.rpc("programme_claim_pending_enrolments"),
    ]);
    if (linkResult.error) {
      console.warn("[login] AI Score link failed", linkResult.error.message);
    }
    if (claimResult.error) {
      console.warn("[login] cohort claim failed", claimResult.error.message);
    }

    router.replace(nextPath);
    router.refresh();
  }

  function handleUseDifferentEmail() {
    setCode("");
    setStatus({ kind: "idle" });
    setStep("email");
  }

  const onCodeStep = step === "code";

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Brand lockup centered above the form - sign-in convention used by
            Vercel / Linear / Figma. Lockup is logo + product name so the
            tool's purpose is obvious at first glance. */}
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/phlo-mark.svg"
              alt="Phlo"
              width={84}
              height={28}
              className="h-7 w-auto"
            />
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

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {onCodeStep ? "Check your email" : "Sign in"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {onCodeStep ? (
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

          {!onCodeStep ? (
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
                loading={status.kind === "sending"}
                disabled={isBusy || email.trim() === ""}
                className="w-full"
              >
                {status.kind === "sending" ? "Sending…" : "Send code"}
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
                    setStatus((s) => (s.kind === "error" ? { kind: "idle" } : s));
                  }}
                  disabled={isBusy}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                loading={status.kind === "verifying"}
                disabled={isBusy || code.trim().length < 6}
                className="w-full"
              >
                {status.kind === "verifying" ? "Verifying…" : "Sign in"}
              </Button>
              <div className="flex items-center justify-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isBusy || resendCooldown > 0}
                  className="text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary disabled:cursor-default disabled:opacity-60 disabled:hover:text-muted-foreground"
                >
                  {status.kind === "sending"
                    ? "Sending…"
                    : resendCooldown > 0
                      ? `Resend code (${resendCooldown}s)`
                      : "Resend code"}
                </button>
                <span aria-hidden className="h-3 w-px bg-border" />
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  disabled={isBusy}
                  className="text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary disabled:opacity-60"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {linkError && status.kind !== "error" && (
            <Alert variant="warning" className="mt-4">
              {linkError}
            </Alert>
          )}
          {status.kind === "error" && (
            <Alert variant="destructive" className="mt-4">
              {status.message}
            </Alert>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in? Ping a super-admin in Slack.
        </p>
      </div>
    </div>
  );
}
