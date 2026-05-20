import { describe, it, expect } from "vitest";
import { parseViewAsCookie } from "@/lib/auth";

describe("parseViewAsCookie", () => {
  it("returns null for empty/missing input", () => {
    expect(parseViewAsCookie(null)).toBeNull();
    expect(parseViewAsCookie(undefined)).toBeNull();
    expect(parseViewAsCookie("")).toBeNull();
  });

  it("returns null for non-JSON garbage", () => {
    expect(parseViewAsCookie("not-json")).toBeNull();
    expect(parseViewAsCookie("{")).toBeNull();
  });

  it("parses legacy (no-mode) role payloads as role-mode", () => {
    const out = parseViewAsCookie(JSON.stringify({ role: "member", team: null }));
    expect(out).toEqual({ mode: "role", role: "member", team: null });
  });

  it("rejects unknown roles", () => {
    expect(
      parseViewAsCookie(JSON.stringify({ role: "admin", team: null })),
    ).toBeNull();
    expect(
      parseViewAsCookie(JSON.stringify({ mode: "role", role: "owner" })),
    ).toBeNull();
  });

  it("rejects team strings with control characters", () => {
    const out = parseViewAsCookie(
      JSON.stringify({ mode: "role", role: "member", team: "Eng\nineering" }),
    );
    expect(out).toEqual({ mode: "role", role: "member", team: null });
  });

  it("parses a valid user-mode payload", () => {
    const out = parseViewAsCookie(
      JSON.stringify({
        mode: "user",
        userId: "11111111-1111-1111-1111-111111111111",
        email: "bob@wearephlo.com",
        displayName: "Bob",
        avatarUrl: "https://example.com/a.png",
        title: "Engineer",
        role: "member",
        team: "Engineering",
      }),
    );
    expect(out).toEqual({
      mode: "user",
      userId: "11111111-1111-1111-1111-111111111111",
      email: "bob@wearephlo.com",
      displayName: "Bob",
      avatarUrl: "https://example.com/a.png",
      title: "Engineer",
      role: "member",
      team: "Engineering",
    });
  });

  it("rejects user-mode without a valid uuid", () => {
    expect(
      parseViewAsCookie(
        JSON.stringify({
          mode: "user",
          userId: "not-a-uuid",
          email: "bob@wearephlo.com",
          displayName: "Bob",
          role: "member",
        }),
      ),
    ).toBeNull();
  });

  it("rejects user-mode missing email or display name", () => {
    expect(
      parseViewAsCookie(
        JSON.stringify({
          mode: "user",
          userId: "11111111-1111-1111-1111-111111111111",
          role: "member",
        }),
      ),
    ).toBeNull();
  });

  it("rejects user-mode with an invalid role", () => {
    expect(
      parseViewAsCookie(
        JSON.stringify({
          mode: "user",
          userId: "11111111-1111-1111-1111-111111111111",
          email: "bob@wearephlo.com",
          displayName: "Bob",
          role: "viewer",
        }),
      ),
    ).toBeNull();
  });
});
