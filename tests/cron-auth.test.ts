import { describe, expect, it } from "vitest";
import { isCronAuthorized, redactEmail } from "@/lib/cron-auth";

const SECRET = "test-secret-do-not-leak-irl";

describe("isCronAuthorized", () => {
  describe("production", () => {
    const base = {
      hostHeader: "phlo-workshop.vercel.app",
      expectedSecret: SECRET,
      nodeEnv: "production",
    };

    it("accepts the exact bearer token", () => {
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: `Bearer ${SECRET}`,
        }),
      ).toBe(true);
    });

    it("rejects a missing Authorization header", () => {
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: null,
        }),
      ).toBe(false);
    });

    it("rejects a non-Bearer scheme", () => {
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: `Basic ${SECRET}`,
        }),
      ).toBe(false);
    });

    it("rejects a wrong secret of the same length", () => {
      const wrong = SECRET.replace(/.$/, "x");
      expect(wrong).toHaveLength(SECRET.length);
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: `Bearer ${wrong}`,
        }),
      ).toBe(false);
    });

    it("rejects a token that's a strict prefix of the real one", () => {
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: `Bearer ${SECRET.slice(0, -3)}`,
        }),
      ).toBe(false);
    });

    it("rejects a token that's a strict suffix of the real one", () => {
      expect(
        isCronAuthorized({
          ...base,
          authorizationHeader: `Bearer extra-${SECRET}`,
        }),
      ).toBe(false);
    });

    it("rejects when CRON_SECRET is unset", () => {
      expect(
        isCronAuthorized({
          ...base,
          expectedSecret: undefined,
          authorizationHeader: `Bearer anything`,
        }),
      ).toBe(false);
    });

    it("rejects when CRON_SECRET is the empty string", () => {
      expect(
        isCronAuthorized({
          ...base,
          expectedSecret: "",
          authorizationHeader: `Bearer `,
        }),
      ).toBe(false);
    });

    it("ignores the host header in production", () => {
      // Even from a "weird" host, a correct bearer is honoured because
      // Vercel may route via internal hosts.
      expect(
        isCronAuthorized({
          ...base,
          hostHeader: "some-internal-host",
          authorizationHeader: `Bearer ${SECRET}`,
        }),
      ).toBe(true);
    });
  });

  describe("non-production", () => {
    const base = {
      authorizationHeader: null,
      expectedSecret: undefined,
      nodeEnv: "development" as string | undefined,
    };

    it("allows localhost without any auth", () => {
      expect(
        isCronAuthorized({
          ...base,
          hostHeader: "localhost:3000",
        }),
      ).toBe(true);
    });

    it("allows 127.0.0.1 without any auth", () => {
      expect(
        isCronAuthorized({
          ...base,
          hostHeader: "127.0.0.1:3000",
        }),
      ).toBe(true);
    });

    it("rejects non-localhost in dev mode (so a mistakenly-deployed dev build can't expose the route)", () => {
      expect(
        isCronAuthorized({
          ...base,
          hostHeader: "phlo-workshop.vercel.app",
        }),
      ).toBe(false);
    });

    it("rejects a missing host header in dev mode", () => {
      expect(
        isCronAuthorized({
          ...base,
          hostHeader: null,
        }),
      ).toBe(false);
    });

    it("treats undefined NODE_ENV like development (localhost-only)", () => {
      expect(
        isCronAuthorized({
          ...base,
          nodeEnv: undefined,
          hostHeader: "localhost:3000",
        }),
      ).toBe(true);
      expect(
        isCronAuthorized({
          ...base,
          nodeEnv: undefined,
          hostHeader: "phlo-workshop.vercel.app",
        }),
      ).toBe(false);
    });
  });
});

describe("redactEmail", () => {
  it("keeps the local part and replaces the domain with an ellipsis", () => {
    expect(redactEmail("ingrid.maughan@wearephlo.com")).toBe("ingrid.maughan@…");
  });

  it("collapses to an ellipsis when there's no @", () => {
    expect(redactEmail("not-an-email")).toBe("…");
  });

  it("collapses to an ellipsis when @ is at position 0", () => {
    expect(redactEmail("@domain.com")).toBe("…");
  });
});
