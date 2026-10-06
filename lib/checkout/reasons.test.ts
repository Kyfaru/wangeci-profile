import { describe, expect, it } from "vitest";

import { shortReason } from "./reasons";
import { orderWelcome } from "@/lib/sms-templates";

describe("failure reasons", () => {
  it("maps provider text to short sentences of under 10 words", () => {
    const samples = ["1032: Request cancelled by user", "2001: The initiator information is invalid", "1: The balance is insufficient", "1037: DS timeout user cannot be reached", "Declined", "abandoned", "provider_initialize_failed", "something odd", null];
    for (const s of samples) expect(shortReason(s).split(/\s+/).length).toBeLessThan(10);
    expect(shortReason("1032: Request cancelled by user")).toBe("You cancelled the request.");
    expect(shortReason("2001: wrong pin")).toBe("The PIN entered was wrong.");
    expect(shortReason(undefined)).toBe("The payment did not go through.");
  });
});

describe("welcome SMS", () => {
  it("is at most 150 characters and keeps the link intact", () => {
    const url = "https://wangeci.example.com/dashboard";
    const sms = orderWelcome(url);
    expect(sms.length).toBeLessThanOrEqual(150);
    expect(sms.endsWith(url)).toBe(true);
    expect(sms).toMatch(/^Congratulations/);
  });
});
