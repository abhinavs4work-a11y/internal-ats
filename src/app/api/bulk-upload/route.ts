import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { createMapping } from "@/lib/services/mappings";
import { CandidateSource, MappingStatus } from "@prisma/client";
import { generateCandidateId } from "@/lib/utils";
import type { BulkUploadRow, BulkUploadResult } from "@/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const { rows }: { rows: BulkUploadRow[] } = body;

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }

  const results: BulkUploadResult[] = [];

  // ── Pre-fetch everything needed for the loop in one round-trip each ──────────
  const validEmails = rows.map((r) => r.email).filter(Boolean) as string[];
  const roleIds     = [...new Set(rows.map((r) => r.roleId).filter(Boolean))] as string[];
  const recruiterNames = [...new Set(rows.map((r) => r.recruiter).filter(Boolean))] as string[];

  const [existingCandidates, rolesMap_raw, recruitersMap_raw, lastCandidate] = await Promise.all([
    prisma.candidate.findMany({
      where: { email: { in: validEmails } },
      select: { id: true, email: true },
    }),
    prisma.role.findMany({
      where: { roleId: { in: roleIds } },
      select: { id: true, roleId: true },
    }),
    recruiterNames.length
      ? prisma.user.findMany({
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.candidate.findFirst({
      orderBy: { createdAt: "desc" },
      select: { candidateId: true },
    }),
  ]);

  // Build lookup maps
  const candidateByEmail = new Map(existingCandidates.map((c) => [c.email, c.id]));
  const roleByRoleId     = new Map(rolesMap_raw.map((r) => [r.roleId, r.id]));
  const recruiterByName  = new Map(
    (recruiterNames.length ? recruitersMap_raw : []).map((u) => [u.name.toLowerCase(), u.id])
  );

  // Determine starting sequence for new candidate IDs
  let nextSeq = 1;
  if (lastCandidate?.candidateId) {
    const match = lastCandidate.candidateId.match(/CAN-(\d+)/);
    if (match) nextSeq = parseInt(match[1]) + 1;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.email) {
      results.push({ row: rowNum, status: "error", message: "Email is required" });
      continue;
    }

    // Find or create candidate
    let candidateId: string;
    let isDuplicate = false;

    const existingId = candidateByEmail.get(row.email);

    if (existingId) {
      candidateId = existingId;
      isDuplicate = true;
    } else {
      const newCandidate = await prisma.candidate.create({
        data: {
          candidateId: generateCandidateId(nextSeq++),
          fullName: row.candidateName ?? row.email,
          email: row.email,
          phone: row.phone,
          currentCtc: row.currentCtc ? parseFloat(row.currentCtc) : null,
          expectedCtc: row.expectedCtc ? parseFloat(row.expectedCtc) : null,
          source: (row.source as CandidateSource) ?? "InternalLinkedIn",
          notes: row.notes,
        },
      });
      candidateId = newCandidate.id;
      candidateByEmail.set(row.email, candidateId);
    }

    // Map to role if provided
    if (row.roleId) {
      const roleDbId = roleByRoleId.get(row.roleId);
      if (!roleDbId) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Role ID "${row.roleId}" not found`,
          email: row.email,
          candidateName: row.candidateName,
        });
        continue;
      }

      // Find recruiter from pre-fetched map
      let recruiterId = user.id;
      if (row.recruiter) {
        const found = recruiterByName.get(row.recruiter.toLowerCase());
        if (found) recruiterId = found;
        else {
          // Fallback: partial match
          for (const [name, id] of recruiterByName) {
            if (name.includes(row.recruiter.toLowerCase())) { recruiterId = id; break; }
          }
        }
      }

      try {
        await createMapping({
          candidateId,
          roleId: roleDbId,
          recruiterId,
          status: (row.status as MappingStatus) ?? MappingStatus.Submitted,
          submissionDate: row.submissionDate ? new Date(row.submissionDate) : undefined,
          notes: row.notes,
          userId: user.id,
        });

        results.push({
          row: rowNum,
          status: isDuplicate ? "duplicate" : "success",
          message: isDuplicate
            ? "Existing candidate mapped to role"
            : "Candidate created and mapped to role",
          email: row.email,
          candidateName: row.candidateName,
        });
      } catch {
        results.push({
          row: rowNum,
          status: "error",
          message: "Candidate already mapped to this role",
          email: row.email,
          candidateName: row.candidateName,
        });
      }
    } else {
      results.push({
        row: rowNum,
        status: isDuplicate ? "duplicate" : "success",
        message: isDuplicate ? "Duplicate candidate skipped (no role)" : "Candidate created",
        email: row.email,
        candidateName: row.candidateName,
      });
    }
  }

  return NextResponse.json({ results });
}

// Bulk status update
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const { mappingIds, status, notes }: { mappingIds: string[]; status: MappingStatus; notes?: string } = body;

  if (!mappingIds?.length || !status) {
    return NextResponse.json({ error: "mappingIds and status are required" }, { status: 400 });
  }

  const { updateMappingStatus } = await import("@/lib/services/mappings");

  const results = await Promise.allSettled(
    mappingIds.map((id) => updateMappingStatus({ mappingId: id, newStatus: status, userId: user.id }))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ succeeded, failed });
}
