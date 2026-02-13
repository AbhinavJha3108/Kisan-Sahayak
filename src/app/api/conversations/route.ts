import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/authServer";
import { createConversation, listConversations } from "@/lib/conversations";
import { parseJson, requireUser, withErrorHandling } from "@/lib/api";
import { ConversationCreateSchema } from "@/lib/schemas";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const conversations = await listConversations(user.uid);
  return NextResponse.json({ conversations });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const data = ConversationCreateSchema.parse(await parseJson(req));
  const title = String(data.title || "New conversation").trim();
  const firstMessage = String(data.first_message || "");
  const conversationId = await createConversation(user.uid, title, firstMessage);
  return NextResponse.json({ conversation_id: conversationId });
});
