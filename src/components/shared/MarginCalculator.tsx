"use client";

import { useState } from "react";
import { calculateMargin, MARGIN_DEFAULTS } from "@/lib/services/margin";
import { formatCurrency, toIndianFormat } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarginInputs, MarginResults } from "@/types";
import { Save } from "lucide-react";

// Currency fields that need Indian comma formatting
const CURRENCY_FIELDS = ["ectc", "passThrough", "buyout"] as const;
type CurrencyField = typeof CURRENCY_FIELDS[number];

function initDisplay(vals: Partial<MarginInputs>): Record<CurrencyField, string> {
  const fmt = (v?: number) => (v != null && v > 0 ? toIndianFormat(String(Math.round(v))) : "");
  return {
    ectc:        fmt(vals.ectc),
    passThrough: vals.passThrough != null ? toIndianFormat(String(Math.round(vals.passThrough))) : toIndianFormat(String(MARGIN_DEFAULTS.passThrough)),
    buyout:      fmt(vals.buyout),
  };
}

interface Props {
  initialValues?: Partial<MarginInputs>;
  mappingId?: string;
  candidateId?: string;
  onSave?: (results: MarginResults) => void;
  readOnly?: boolean;
  hideSave?: boolean;
  saveLabel?: string;
}

const defaultInputs: MarginInputs = {
  ectc: 0,
  contingencyPercentage: 0,
  agencyMarkupPercentage: MARGIN_DEFAULTS.agencyMarkupPercentage,
  avkalanMarkupPercentage: 0,
  passThrough: MARGIN_DEFAULTS.passThrough,
  buyout: 0,
};

export function MarginCalculator({
  initialValues,
  mappingId,
  candidateId,
  onSave,
  readOnly,
  hideSave,
  saveLabel,
}: Props) {
  const merged = { ...defaultInputs, ...initialValues };
  const [inputs,  setInputs]  = useState<MarginInputs>(merged);
  const [display, setDisplay] = useState<Record<CurrencyField, string>>(() => initDisplay(merged));
  const [saving,  setSaving]  = useState(false);

  const results = calculateMargin(inputs);

  // For percentage fields — plain number input
  function handlePctChange(field: keyof MarginInputs, value: string) {
    setInputs((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  }

  // For currency fields — Indian formatted string input
  function handleCurrencyChange(field: CurrencyField, raw: string) {
    const digits = raw.replace(/,/g, "").replace(/[^0-9]/g, "");
    const formatted = digits ? toIndianFormat(digits) : "";
    const num = digits ? parseInt(digits, 10) : 0;
    setDisplay((prev) => ({ ...prev, [field]: formatted }));
    setInputs((prev)  => ({ ...prev, [field]: num }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (candidateId) {
        // Save calculation to candidate
        const res = await fetch(`/api/candidates/${candidateId}/margin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        });
        if (res.ok) onSave?.(results);
      } else if (mappingId) {
        // Save calculation to mapping
        const res = await fetch(`/api/mappings/${mappingId}/margin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        });
        if (res.ok) onSave?.(results);
      } else {
        onSave?.(results);
      }
    } finally {
      setSaving(false);
    }
  }

  // Currency field row — uses Indian comma formatting
  const currencyRow = (label: string, field: CurrencyField) => (
    <div className="flex items-center gap-4">
      <Label className="w-44 text-xs text-slate-600 shrink-0">{label}</Label>
      <div className="relative flex-1">
        <Input
          inputMode="numeric"
          value={display[field]}
          onChange={(e) => handleCurrencyChange(field, e.target.value)}
          className="pr-8 h-8 text-sm"
          readOnly={readOnly}
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
      </div>
    </div>
  );

  // Percentage field row — plain number
  const pctRow = (label: string, field: keyof MarginInputs) => (
    <div className="flex items-center gap-4">
      <Label className="w-44 text-xs text-slate-600 shrink-0">{label}</Label>
      <div className="relative flex-1">
        <Input
          type="number"
          value={inputs[field] || ""}
          onChange={(e) => handlePctChange(field, e.target.value)}
          className="pr-8 h-8 text-sm"
          readOnly={readOnly}
          step="0.1"
          min={0}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      </div>
    </div>
  );

  const resultRow = (label: string, value: number, highlight = false) => (
    <div className={`flex items-center justify-between py-2 ${highlight ? "border-t border-slate-200 pt-3" : ""}`}>
      <span className={`text-sm ${highlight ? "font-semibold text-slate-900" : "text-slate-600"}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${highlight ? "font-bold text-blue-700 text-base" : "text-slate-900"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Inputs</h3>
        {currencyRow("Expected CTC (ECTC)",      "ectc")}
        {pctRow(     "Contingency",               "contingencyPercentage")}
        {pctRow(     "Agency Markup",             "agencyMarkupPercentage")}
        {pctRow(     "Avkalan Markup",            "avkalanMarkupPercentage")}
        {currencyRow("Pass Through (daily rate)", "passThrough")}
        {currencyRow("Buyout",                    "buyout")}
      </div>

      {/* Results */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-0">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Calculations</h3>
        {resultRow("Contingency Amount", results.contingencyAmount)}
        {resultRow("Agency Markup Amount", results.agencyMarkupAmount)}
        {resultRow("Avkalan Markup Amount", results.avkalanMarkupAmount)}
        {resultRow(`Pass Through (×${MARGIN_DEFAULTS.workingDaysAnnual} days)`, results.passThroughAmount)}
        {resultRow("Buyout", results.buyout)}
        {resultRow("Total Cost", results.totalCost, true)}
        <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Daily Rate</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(results.dailyRate)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Monthly Rate</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(results.monthlyRate)}</p>
          </div>
        </div>
      </div>

      {!readOnly && !hideSave && (
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          <Save size={14} />
          {saving
            ? "Saving..."
            : saveLabel ?? (candidateId ? "Save to Candidate" : mappingId ? "Save to Mapping" : "Apply")}
        </Button>
      )}
    </div>
  );
}
