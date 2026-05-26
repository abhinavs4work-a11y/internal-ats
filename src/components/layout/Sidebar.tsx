"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  Calculator,
  Upload,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/",                  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/clients",           label: "Clients",      icon: Building2 },
  { href: "/roles",             label: "Roles",        icon: Briefcase },
  { href: "/candidates",        label: "Candidates",   icon: Users },
  { href: "/analytics",         label: "Analytics",    icon: BarChart3 },
  { href: "/margin-calculator", label: "Margin Calc",  icon: Calculator },
  { href: "/bulk-upload",       label: "Bulk Upload",  icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen shrink-0 transition-all duration-300 overflow-hidden",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
      style={{
        background: "linear-gradient(180deg, #0E0B1E 0%, #0A0918 60%, #08080F 100%)",
      }}
    >
      {/* Subtle top-right glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)" }}
      />

      {/* Header / Logo */}
      <div className={cn(
        "relative flex items-center border-b shrink-0 transition-all duration-300",
        collapsed ? "justify-center px-0 py-4" : "justify-between px-4 py-4",
        "border-white/[0.06]"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              A
            </div>
            <div className="min-w-0">
              <p
                className="font-bold text-sm leading-tight truncate"
                style={{
                  background: "linear-gradient(135deg, #E0D7FF, #C4B5FD)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Avkalan ATS
              </p>
              <p className="text-[9px] text-white/30 tracking-widest uppercase leading-tight">
                Recruitment
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            A
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md transition-colors text-white/30 hover:text-white/70 hover:bg-white/8",
            collapsed && "absolute -right-3 top-1/2 -translate-y-1/2 bg-[#1A1730] border border-white/10 w-5 h-5 rounded-full shadow-lg z-10"
          )}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-3 overflow-y-auto overflow-x-hidden", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest px-2 mb-2">
            Navigation
          </p>
        )}
        <div className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 relative",
                  collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2",
                  isActive
                    ? "text-white"
                    : "text-white/40 hover:text-white/80"
                )}
                style={isActive ? {
                  background: "linear-gradient(135deg, rgba(124,58,237,0.35) 0%, rgba(79,70,229,0.25) 100%)",
                  boxShadow: "inset 0 0 0 1px rgba(124,58,237,0.2)",
                } : undefined}
              >
                {/* Active left bar */}
                {isActive && !collapsed && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #A78BFA, #6366F1)" }}
                  />
                )}

                <Icon
                  size={16}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-violet-300" : "text-white/35 group-hover:text-white/60"
                  )}
                />
                {!collapsed && (
                  <span className="truncate leading-none">{label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Footer */}
      <div className={cn("py-3", collapsed ? "px-2" : "px-3")}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "group flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-all duration-150 text-white/30 hover:text-white/70 hover:bg-white/5",
            collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"
          )}
        >
          <LogOut size={16} className="shrink-0 transition-colors" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
