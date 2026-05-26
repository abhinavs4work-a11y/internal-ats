"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BulkUploadResult, BulkUploadRoleResult } from "@/types";
import { Upload, Download, CheckCircle, AlertCircle, Users, Briefcase } from "lucide-react";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

// ─── Column reference data ────────────────────────────────────────────────────

type ColDef = {
  name: string;
  required: boolean;
  description: string;
  values?: string;
  example?: string;
};

const CANDIDATE_COLS: ColDef[] = [
  { name: "candidateName", required: true,  description: "Full name of the candidate",            example: "Rahul Sharma" },
  { name: "email",         required: true,  description: "Email address — used as unique key",    example: "rahul@example.com" },
  { name: "phone",         required: false, description: "Mobile number",                          example: "9999999999" },
  { name: "currentCtc",    required: false, description: "Current annual CTC in ₹ (number only)", example: "1200000" },
  { name: "expectedCtc",   required: false, description: "Expected annual CTC in ₹ (number only)",example: "1500000" },
  { name: "source",        required: false, description: "Candidate source",                       values: "InternalResdex · InternalLinkedIn · Reference · Agency" },
  { name: "recruiter",     required: false, description: "Owner name (partial match ok)",          example: "John" },
  { name: "roleId",        required: false, description: "Role ID to map this candidate to",       example: "TCS-001" },
  { name: "status",        required: false, description: "Initial pipeline status (default: Submitted)", values: "Submitted · R1 · R2 · ClientRound · Selected · Offered · Accepted · Onboarding · Rejected · CandidateWithdrawn" },
  { name: "submissionDate",required: false, description: "Date of submission",                    example: "2025-01-15 (YYYY-MM-DD)" },
  { name: "notes",         required: false, description: "Any additional notes",                   example: "Strong Java background" },
];

const ROLE_COLS: ColDef[] = [
  { name: "title",       required: true,  description: "Job title for the role",                  example: "Senior Java Developer" },
  { name: "clientName",  required: true,  description: "Exact client name (must already exist)",  example: "Tata Consultancy Services" },
  { name: "budget",      required: false, description: "Role budget in ₹ (number only)",           example: "2000000" },
  { name: "openings",    required: false, description: "Number of open positions (default: 1)",   example: "3" },
  { name: "locations",   required: false, description: "Comma-separated work locations",          example: "Bangalore, Mumbai" },
  { name: "priority",    required: false, description: "Priority level (default: Medium)",        values: "High · Medium · Low" },
  { name: "status",      required: false, description: "Role status (default: Active)",           values: "Active · OnHold · Inactive · Closed" },
  { name: "recruiters",  required: false, description: "Comma-separated owner names",             example: "Alice, Bob" },
  { name: "jd",          required: false, description: "Job description text",                    example: "5+ yrs Java, Spring Boot..." },
];

// ─── Template generators ──────────────────────────────────────────────────────

function downloadCandidateTemplate() {
  const csv = Papa.unparse({
    fields: CANDIDATE_COLS.map((c) => c.name),
    data: [
      ["Rahul Sharma", "rahul@example.com", "9999999999", "1200000", "1500000", "InternalLinkedIn", "John", "TCS-001", "Submitted", "2025-01-15", "Good fit"],
      ["Priya Singh",  "priya@example.com",  "8888888888", "800000",  "1000000", "Reference",        "Jane", "INFOSYS-002", "R1",       "",           ""],
    ],
  });
  triggerDownload(csv, "ats_candidates_template.csv");
}

