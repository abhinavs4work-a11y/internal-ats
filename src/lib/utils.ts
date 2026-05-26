import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a raw number string as Indian comma-separated (e.g. 1150000 → "11,50,000") */
export function toIndianFormat(raw: string): string {
  const digits = raw.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-IN");
}

/** Strip Indian commas to get a plain numeric string for the API */
export function fromIndianFormat(formatted: string): string {
  return formatted.replace(/,/g, "");
}

export function generateClientId(sequence: number): string {
  return `CLIENT-${String(sequence).padStart(3, "0")}`;
}

export function generateCandidateId(sequence: number): string {
  return `CAN-${String(sequence).padStart(5, "0")}`;
}

/** Derive a short readable code from a client name, e.g. "Infosys" → "INFS", "Danske" → "DNSK" */
function clientShorthand(name: string): string {
  // Handle compound names like "Infosys/HSBC"
  if (name.includes("/")) {
    return name.split("/").map((p) => clientShorthand(p.trim())).join("/");
  }
  const words = name.trim().toUpperCase().split(/\s+/);
  if (words.length === 1) {
    const word = words[0];
    if (word.length <= 4) return word;
    // First letter always kept; strip vowels from the rest; truncate to 4
    const rest = word.slice(1).replace(/[AEIOU]/g, "");
    return (word[0] + rest).slice(0, 4);
  }
  // Multi-word: 3 chars per word (2 words) or 2 chars per word (3+ words), max 6 total
  const take = words.length === 2 ? 3 : 2;
  return words.map((w) => w.slice(0, take)).join("").slice(0, 6);
}

/** Generate a role ID like "INFS-01", "DNSK-03", "INFS/HSBC-02" (max 12 chars) */
export function generateRoleId(clientName: string, sequence: number): string {
  const shorthand = clientShorthand(clientName);
  const seq = String(sequence).padStart(2, "0");
  return `${shorthand}-${seq}`.slice(0, 12);
}
