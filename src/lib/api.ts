import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError, logInfo } from "@/lib/logger";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function withErrorHandling<TContext = unknown>(
  handler: (req: NextRequest, context: TContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: TContext) => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    try {
      const response = await handler(req, context);
      response.headers.set("X-Request-Id", requestId);
      logInfo("api_request", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        durationMs: Date.now() - started
      });
      return response;
    } catch (error) {
      if (error instanceof ZodError) {
        logError("api_validation_error", {
          requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          issues: error.issues
        });
        return NextResponse.json(
          { error: "Validation error", details: error.issues, requestId },
          { status: 400 }
        );
      }
      if (error instanceof ApiError) {
        logError("api_error", {
          requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          status: error.status,
          details: error.details
        });
        return NextResponse.json(
          { error: error.message, details: error.details, requestId },
          { status: error.status }
        );
      }
      logError("api_error_unhandled", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      return NextResponse.json(
        { error: "Internal server error", requestId },
        { status: 500 }
      );
    }
  };
}

export async function parseJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
}

export function requireUser<T extends { uid: string } | null>(user: T): asserts user is Exclude<T, null> {
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }
}
