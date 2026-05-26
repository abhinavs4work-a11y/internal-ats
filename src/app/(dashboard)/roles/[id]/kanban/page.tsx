"use client";

import { useQuery } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import type { RoleWithClient } from "@/types";
import { ArrowLeft, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { RoleStatusBadge } from "@/components/shared/StatusBadge";
import { use } from "react";

export default function KanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: role } = useQuery<RoleWithClient>({
    queryKey: ["role", id],
    queryFn: async () => {
      const res = await fetch(`/api/roles/${id}`);
      return res.json();
    },
  });

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/roles" className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <KanbanSquare size={20} className="text-blue-600" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{role?.title ?? "Loading..."}</h1>
              {role && <RoleStatusBadge status={role.status} />}
            </div>
            <p className="text-xs text-slate-400">
              {role?.roleId} · {role?.client?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard roleId={id} />
      </div>
    </div>
  );
}
