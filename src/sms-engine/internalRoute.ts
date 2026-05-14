import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { logServerError } from "@/sms-engine/safeLogging";

export class InternalApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InternalApiError";
    this.status = status;
  }
}

export function internalOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function internalError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request body.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  if (error instanceof InternalApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: error.status },
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Requested record was not found.",
      },
      { status: 404 },
    );
  }

  logServerError("Internal API error", error, {
    entityType: "InternalAPI",
    status: "error",
    result: "failure",
  });
  return NextResponse.json(
    {
      ok: false,
      error: "Internal API request failed.",
    },
    { status: 500 },
  );
}
