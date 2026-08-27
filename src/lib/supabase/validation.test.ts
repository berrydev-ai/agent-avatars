import { describe, expect, it } from "vitest";

import {
  decodeTeamCursor,
  encodeTeamCursor,
  parseAvatarId,
  parseEmailPassword,
  parseTeamName,
} from "./validation";

describe("identity input validation", () => {
  it("normalizes email without changing the password", () => {
    expect(
      parseEmailPassword({
        email: "  PERSON@example.test ",
        password: "correct horse",
      }),
    ).toEqual({ email: "PERSON@example.test", password: "correct horse" });
  });

  it("enforces password limits in UTF-8 bytes", () => {
    expect(() =>
      parseEmailPassword({ email: "a@example.test", password: "é".repeat(5) }),
    ).toThrow();
    expect(
      parseEmailPassword({ email: "a@example.test", password: "é".repeat(6) }),
    ).toBeDefined();
    expect(
      parseEmailPassword({ email: "a@example.test", password: "é".repeat(36) }),
    ).toBeDefined();
    expect(() =>
      parseEmailPassword({ email: "a@example.test", password: "é".repeat(37) }),
    ).toThrow();
  });

  it("rejects malformed or oversized email input", () => {
    expect(() =>
      parseEmailPassword({ email: "missing-at", password: "a".repeat(12) }),
    ).toThrow();
    expect(() =>
      parseEmailPassword({
        email: `${"a".repeat(244)}@example.test`,
        password: "a".repeat(12),
      }),
    ).toThrow();
  });

  it("trims names and counts Unicode code points", () => {
    expect(parseTeamName("  Builders  ")).toBe("Builders");
    expect(parseTeamName("😀".repeat(80))).toBe("😀".repeat(80));
    expect(() => parseTeamName("😀".repeat(81))).toThrow();
  });

  it("accepts only stable content-addressed avatar IDs", () => {
    expect(parseAvatarId("dicebear-lorelei-0123456789abcdefabcd")).toBe(
      "dicebear-lorelei-0123456789abcdefabcd",
    );
    expect(() => parseAvatarId("../avatar.svg")).toThrow();
  });

  it("round-trips opaque team cursors and rejects malformed values", () => {
    const cursor = encodeTeamCursor({
      updatedAt: "2026-08-27T20:00:00.000Z",
      id: "10000000-0000-4000-8000-000000000001",
    });

    expect(decodeTeamCursor(cursor)).toEqual({
      updatedAt: "2026-08-27T20:00:00.000Z",
      id: "10000000-0000-4000-8000-000000000001",
    });
    expect(() => decodeTeamCursor("not-a-cursor")).toThrow();
  });
});
