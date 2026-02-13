import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/authServer";
import { withErrorHandling, requireUser } from "@/lib/api";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await verifyRequestUser(req);
  requireUser(user);
  return NextResponse.json({ user });
});
