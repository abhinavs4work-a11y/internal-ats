import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/services/auth";
import { logActivity } from "@/lib/services/mappings";
import { ActionType, EntityType } from "@prisma/client";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("resume") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream", // .doc on some Windows browsers reports this
  ];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = ["pdf", "doc", "docx"];
  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    return NextResponse.json({ error: "Only PDF, DOC, DOCX files are allowed" }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Ensure the bucket exists and is public
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "resumes");
  if (!bucketExists) {
    const { error: bucketError } = await supabase.storage.createBucket("resumes", { public: true, fileSizeLimit: 10485760 });
    if (bucketError && !bucketError.message.includes("already exists")) {
      return NextResponse.json({ error: `Storage setup failed: ${bucketError.message}` }, { status: 500 });
    }
  }

  const path = `${candidate.candidateId}/${Date.now()}.${ext}`;

  // Delete old resume if exists
  if (candidate.resumeUrl) {
    const oldPath = candidate.resumeUrl.split("/resumes/")[1];
    if (oldPath) await supabase.storage.from("resumes").remove([oldPath]);
  }

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(path);

  const updated = await prisma.candidate.update({
    where: { id },
    data: { resumeUrl: publicUrl, resumeFileName: file.name },
  });

  await logActivity({
    userId: user.id,
    entityType: EntityType.Candidate,
    entityId: id,
    actionType: ActionType.Updated,
    newValue: { resumeFileName: file.name },
    description: `Resume uploaded for ${candidate.candidateId}`,
  });

  return NextResponse.json({ resumeUrl: updated.resumeUrl, resumeFileName: updated.resumeFileName });
}
