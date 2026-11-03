"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteFile, renameFile } from "@/lib/files-store";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function renameFileAction(id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  if (!isUuid(id)) return { ok: false, error: "Nie znaleziono pliku." };
  const r = await renameFile(supabase, id, name);
  if (r.ok) revalidatePath("/files");
  return r;
}

export async function deleteFileAction(form: FormData) {
  const { supabase } = await requireUser();
  const id = String(form.get("fileId") ?? "");
  if (!isUuid(id)) return;
  await deleteFile(supabase, id);
  revalidatePath("/files");
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/clips/")) revalidatePath(back);
}
