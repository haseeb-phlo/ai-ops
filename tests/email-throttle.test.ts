import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  isRateLimitError,
  RATE_LIMIT_MAX_RETRIES,
  SEND_INTERVAL_MS,
} from "@/lib/email-throttle";

describe("isRateLimitError", () => {
  it("matches Resend's rate_limit_exceeded error name", () => {
    expect(
      isRateLimitError({ name: "rate_limit_exceeded", message: "whatever" }),
    ).toBe(true);
  });

  it("falls back to matching the message text", () => {
    expect(
      isRateLimitError({
        name: "application_error",
        message:
          "Too many requests. You can only make 10 requests per second.",
      }),
    ).toBe(true);
  });

  it("rejects other errors", () => {
    expect(
      isRateLimitError({ name: "validation_error", message: "Invalid `to`" }),
    ).toBe(false);
    expect(isRateLimitError({})).toBe(false);
    expect(isRateLimitError({ name: null, message: null })).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("doubles per attempt starting at 1s", () => {
    expect(backoffDelayMs(0)).toBe(1_000);
    expect(backoffDelayMs(1)).toBe(2_000);
    expect(backoffDelayMs(2)).toBe(4_000);
  });
});

describe("pacing constants", () => {
  it("keeps the send rate under Resend's lowest (2/s) tier", () => {
    expect(SEND_INTERVAL_MS).toBeGreaterThan(500);
  });

  it("retries rate-limited sends at least once", () => {
    expect(RATE_LIMIT_MAX_RETRIES).toBeGreaterThanOrEqual(1);
  });
});
