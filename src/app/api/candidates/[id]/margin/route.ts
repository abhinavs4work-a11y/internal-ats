import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { calculateMargin } from "@/lib/services/margin";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const calc = await prisma.marginCalculation.findUnique({
    where: { candidateId: id },
  });
  return NextResponse.json(calc ?? null);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    ectc,
    contingencyPercentage,
    agencyMarkupPercentage,
    avkalanMarkupPercentage,
    passThrough,
    buyout,
  } = body;

  const inputs = {
    ectc: parseFloat(ectc) || 0,
    contingencyPercentage: parseFloat(contingencyPercentage) || 0,
    agencyMarkupPercentage: parseFloat(agencyMarkupPercentage) || 0,
    avkalanMarkupPercentage: parseFloat(avkalanMarkupPercentage) || 0,
    passThrough: parseFloat(passThrough) || 0,
    buyout: parseFloat(buyout) || 0,
  };
  const results = calculateMargin(inputs);

  const calcData = {
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
  };

  // Upsert margin calc linked to this candidate
  const existing = await prisma.marginCalculation.findUnique({ where: { candidateId: id } });
  const calc = existing
    ? await prisma.marginCalculation.update({ where: { candidateId: id }, data: calcData })
    : await prisma.marginCalculation.create({ data: { ...calcData, candidateId: id } });

  // Keep candidate.dailyRate in sync
  await prisma.candidate.update({
    where: { id },
    data: { dailyRate: results.dailyRate },
  });

  return NextResponse.json({ success: true, calc, dailyRate: results.dailyRate });
}
