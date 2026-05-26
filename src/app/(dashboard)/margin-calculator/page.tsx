"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MarginCalculator } from "@/components/shared/MarginCalculator";
import { Calculator, User2, RefreshCw, CheckCircle2, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MarginResults } from "@/types";

type Mode = "rough" | "candidate";

type CandidateSummary = {
  id: string;
  candidateId: string;
  fullName: string;
  expectedCtc: string | null;
};

type SavedCalc = {
  ectc: number;
  contingencyPercentage: number;
  agencyMarkupPercentage: number;
  avkalanMarkupPercentage: number;
  passThrough: number;
  buyout: number;
} | null;

// ── Candidate picker combobox ─────────────────────────────────────────────────
function CandidatePicker({
  candidates,
  selected,
  onSelect,
}: {
  candidates: CandidateSummary[];
  selected: CandidateSummary | null;
  onSelect: (c: CandidateSummary | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = candidates
    .filter(
      (c) =>
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.candidateId.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 20);

  function clearSelection() {
    onSelect(null);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          value={selected ? selected.fullName : search}
          onChange={(e) => {
            if (selected) onSelect(null);
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search candidate by name or ID…"
          className="pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {selected && (
            <button
              onClick={clearSelection}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </div>
      </div>

      {open && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400 text-center">No candidates found</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                onClick={() => {
                  onSelect(c);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-slate-900">{c.fullName}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {c.expectedCtc && (
                    <span className="text-xs text-blue-600 font-medium">
                      {formatCurrency(Number(c.expectedCtc))}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">{c.candidateId}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarginCalculatorPage() {
  const [mode, setMode] = useState<Mode>("rough");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSummary | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Fetch candidates for picker (only when in candidate mode)
  const { data: candidateData } = useQuery<{ candidates: CandidateSummary[] }>({
    queryKey: ["candidates-picker"],
    queryFn: async () => {
      const res = await fetch("/api/candidates?limit=500");
      return res.json();
    },
    enabled: mode === "candidate",
  });
  const candidates = candidateData?.candidates ?? [];

  // Fetch existing saved calculation for selected candidate
  const { data: savedCalc, isLoading: calcLoading } = useQuery<SavedCalc>({
    queryKey: ["candidate-margin", selectedCandidate?.id],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${selectedCandidate!.id}/margin`);
      const json = await res.json();
      return json ?? null;
    },
    enabled: !!selectedCandidate,
  });

  function handleCandidateSelect(c: CandidateSummary | null) {
    setSelectedCandidate(c);
    setSaveSuccess(false);
  }

  function handleSaved(results: MarginResults) {
    setSaveSuccess(true);
    queryClient.invalidateQueries({ queryKey: ["candidate-margin", selectedCandidate?.id] });
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["candidates-picker"] });
  }

  // Build initialValues for calculator
  const calcInitialValues =
    selectedCandidate
      ? savedCalc
        ? {
            ectc: Number(savedCalc.ectc),
            contingencyPercentage: Number(savedCalc.contingencyPercentage),
            agencyMarkupPercentage: Number(savedCalc.agencyMarkupPercentage),
            avkalanMarkupPercentage: Number(savedCalc.avkalanMarkupPercentage),
            passThrough: Number(savedCalc.passThrough),
            buyout: Number(savedCalc.buyout),
          }
        : { ectc: Number(selectedCandidate.expectedCtc) || 0 }
      : undefined;

  // Unique key forces re-mount whenever the candidate or saved-calc changes
  const calcKey = selectedCandidate
    ? `${selectedCandidate.id}-${savedCalc ? "saved" : calcLoading ? "loading" : "new"}`
    : "no-candidate";

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calculator size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Margin Calculator</h1>
          <p className="text-slate-500 text-sm mt-1">Calculate staffing cost and billing rates</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => { setMode("rough"); setSelectedCandidate(null); setSaveSuccess(false); }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "rough"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Calculator size={15} />
          Rough Calculation
        </button>
        <button
          onClick={() => setMode("candidate")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "candidate"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <User2 size={15} />
          Candidate Calculation
        </button>
      </div>

      {/* Rough mode */}
      {mode === "rough" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-xs text-slate-400 mb-5 flex items-center gap-1.5">
            <RefreshCw size={12} />
            Data is not saved and will clear when you leave this page.
          </p>
          <MarginCalculator hideSave />
        </div>
      )}

      {/* Candidate mode */}
      {mode === "candidate" && (
        <div className="space-y-4">
          {/* Candidate selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Select Candidate</p>
            <CandidatePicker
              candidates={candidates}
              selected={selectedCandidate}
              onSelect={handleCandidateSelect}
            />

            {selectedCandidate && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {selectedCandidate.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedCandidate.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {selectedCandidate.candidateId}
                    {selectedCandidate.expectedCtc
                      ? ` · Expected CTC: ${formatCurrency(Number(selectedCandidate.expectedCtc))}`
                      : ""}
                  </p>
                </div>
                {savedCalc && (
                  <div className="ml-auto shrink-0">
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                      Saved calc exists
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Calculator — only shown once we know the calc state */}
          {selectedCandidate && !calcLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              {saveSuccess && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 mb-5 text-sm">
                  <CheckCircle2 size={15} />
                  Calculation saved. The candidate's Rate field has been updated.
                </div>
              )}
              <MarginCalculator
                key={calcKey}
                candidateId={selectedCandidate.id}
                initialValues={calcInitialValues}
                onSave={handleSaved}
                saveLabel="Save to Candidate"
              />
            </div>
          )}

          {selectedCandidate && calcLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-center h-32">
              <div className="text-sm text-slate-400">Loading saved calculation…</div>
            </div>
          )}

          {!selectedCandidate && (
            <div className="bg-white rounded-xl border border-slate-200 border-dashed p-10 text-center text-slate-400">
              <User2 size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Select a candidate above to start the calculation.</p>
              <p className="text-xs mt-1 opacity-70">Their Expected CTC will be auto-filled.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
