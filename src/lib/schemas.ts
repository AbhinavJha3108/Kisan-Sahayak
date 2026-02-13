import { z } from "zod";

export const ChatRequestSchema = z
  .object({
    message: z.string().min(1).max(2000),
    language: z.enum(["auto", "english", "hindi", "marathi", "tamil", "telugu", "punjabi"]).optional(),
    mode: z.enum(["dhenu_only", "hybrid_lite", "hybrid_full"]).optional(),
    location: z.string().max(200).optional(),
    elaborate: z.boolean().optional(),
    previous_answer: z.string().max(8000).optional(),
    conversation_id: z.string().max(200).optional()
  })
  .strict();

export const ConversationCreateSchema = z
  .object({
    title: z.string().min(1).max(120),
    first_message: z.string().max(4000).optional()
  })
  .strict();

export const ConversationUpdateSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    message_count: z.number().int().nonnegative().optional(),
    preview: z.string().max(4000).optional()
  })
  .strict();

export const MessageCreateSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string().min(1).max(4000)
  })
  .strict();

export const ReverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180)
});
