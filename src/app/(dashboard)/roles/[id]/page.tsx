import { redirect } from "next/navigation";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/roles/${id}/kanban`);
}
