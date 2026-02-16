import { describe, expect, it } from "vitest";
import { parseLocalizedNumber } from "@/lib/number-parsing";

describe("parseLocalizedNumber", () => {
  it("parses comma thousands", () => {
    expect(parseLocalizedNumber("1,299")).toBe(1299);
  });

  it("parses dot thousands", () => {
    expect(parseLocalizedNumber("1.299")).toBe(1299);
  });

  it("parses european decimal comma", () => {
    expect(parseLocalizedNumber("59,99")).toBe(59.99);
  });

  it("parses mixed separators", () => {
    expect(parseLocalizedNumber("1.299,99")).toBe(1299.99);
    expect(parseLocalizedNumber("1,299.99")).toBe(1299.99);
  });

  it("parses japan-style integers correctly", () => {
    expect(parseLocalizedNumber("850")).toBe(850);
    expect(parseLocalizedNumber("1,200")).toBe(1200);
  });
});