function downloadRoleTemplate() {
  const csv = Papa.unparse({
    fields: ROLE_COLS.map((c) => c.name),
    data: [
      ["Senior Java Developer", "Tata Consultancy Services", "2000000", "3", "Bangalore, Mumbai", "High",   "Active", "Alice",      "5+ yrs Java, Spring Boot"],
      ["React Frontend Engineer","Infosys",                  "",        "1", "Remote",            "Medium", "Active", "Bob, Alice", ""],
    ],
  });
  triggerDownload(csv, "ats_roles_template.csv");
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColumnReference({ cols }: { cols: ColDef[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        Column Reference &nbsp;<span className="text-red-500 font-bold">*</span><span className="text-slate-400 font-normal normal-case tracking-normal"> = required</span>
      </p>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 text-slate-500 font-semibold w-44">Column name</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Description</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold hidden sm:table-cell">Allowed values / example</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((col, idx) => (
              <tr key={col.name} className={cn("border-b border-slate-100 last:border-0", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                <td className="px-3 py-2 align-top">
                  <span className="font-mono text-slate-800 bg-slate-100 rounded px-1.5 py-0.5">
                    {col.name}
                  </span>
                  {col.required && <span className="text-red-500 font-bold ml-1">*</span>}
                </td>
                <td className="px-3 py-2 text-slate-600 align-top">{col.description}</td>
                <td className="px-3 py-2 text-slate-400 align-top hidden sm:table-cell">
                  {col.values
                    ? <span className="text-slate-500">{col.values}</span>
                    : col.example
                    ? <span className="italic">{col.example}</span>
                    : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadZone({
  uploading,
  label,
  onFile,
  fileRef,
}: {
  uploading: boolean;
  label: string;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
      onClick={() => !uploading && fileRef.current?.click()}
    >
      <Upload size={28} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm text-slate-600 mb-3">{label}</p>
      <Button size="sm" variant="outline" disabled={uploading} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
        {uploading ? "Processing…" : "Choose CSV File"}
      </Button>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFile} />
      <p className="text-xs text-slate-400 mt-2">CSV only · Max ~5,000 rows per upload</p>
    </div>
  );
}

function SummaryCards({ counts }: { counts: { label: string; count: number; color: string }[] }) {
  return (
    <div className={cn("grid gap-3", counts.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {counts.map(({ label, count, color }) => (
        <div key={label} className={cn("rounded-lg border p-4 text-center", color)}>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs font-medium mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "candidates" | "roles";

export default function BulkUploadPage() {
  const [tab, setTab] = useState<Tab>("candidates");

  // ── Candidates state ──
  const [candResults,   setCandResults]   = useState<BulkUploadResult[] | null>(null);
  const [candUploading, setCandUploading] = useState(false);
  const [candError,     setCandError]     = useState<string | null>(null);
  const candFileRef = useRef<HTMLInputElement>(null);

  // ── Roles state ──
  const [roleResults,   setRoleResults]   = useState<BulkUploadRoleResult[] | null>(null);
  const [roleUploading, setRoleUploading] = useState(false);
  const [roleError,     setRoleError]     = useState<string | null>(null);
  const roleFileRef = useRef<HTMLInputElement>(null);

  // ── Candidate upload ──
  async function handleCandidateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCandUploading(true); setCandError(null); setCandResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const res  = await fetch("/api/bulk-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsed.data }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
          setCandResults(data.results);
        } catch (err) {
          setCandError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setCandUploading(false);
          if (candFileRef.current) candFileRef.current.value = "";
        }
      },
      error: (err) => { setCandError(err.message); setCandUploading(false); },
    });
  }

  // ── Roles upload ──
  async function handleRoleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRoleUploading(true); setRoleError(null); setRoleResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const res  = await fetch("/api/bulk-upload/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsed.data }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
          setRoleResults(data.results);
        } catch (err) {
          setRoleError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setRoleUploading(false);
          if (roleFileRef.current) roleFileRef.current.value = "";
        }
      },
      error: (err) => { setRoleError(err.message); setRoleUploading(false); },
    });
  }

  // ── Summaries ──
  const candSummary = candResults
    ? {
        success:   candResults.filter((r) => r.status === "success").length,
        duplicate: candResults.filter((r) => r.status === "duplicate").length,
        error:     candResults.filter((r) => r.status === "error").length,
      }
    : null;

  const roleSummary = roleResults
    ? {
        success: roleResults.filter((r) => r.status === "success").length,
        error:   roleResults.filter((r) => r.status === "error").length,
      }
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bulk Upload</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload candidates or roles in bulk from a CSV file
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setTab("candidates")}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "candidates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users size={15} /> Candidates
        </button>
        <button
          onClick={() => setTab("roles")}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "roles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Briefcase size={15} /> Roles
        </button>
      </div>

      {/* ═══════════════ CANDIDATES TAB ═══════════════ */}
      {tab === "candidates" && (
        <div className="space-y-5">
          {/* Column reference */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <ColumnReference cols={CANDIDATE_COLS} />
          </div>

          {/* Download + Upload */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadCandidateTemplate}>
                <Download size={14} /> Download Template
              </Button>
              <span className="text-slate-400 text-sm">fill it and upload below</span>
            </div>
            <UploadZone
              uploading={candUploading}
              label="Upload your filled candidate CSV"
              onFile={handleCandidateFile}
              fileRef={candFileRef}
            />
          </div>

          {/* Error */}
          {candError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} /> {candError}
            </div>
          )}

          {/* Results */}
          {candResults && candSummary && (
            <div className="space-y-4">
              <SummaryCards counts={[
                { label: "Created",    count: candSummary.success,   color: "text-green-700 bg-green-50 border-green-200" },
                { label: "Duplicates", count: candSummary.duplicate, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                { label: "Errors",     count: candSummary.error,     color: "text-red-700 bg-red-50 border-red-200" },
              ]} />
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candResults.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="text-slate-400 text-xs">{r.row}</TableCell>
                        <TableCell className="text-sm">{r.candidateName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-slate-500">{r.email ?? "—"}</TableCell>
                        <TableCell>
                          <ResultBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ROLES TAB ═══════════════ */}
      {tab === "roles" && (
        <div className="space-y-5">
          {/* Info callout */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <CheckCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium">Before uploading roles</p>
              <p className="text-blue-600 text-xs mt-0.5">
                Make sure all clients referenced in <span className="font-mono">clientName</span> already exist in the system.
                Role IDs (e.g. <span className="font-mono">CLIENTNAME-001</span>) are auto-generated — no need to include them.
              </p>
            </div>
          </div>

          {/* Column reference */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <ColumnReference cols={ROLE_COLS} />
          </div>

          {/* Download + Upload */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadRoleTemplate}>
                <Download size={14} /> Download Template
              </Button>
              <span className="text-slate-400 text-sm">fill it and upload below</span>
            </div>
            <UploadZone
              uploading={roleUploading}
              label="Upload your filled roles CSV"
              onFile={handleRoleFile}
              fileRef={roleFileRef}
            />
          </div>

          {/* Error */}
          {roleError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} /> {roleError}
            </div>
          )}

          {/* Results */}
          {roleResults && roleSummary && (
            <div className="space-y-4">
              <SummaryCards counts={[
                { label: "Roles Created", count: roleSummary.success, color: "text-green-700 bg-green-50 border-green-200" },
                { label: "Errors",        count: roleSummary.error,   color: "text-red-700 bg-red-50 border-red-200" },
              ]} />
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Role ID</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleResults.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="text-slate-400 text-xs">{r.row}</TableCell>
                        <TableCell className="text-sm font-medium">{r.roleTitle ?? "—"}</TableCell>
                        <TableCell className="text-sm text-slate-500">{r.clientName ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">{r.roleId ?? "—"}</TableCell>
                        <TableCell>
                          <ResultBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "text-xs px-2 py-0.5 rounded-full font-medium",
      status === "success"   && "bg-green-100 text-green-700",
      status === "duplicate" && "bg-yellow-100 text-yellow-700",
      status === "error"     && "bg-red-100 text-red-700",
    )}>
      {status}
    </span>
  );
}
