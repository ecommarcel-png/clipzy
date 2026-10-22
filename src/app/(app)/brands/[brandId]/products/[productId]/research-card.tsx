"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResearchReport } from "@/lib/ai/research";
import { Badge, Button, Card, Notice, Spinner } from "@/components/ui";
import { researchProductAction } from "../actions";

// Market research behind the profile: real customer language, competitors,
// market sophistication, unused angles — with sources the user can open.
export function ResearchCard({ brandId, productId, research }: { brandId: string; productId: string; research: ResearchReport | null }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  function rerun() {
    setMessage(null);
    startTransition(async () => {
      const res = await researchProductAction(brandId, productId);
      if (res.ok) {
        setMessage({ tone: "ok", text: "Research gotowy. Kliknij „Rozbuduj profil”, żeby Claude wykorzystał nowe wnioski." });
        router.refresh();
      } else {
        setMessage({ tone: "danger", text: res.error });
      }
    });
  }

  const date = research?.created_at ? new Date(research.created_at).toLocaleDateString("pl-PL") : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Research rynku</h2>
            {research?.report ? <Badge tone="ok">{research.searches} wyszukiwań · {date}</Badge> : <Badge tone="warn">Brak</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            Claude przeszukał polski internet: jak klienci opisują problem, co obiecuje konkurencja, jakie kąty nikt jeszcze nie zajął.
          </p>
        </div>
        <Button variant="secondary" onClick={rerun} disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Szukam… (1–2 min)" : research?.report ? "Zrób research ponownie" : "Zrób research"}
        </Button>
      </div>

      {research?.error && !research.report ? <div className="mt-3"><Notice tone="warn">{research.error}</Notice></div> : null}
      {message ? <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div> : null}

      {research?.report ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-accent hover:underline">Pokaż raport i źródła</summary>
          <div className="mt-4 space-y-1 text-sm leading-relaxed">
            <MiniMarkdown text={research.report} />
          </div>
          {research.sources.length > 0 ? (
            <div className="mt-5">
              <div className="text-xs font-medium text-muted">Źródła</div>
              <ul className="mt-1.5 space-y-1 text-xs">
                {research.sources.map((s) => (
                  <li key={s.url} className="truncate">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.title || s.url}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </details>
      ) : null}
    </Card>
  );
}

// Just enough Markdown for the report: headings, bullets, bold, paragraphs.
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        if (line.startsWith("## ")) return <h3 key={i} className="pt-3 font-semibold first:pt-0">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="pt-2 font-medium">{line.slice(4)}</h4>;
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted">•</span>
              <span><Inline text={bullet[1]} /></span>
            </div>
          );
        }
        return <p key={i}><Inline text={line} /></p>;
      })}
    </>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}
