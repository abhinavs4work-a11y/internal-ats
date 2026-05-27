"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(258 88% 42%) 0%, hsl(265 85% 57%) 50%, hsl(280 72% 62%) 100%)",
      }}
    >
      {/* ── Background doodles — kept to edges/corners, clear center ────── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1280 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* corner blobs */}
        <path d="M-80 580 Q80 420 140 540 Q200 660 40 760 Q-120 840 -80 580Z"
          fill="rgba(255,255,255,0.09)" />
        <path d="M1140 -60 Q1300 60 1260 200 Q1200 360 1060 260 Q900 140 1000 20 Q1060 -80 1140 -60Z"
          fill="rgba(255,255,255,0.08)" />
        <path d="M1080 620 Q1220 520 1300 600 Q1360 680 1280 760 Q1160 840 1080 760 Q960 680 1080 620Z"
          fill="rgba(255,255,255,0.07)" />
        <path d="M180 -50 Q320 10 280 110 Q220 230 100 170 Q-40 90 40 10 Q100 -60 180 -50Z"
          fill="rgba(255,255,255,0.07)" />

        {/* top-left corner details */}
        <text x="52"  y="72"  fill="rgba(255,255,255,0.45)" fontSize="26" fontWeight="200">+</text>
        <circle cx="100" cy="160" r="12" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.8"/>

        {/* bottom-left corner details */}
        <circle cx="72"  cy="700" r="22" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2"/>
        <text x="170" y="730" fill="rgba(255,255,255,0.35)" fontSize="22" fontWeight="200">+</text>
        {/* resume doodle — bottom left */}
        <g transform="translate(60,520)" opacity="0.18">
          <rect x="0" y="0" width="48" height="62" rx="4" fill="none" stroke="white" strokeWidth="1.8"/>
          <line x1="9" y1="18" x2="39" y2="18" stroke="white" strokeWidth="1.8"/>
          <line x1="9" y1="28" x2="39" y2="28" stroke="white" strokeWidth="1.8"/>
          <line x1="9" y1="38" x2="30" y2="38" stroke="white" strokeWidth="1.8"/>
          <polyline points="33,0 48,15" fill="none" stroke="white" strokeWidth="1.8"/>
        </g>

        {/* top-right corner details */}
        <text x="1190" y="80"  fill="rgba(255,255,255,0.32)" fontSize="22" fontWeight="200">+</text>
        {[0,1,2,3].map(col => [0,1,2,3,4].map(row => (
          <circle key={`tr-${col}-${row}`}
            cx={1140 + col * 20} cy={100 + row * 20}
            r="2.5" fill="rgba(255,255,255,0.28)" />
        )))}
        {/* kanban doodle — top right */}
        <g transform="translate(1180,200)" opacity="0.17">
          <rect x="0"  y="0" width="16" height="50" rx="3" fill="none" stroke="white" strokeWidth="1.8"/>
          <rect x="24" y="0" width="16" height="34" rx="3" fill="none" stroke="white" strokeWidth="1.8"/>
          <rect x="48" y="0" width="16" height="60" rx="3" fill="none" stroke="white" strokeWidth="1.8"/>
        </g>

        {/* bottom-right corner */}
        <circle cx="1220" cy="680" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8"/>
        {[0,1,2,3].map(col => [0,1,2,3].map(row => (
          <circle key={`br-${col}-${row}`}
            cx={1080 + col * 20} cy={680 + row * 20}
            r="2" fill="rgba(255,255,255,0.22)" />
        )))}

        {/* subtle waves along the very bottom */}
        <path d="M0 760 Q160 720 320 760 Q480 800 640 760 Q800 720 960 760 Q1120 800 1280 760"
          fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"/>

        {/* person doodle — far left mid */}
        <g transform="translate(30,340)" opacity="0.17">
          <circle cx="20" cy="12" r="11" fill="none" stroke="white" strokeWidth="1.8"/>
          <path d="M0 50 Q5 30 20 30 Q35 30 40 50" fill="none" stroke="white" strokeWidth="1.8"/>
        </g>

        {/* checkmark — far right mid */}
        <g transform="translate(1220,360)" opacity="0.16">
          <circle cx="20" cy="20" r="18" fill="none" stroke="white" strokeWidth="1.8"/>
          <polyline points="10,20 17,28 30,12" fill="none" stroke="white" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </g>
      </svg>

      {/* ── Centred two-column content ───────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl flex items-center gap-16 lg:gap-24">

        {/* Left: welcome text — clear of doodles, text shadow for legibility */}
        <div className="flex-1 hidden md:block">
          <p
            className="text-white/70 text-xs font-bold tracking-[0.2em] uppercase mb-4"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.35)" }}
          >
            Avkalan ATS
          </p>
          <h1
            className="text-white text-4xl lg:text-5xl font-bold leading-tight mb-5"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.35)" }}
          >
            Welcome back!
          </h1>
          <p
            className="text-white/80 text-base lg:text-lg leading-relaxed"
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.30)" }}
          >
            Your talent pipeline,<br />managed in one place.
          </p>
        </div>

        {/* Right: floating sign-in card */}
        <div
          className="w-full md:w-[420px] flex-none rounded-2xl p-8 lg:p-10"
          style={{
            background: "rgba(255,255,255,0.97)",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.30), 0 6px 20px rgba(0,0,0,0.14)",
          }}
        >
          {/* Brand mark */}
          <div className="mb-7">
            <img src="/avkalan-logo.svg" alt="Avkalan" className="h-9 w-auto" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1">Sign In</h2>
          <p className="text-slate-500 text-sm mb-7">Access your Avkalan ATS account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4Z"/>
                </svg>
              </span>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-10 h-12 rounded-full border-slate-200 bg-slate-50 focus:bg-white text-sm"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1Zm0 1.5A2 2 0 0 1 10 4.5V6H6V4.5A2 2 0 0 1 8 2.5Z"/>
                </svg>
              </span>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-10 h-12 rounded-full border-slate-200 bg-slate-50 focus:bg-white text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-medium hover:underline"
                style={{ color: "hsl(258 88% 59%)" }}
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "hsl(258 88% 59%)", color: "white" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
