import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/authServer";
import { deleteConversation, updateConversation } from "@/lib/conversations";
import { parseJson, requireUser, withErrorHandling } from "@/lib/api";
import { ConversationUpdateSchema } from "@/lib/schemas";

export const PUT = withErrorHandling(async (req: NextRequest, context: { params: { conversationId: string } }) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const data = ConversationUpdateSchema.parse(await parseJson(req));
  const conversationId = context.params.conversationId;
  await updateConversation(user.uid, conversationId, {
    title: data.title,
    message_count: data.message_count,
    preview: data.preview
  });
  return NextResponse.json({ status: "success" });
});

export const DELETE = withErrorHandling(async (req: NextRequest, context: { params: { conversationId: string } }) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  const conversationId = context.params.conversationId;
  await deleteConversation(user.uid, conversationId);
  return NextResponse.json({ status: "success" });
});
