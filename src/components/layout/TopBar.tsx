"use client";

import { useState } from "react";
import { Search, X, Menu } from "lucide-react";
import { useMobileNav } from "./MobileNavContext";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { SearchResult } from "@/types";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { setOpen: setMobileNavOpen } = useMobileNav();
  const debouncedQuery = useDebounce(query, 300);

  const { data } = useQuery<SearchResult>({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const hasResults =
    data &&
    (data.candidates.length > 0 || data.roles.length > 0 || data.clients.length > 0);

  return (
    <header className="h-14 border-b border-slate-200/70 bg-white/80 backdrop-blur-md flex items-center px-5 gap-4 shrink-0" style={{ boxShadow: "0 1px 0 rgba(12,10,26,0.05), 0 2px 8px rgba(12,10,26,0.03)" }}>
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-lg">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search candidates, roles, clients…"
          className="pl-9 pr-9 h-9 bg-slate-50/80 border-slate-200/80 focus:border-violet-400 focus:ring-violet-400/20 text-sm"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => { setQuery(""); setOpen(false); }}
          >
            <X size={14} />
          </button>
        )}

        {/* Dropdown results */}
        {open && debouncedQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl z-50 max-h-80 overflow-y-auto" style={{ boxShadow: "0 4px 6px rgba(12,10,26,0.04), 0 12px 40px rgba(12,10,26,0.10)" }}>
            {!hasResults ? (
              <p className="text-sm text-slate-500 p-4 text-center">No results found</p>
            ) : (
              <div>
                {data!.candidates.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase px-3 pt-3 pb-1">Candidates</p>
                    {data!.candidates.map((c) => (
                      <Link
                        key={c.id}
                        href={`/candidates?highlight=${c.id}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setOpen(false); setQuery(""); }}
                      >
                        <span className="text-slate-400 text-xs font-mono">{c.candidateId}</span>
                        <span className="font-medium">{c.fullName}</span>
                        <span className="text-slate-400 text-xs">{c.email}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {data!.roles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase px-3 pt-3 pb-1">Roles</p>
                    {data!.roles.map((r) => (
                      <Link
                        key={r.id}
                        href={`/roles?highlight=${r.id}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setOpen(false); setQuery(""); }}
                      >
                        <span className="text-slate-400 text-xs font-mono">{r.roleId}</span>
                        <span className="font-medium">{r.title}</span>
                        <span className="text-slate-400 text-xs">@ {r.client.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {data!.clients.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase px-3 pt-3 pb-1">Clients</p>
                    {data!.clients.map((c) => (
                      <Link
                        key={c.id}
                        href={`/clients?highlight=${c.id}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setOpen(false); setQuery(""); }}
                      >
                        <span className="text-slate-400 text-xs font-mono">{c.clientId}</span>
                        <span className="font-medium">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
