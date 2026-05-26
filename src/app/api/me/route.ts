import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  return NextResponse.json(user);
}
