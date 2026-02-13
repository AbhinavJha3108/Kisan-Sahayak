import { describe, it, expect } from "vitest";
import {
  ChatRequestSchema,
  ConversationCreateSchema,
  ConversationUpdateSchema,
  MessageCreateSchema,
  ReverseGeocodeSchema
} from "./schemas";

describe("schemas", () => {
  it("validates chat request", () => {
    const parsed = ChatRequestSchema.parse({ message: "Hello", language: "auto" });
    expect(parsed.message).toBe("Hello");
  });

  it("rejects invalid chat request", () => {
    expect(() => ChatRequestSchema.parse({})).toThrow();
  });

  it("validates conversation create", () => {
    const parsed = ConversationCreateSchema.parse({ title: "My chat", first_message: "Hi" });
    expect(parsed.title).toBe("My chat");
  });

  it("validates conversation update", () => {
    const parsed = ConversationUpdateSchema.parse({ title: "Renamed", preview: "Preview" });
    expect(parsed.preview).toBe("Preview");
  });

  it("validates message create", () => {
    const parsed = MessageCreateSchema.parse({ role: "user", text: "Message" });
    expect(parsed.role).toBe("user");
  });

  it("validates reverse geocode query", () => {
    const parsed = ReverseGeocodeSchema.parse({ lat: "18.52", lon: "73.85" });
    expect(parsed.lat).toBeCloseTo(18.52);
  });
});
