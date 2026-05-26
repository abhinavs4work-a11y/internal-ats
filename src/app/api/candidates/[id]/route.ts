import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, CandidateSource, EntityType } from "@prisma/client";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      mappings: {
        include: {
          role: { include: { client: true } },
          recruiter: { select: { id: true, name: true } },
          marginCalculation: true,
        },
        orderBy: { createdAt: "desc" },
      },
      owner: { select: { id: true, name: true } },
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(candidate);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json();
  const {
    fullName, email, phone, currentCtc, expectedCtc, offersInHand,
    offerAmount, currentLocation, preferredLocations, source, availability, notes,
    dailyRate, ownerId,
  } = body;

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check email uniqueness if changed
  if (email && email !== existing.email) {
    const emailExists = await prisma.candidate.findUnique({ where: { email } });
    if (emailExists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      ...(fullName && { fullName }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(currentCtc !== undefined && { currentCtc: currentCtc ? parseFloat(currentCtc) : null }),
      ...(expectedCtc !== undefined && { expectedCtc: expectedCtc ? parseFloat(expectedCtc) : null }),
      ...(offersInHand !== undefined && { offersInHand }),
      ...(offerAmount !== undefined && { offerAmount: offerAmount ? parseFloat(offerAmount) : null }),
      ...(currentLocation !== undefined && { currentLocation }),
      ...(preferredLocations && { preferredLocations }),
      ...(source && { source: source as CandidateSource }),
      ...(availability !== undefined && { availability: availability || null }),
      ...(notes !== undefined && { notes }),
      ...(dailyRate !== undefined && { dailyRate: dailyRate !== null && dailyRate !== "" ? parseFloat(dailyRate) : null }),
      ...(ownerId !== undefined && { ownerId: ownerId || null }),
    },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Candidate,
    entityId: id,
    actionType: ActionType.Updated,
    oldValue: { fullName: existing.fullName, expectedCtc: existing.expectedCtc?.toString() },
    newValue: { fullName: updated.fullName, expectedCtc: updated.expectedCtc?.toString() },
    description: `Candidate ${updated.candidateId} updated`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete resume from storage if exists
  if (candidate.resumeUrl) {
    const supabase = await createSupabaseClient();
    const path = candidate.resumeUrl.split("/resumes/")[1];
    if (path) await supabase.storage.from("resumes").remove([path]);
  }

  await prisma.candidate.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Candidate,
    entityId: id,
    actionType: ActionType.Deleted,
    oldValue: { fullName: candidate.fullName, candidateId: candidate.candidateId },
    description: `Candidate ${candidate.candidateId} deleted`,
  });

  return NextResponse.json({ success: true });
}
