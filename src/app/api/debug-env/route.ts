import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return NextResponse.json({
    url_present: !!url,
    url_length: url.length,
    url_starts_with_https: url.startsWith("https://"),
    url_has_trailing_slash: url.endsWith("/"),
    url_preview: url ? url.slice(0, 30) + "..." : "(empty)",
    anon_present: !!anon,
    anon_length: anon.length,
  });
}
