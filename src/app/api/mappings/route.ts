import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { createMapping } from "@/lib/services/mappings";
import { MappingStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const { candidateId, roleId, recruiterId, clientPoc, submissionDate, status, notes } = body;

  if (!candidateId || !roleId || !recruiterId) {
    return NextResponse.json({ error: "candidateId, roleId, and recruiterId are required" }, { status: 400 });
  }

  try {
    const mapping = await createMapping({
      candidateId,
      roleId,
      recruiterId,
      clientPoc,
      submissionDate: submissionDate ? new Date(submissionDate) : undefined,
      status: status as MappingStatus | undefined,
      notes,
      userId: user.id,
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create mapping";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
