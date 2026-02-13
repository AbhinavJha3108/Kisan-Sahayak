import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/authServer";
import { listMessages, saveMessage, updateConversation } from "@/lib/conversations";
import { validateMessage, detectSuspiciousPatterns } from "@/lib/security";
import { ApiError, parseJson, requireUser, withErrorHandling } from "@/lib/api";
import { MessageCreateSchema } from "@/lib/schemas";

export const GET = withErrorHandling(async (req: NextRequest, context: { params: { conversationId: string } }) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const conversationId = context.params.conversationId;
  const messages = await listMessages(user.uid, conversationId);
  return NextResponse.json({ messages });
});

export const POST = withErrorHandling(async (req: NextRequest, context: { params: { conversationId: string } }) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const payload = MessageCreateSchema.parse(await parseJson(req));
  const validationResult = validateMessage(payload.text);
  if (!validationResult.valid) {
    throw new ApiError("Invalid message", 400, validationResult.errors);
  }
  const suspicious = detectSuspiciousPatterns(payload.text);
  if (suspicious.length) {
    throw new ApiError("Message looks unsafe", 400);
  }

  const conversationId = context.params.conversationId;
  await saveMessage(user.uid, conversationId, payload.role, validationResult.sanitized);
  if (payload.role === "user") {
    await updateConversation(user.uid, conversationId, { preview: validationResult.sanitized });
  }
  return NextResponse.json({ status: "success" });
});
