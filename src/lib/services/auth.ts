import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cache } from "react";

// Deduplicated per-request — multiple route handlers calling this in the same
// render pass share one Supabase round-trip and one DB lookup.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });

  return dbUser;
});

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
