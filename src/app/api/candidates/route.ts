import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, CandidateSource, EntityType } from "@prisma/client";
import { generateCandidateId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const source = searchParams.get("source");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const where = {
    AND: [
      search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {},
      source ? { source: source as CandidateSource } : {},
    ],
  };

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        mappings: {
          include: {
            role: { select: { id: true, roleId: true, title: true, client: { select: { name: true } } } },
            recruiter: { select: { id: true, name: true } },
          },
        },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.candidate.count({ where }),
  ]);

  return NextResponse.json({ candidates, total, page, limit });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const {
    fullName,
    email,
    phone,
    currentCtc,
    expectedCtc,
    offersInHand = false,
    offerAmount,
    currentLocation,
    preferredLocations = [],
    source = "InternalLinkedIn",
    availability,
    notes,
    ownerId,
  } = body;

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
  }

  // Check for duplicate email
  const existing = await prisma.candidate.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate", existingId: existing.id, existingCandidateId: existing.candidateId, message: "Candidate with this email already exists" },
      { status: 409 }
    );
  }

  // Generate next candidate ID
  const lastCandidate = await prisma.candidate.findFirst({
    orderBy: { createdAt: "desc" },
    select: { candidateId: true },
  });

  let nextSeq = 1;
  if (lastCandidate?.candidateId) {
    const match = lastCandidate.candidateId.match(/CAN-(\d+)/);
    if (match) nextSeq = parseInt(match[1]) + 1;
  }

  const candidate = await prisma.candidate.create({
    data: {
      candidateId: generateCandidateId(nextSeq),
      fullName,
      email,
      phone,
      currentCtc: currentCtc ? parseFloat(currentCtc) : null,
      expectedCtc: expectedCtc ? parseFloat(expectedCtc) : null,
      offersInHand,
      offerAmount: offerAmount ? parseFloat(offerAmount) : null,
      currentLocation,
      preferredLocations,
      source: source as CandidateSource,
      availability: availability || null,
      notes,
      // Auto-assign logged-in user as owner; caller may override with explicit ownerId
      ownerId: ownerId ?? user.id,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Candidate,
    entityId: candidate.id,
    actionType: ActionType.Created,
    newValue: { fullName, email, candidateId: candidate.candidateId },
    description: `Candidate ${candidate.candidateId} - ${fullName} created`,
  });

  return NextResponse.json(candidate, { status: 201 });
}
