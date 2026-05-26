"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/utils";
import type { ActivityLogWithUser, EntityType } from "@/types";
import { Clock } from "lucide-react";

interface Props {
  entityType: EntityType;
  entityId: string;
}

export function ActivityTimeline({ entityType, entityId }: Props) {
  const { data: logs, isLoading } = useQuery<ActivityLogWithUser[]>({
    queryKey: ["activity", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/activity/${entityType}/${entityId}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Clock size={24} className="mx-auto mb-2" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-600">
                {log.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            </div>
            {i < logs.length - 1 && (
              <div className="w-px flex-1 bg-slate-200 mt-1" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-sm text-slate-900">{log.description}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {log.user?.name ?? "System"} · {formatDateTime(log.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
