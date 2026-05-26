"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/types";
import { Briefcase, Users, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  description,
  color,
}: {
  title: string;
  value: number | string | null;
  icon: React.ElementType;
  href?: string;
  description?: string;
  color: string;
}) {
  const content = (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4",
      href && "hover:shadow-md transition-shadow cursor-pointer"
    )}>
      <div className={cn("p-3 rounded-lg", color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-900 mt-0.5">
          {value ?? "—"}
        </p>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Recruitment overview at a glance</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Roles"
            value={stats?.activeRoles ?? 0}
            icon={Briefcase}
            href="/roles?status=Active"
            description="Click to view all active roles"
            color="bg-blue-500"
          />
          <StatCard
            title="Active Profiles"
            value={stats?.totalActiveProfiles ?? 0}
            icon={Users}
            description="Candidates in pipeline (excl. rejected)"
            color="bg-emerald-500"
          />
          <StatCard
            title="Avg. Time to Fill"
            value={stats?.avgTimeToFill != null ? `${stats.avgTimeToFill}d` : null}
            icon={Clock}
            description="Days from role opening to first selection"
            color="bg-violet-500"
          />
        </div>
      )}

      {/* Time to fill per role */}
      {stats?.roleWiseTimeToFill && stats.roleWiseTimeToFill.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Time to Fill by Role</h2>
          </div>
          <div className="space-y-3">
            {stats.roleWiseTimeToFill.slice(0, 10).map((r) => (
              <div key={r.roleId} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-mono text-xs text-slate-400">{r.roleId}</span>
                  <p className="text-sm font-medium text-slate-900">{r.roleTitle}</p>
                  <p className="text-xs text-slate-400">{r.clientName}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-900">{r.daysToFill}</span>
                  <p className="text-xs text-slate-400">days</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
