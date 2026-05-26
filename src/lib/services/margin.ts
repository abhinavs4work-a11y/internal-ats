import type { MarginInputs, MarginResults } from "@/types";

export const MARGIN_DEFAULTS = {
  agencyMarkupPercentage: 7,
  passThrough: 200,
  workingDaysAnnual: 220,
  workingDaysMonthly: 22,
};

export function calculateMargin(inputs: MarginInputs): MarginResults {
  const { ectc, contingencyPercentage, agencyMarkupPercentage, avkalanMarkupPercentage, passThrough, buyout } = inputs;

  const contingencyAmount = (contingencyPercentage / 100) * ectc;
  const agencyMarkupAmount = (agencyMarkupPercentage / 100) * ectc;
  const avkalanMarkupAmount = (avkalanMarkupPercentage / 100) * ectc;
  const passThroughAmount = passThrough * MARGIN_DEFAULTS.workingDaysAnnual;

  const totalCost =
    ectc +
    contingencyAmount +
    agencyMarkupAmount +
    avkalanMarkupAmount +
    passThroughAmount +
    buyout;

  const dailyRate = totalCost / MARGIN_DEFAULTS.workingDaysAnnual;
  const monthlyRate = totalCost / MARGIN_DEFAULTS.workingDaysMonthly;

  return {
    ...inputs,
    contingencyAmount,
    agencyMarkupAmount,
    avkalanMarkupAmount,
    passThroughAmount,
    totalCost,
    dailyRate,
    monthlyRate,
  };
}
