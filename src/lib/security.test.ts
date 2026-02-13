import { describe, it, expect } from "vitest";
import { sanitizeInput, validateMessage, detectSuspiciousPatterns } from "./security";

describe("security helpers", () => {
  it("sanitizes script tags", () => {
    const sanitized = sanitizeInput('<script>alert("x")</script>hello');
    expect(sanitized).toBe("hello");
  });

  it("validates messages", () => {
    const result = validateMessage("hello");
    expect(result.valid).toBe(true);
  });

  it("flags suspicious patterns", () => {
    const hits = detectSuspiciousPatterns("DROP TABLE users;");
    expect(hits.length).toBeGreaterThan(0);
  });
});
