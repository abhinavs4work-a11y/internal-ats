import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType, RolePriority, RoleStatus } from "@prisma/client";
import { generateRoleId } from "@/lib/utils";
import type { BulkUploadRoleRow, BulkUploadRoleResult } from "@/types";

const VALID_PRIORITIES = new Set(["High", "Medium", "Low"]);
const VALID_STATUSES   = new Set(["Active", "OnHold", "Inactive", "Closed"]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const { rows }: { rows: BulkUploadRoleRow[] } = body;

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }

  // Pre-load all clients so we can match by name without N+1 queries
  const allClients = await prisma.client.findMany({ select: { id: true, name: true } });
  const clientMap = new Map(allClients.map((c) => [c.name.toLowerCase().trim(), c]));

  // Pre-load all users for recruiter matching
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });

  const results: BulkUploadRoleResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // ── Validate mandatory fields ──
    const title = row.title?.trim();
    const clientName = row.clientName?.trim();

    if (!title) {
      results.push({ row: rowNum, status: "error", message: "title is required", clientName });
      continue;
    }
    if (!clientName) {
      results.push({ row: rowNum, status: "error", message: "clientName is required", roleTitle: title });
      continue;
    }

    // ── Resolve client ──
    const client = clientMap.get(clientName.toLowerCase());
    if (!client) {
      results.push({
        row: rowNum, status: "error",
        message: `Client "${clientName}" not found — check exact spelling`,
        roleTitle: title, clientName,
      });
      continue;
    }

    // ── Validate optional enum fields ──
    const priority = row.priority?.trim() || "Medium";
    const status   = row.status?.trim()   || "Active";
    const openings = row.openings ? parseInt(row.openings, 10) : 1;

    if (!VALID_PRIORITIES.has(priority)) {
      results.push({
        row: rowNum, status: "error",
        message: `Invalid priority "${priority}" — use High, Medium or Low`,
        roleTitle: title, clientName,
      });
      continue;
    }
    if (!VALID_STATUSES.has(status)) {
      results.push({
        row: rowNum, status: "error",
        message: `Invalid status "${status}" — use Active, OnHold, Inactive or Closed`,
        roleTitle: title, clientName,
      });
      continue;
    }

    // ── Generate sequential role ID scoped to client ──
    const rolesForClient = await prisma.role.findMany({
      where: { clientId: client.id },
      select: { roleId: true },
      orderBy: { createdDate: "asc" },
    });
    const nextSeq = rolesForClient.length + 1;
    const roleId = generateRoleId(client.name, nextSeq);

    // ── Parse locations ──
    const locations = row.locations
      ? row.locations.split(",").map((l) => l.trim()).filter(Boolean)
      : [];

    // ── Resolve recruiters ──
    const recruiterIds: string[] = [];
    if (row.recruiters) {
      const names = row.recruiters.split(",").map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        const found = allUsers.find((u) =>
          u.name.toLowerCase().includes(name.toLowerCase())
        );
        if (found) recruiterIds.push(found.id);
      }
    }

    // ── Create role ──
    try {
      const role = await prisma.role.create({
        data: {
          roleId,
          title,
          clientId: client.id,
          budget: row.budget ? parseFloat(row.budget) : null,
          openings: isNaN(openings) ? 1 : openings,
          locations,
          jd: row.jd?.trim() || null,
          priority: priority as RolePriority,
          status:   status   as RoleStatus,
          recruiters: recruiterIds.length > 0
            ? { create: recruiterIds.map((rid) => ({ recruiterId: rid })) }
            : undefined,
        },
      });

      await logActivity({
        userId: user.id,
        entityType: EntityType.Role,
        entityId: role.id,
        actionType: ActionType.Created,
        newValue: { roleId, title, clientId: client.id },
        description: `Role ${roleId} - ${title} created via bulk upload`,
      });

      results.push({
        row: rowNum, status: "success",
        message: `Role ${roleId} created`,
        roleId, roleTitle: title, clientName,
      });
    } catch (err) {
      results.push({
        row: rowNum, status: "error",
        message: err instanceof Error ? err.message : "Failed to create role",
        roleTitle: title, clientName,
      });
    }
  }

  return NextResponse.json({ results });
}
