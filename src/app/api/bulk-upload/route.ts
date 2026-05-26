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

    const existing = await prisma.candidate.findUnique({ where: { email: row.email } });

    if (existing) {
      candidateId = existing.id;
      isDuplicate = true;
    } else {
      // Create new candidate
      const lastCandidate = await prisma.candidate.findFirst({
        orderBy: { createdAt: "desc" },
        select: { candidateId: true },
      });
      let nextSeq = 1;
      if (lastCandidate?.candidateId) {
        const match = lastCandidate.candidateId.match(/CAN-(\d+)/);
        if (match) nextSeq = parseInt(match[1]) + 1;
      }

      const newCandidate = await prisma.candidate.create({
        data: {
          candidateId: generateCandidateId(nextSeq),
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
    }

    // Map to role if provided
    if (row.roleId) {
      const role = await prisma.role.findFirst({ where: { roleId: row.roleId } });
      if (!role) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Role ID "${row.roleId}" not found`,
          email: row.email,
          candidateName: row.candidateName,
        });
        continue;
      }

      // Find recruiter
      let recruiterId = user.id;
      if (row.recruiter) {
        const recruiter = await prisma.user.findFirst({
          where: { name: { contains: row.recruiter, mode: "insensitive" } },
        });
        if (recruiter) recruiterId = recruiter.id;
      }

      try {
        await createMapping({
          candidateId,
          roleId: role.id,
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
