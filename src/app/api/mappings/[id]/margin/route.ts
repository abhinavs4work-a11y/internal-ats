import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { calculateMargin } from "@/lib/services/margin";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const margin = await prisma.marginCalculation.findUnique({
    where: { mappingId: id },
  });

  return NextResponse.json(margin);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json();
  const {
    ectc,
    contingencyPercentage,
    agencyMarkupPercentage = 7,
    avkalanMarkupPercentage = 0,
    passThrough = 200,
    buyout = 0,
  } = body;

  const results = calculateMargin({
    ectc: parseFloat(ectc),
    contingencyPercentage: parseFloat(contingencyPercentage),
    agencyMarkupPercentage: parseFloat(agencyMarkupPercentage),
    avkalanMarkupPercentage: parseFloat(avkalanMarkupPercentage),
    passThrough: parseFloat(passThrough),
    buyout: parseFloat(buyout),
  });

  const margin = await prisma.marginCalculation.upsert({
    where: { mappingId: id },
    update: {
      ectc: results.ectc,
      contingencyPercentage: results.contingencyPercentage,
      contingencyAmount: results.contingencyAmount,
      agencyMarkupPercentage: results.agencyMarkupPercentage,
      agencyMarkupAmount: results.agencyMarkupAmount,
      avkalanMarkupPercentage: results.avkalanMarkupPercentage,
      avkalanMarkupAmount: results.avkalanMarkupAmount,
      passThrough: results.passThrough,
      passThroughAmount: results.passThroughAmount,
      buyout: results.buyout,
      totalCost: results.totalCost,
      dailyRate: results.dailyRate,
      monthlyRate: results.monthlyRate,
    },
    create: {
      mappingId: id,
      ectc: results.ectc,
      contingencyPercentage: results.contingencyPercentage,
      contingencyAmount: results.contingencyAmount,
      agencyMarkupPercentage: results.agencyMarkupPercentage,
      agencyMarkupAmount: results.agencyMarkupAmount,
      avkalanMarkupPercentage: results.avkalanMarkupPercentage,
      avkalanMarkupAmount: results.avkalanMarkupAmount,
      passThrough: results.passThrough,
      passThroughAmount: results.passThroughAmount,
      buyout: results.buyout,
      totalCost: results.totalCost,
      dailyRate: results.dailyRate,
      monthlyRate: results.monthlyRate,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Margin,
    entityId: id,
    actionType: ActionType.Updated,
    newValue: { totalCost: results.totalCost, dailyRate: results.dailyRate },
    description: `Margin calculation saved for mapping`,
  });

  return NextResponse.json(margin);
}
