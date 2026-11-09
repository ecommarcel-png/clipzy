import { requireUser } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { downloadLinks } from "@/lib/files-store";
import { loadJobs, type TextJob } from "@/lib/text-remover/pipeline";
import { Card, PageHeader } from "@/components/ui";
import { TextRemover, type JobView } from "./text-remover";

// Each step (Gemini, fal, ffmpeg) runs as a server action on this page.
export const maxDuration = 300;

export default async function TextRemoverPage() {
  const { supabase, user } = await requireUser();
  let jobs: TextJob[] = [];
  let missing = false;
  try {
    jobs = await loadJobs(supabase);
  } catch {
    missing = true;
  }
  const outs = jobs.filter((j) => j.out_path);
  const [urls, downloads] = await Promise.all([
    signedUrls(supabase, [...outs.map((j) => j.out_path!), ...jobs.map((j) => j.src_path)], 6 * 3600),
    downloadLinks(supabase, outs.map((j) => ({ id: j.id, path: j.out_path!, name: `${j.name.replace(/\.[a-z0-9]+$/i, "")} bez napisow` })), 6 * 3600),
  ]);
  const views: JobView[] = jobs.map((j) => {
    const pieces = j.plan.pieces ?? [];
    return {
      id: j.id, name: j.name, stage: j.stage, error: j.error, createdAt: j.created_at,
      duration: j.info.duration ?? null, pieces: pieces.length, piecesDone: pieces.filter((p) => p.state === "done").length,
      noText: j.stage === "done" && !pieces.length, warning: j.info.warning ?? null, checks: j.plan.checks ?? 0,
      out: j.out_path ? urls[j.out_path] ?? null : null, src: urls[j.src_path] ?? null, download: downloads[j.id] ?? null,
    };
  });
  return (
    <>
      <PageHeader title="Usuwanie napisów" description="Wrzuć filmy z wypalonymi napisami (np. od twórców UGC) — Clipzy wykryje tekst i zamaluje go tłem. Gotowe filmy trafiają do „Twoich plików”." />
      {missing ? (
        <Card className="text-sm text-muted">Uruchom w Supabase migrację <code>0007_text_remover.sql</code> (instrukcja w README), żeby włączyć usuwanie napisów.</Card>
      ) : (
        <TextRemover userId={user.id} jobs={views} />
      )}
    </>
  );
}
