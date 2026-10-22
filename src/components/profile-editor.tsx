"use client";

import { useMemo, useState, useTransition } from "react";
import type { FieldDef, FieldSection, Question } from "@/lib/profiles/common";
import type { ControlReport } from "@/lib/ai/control";
import type { BrandProfile } from "@/lib/profiles/brand";
import type { ProductProfile } from "@/lib/profiles/product";
import { brandCompleteness, productCompleteness } from "@/lib/profiles/completeness";
import { plural } from "@/lib/plural";
import { getAt, setAt } from "@/lib/profiles/common";
import { Badge, Button, Card, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";

export type RefineResult =
  | { ok: true; profile: Record<string, unknown>; questions: Question[]; summary: string; review: ControlReport | null }
  | { ok: false; error: string };

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

type Props = {
  kind: "brand" | "product";
  sections: FieldSection[];
  initialProfile: Record<string, unknown>;
  initialQuestions: Question[];
  initialSummary: string;
  initialReview: ControlReport | null;
  refine: (profile: Record<string, unknown>, answers: Array<Question & { answer: string }>) => Promise<RefineResult>;
  save: (profile: Record<string, unknown>, finish: boolean) => Promise<SaveResult>;
  finishLabel: string;
};

export function ProfileEditor(props: Props) {
  const [profile, setProfile] = useState(props.initialProfile);
  const [questions, setQuestions] = useState(props.initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState(props.initialSummary);
  const [review, setReview] = useState(props.initialReview);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<"refine" | "save" | "finish" | null>(null);
  const [, startTransition] = useTransition();

  // Recomputed live as the user edits — the same rule the server stores.
  const completeness = useMemo(
    () =>
      props.kind === "brand"
        ? brandCompleteness(profile as unknown as BrandProfile)
        : productCompleteness(profile as unknown as ProductProfile),
    [profile, props.kind],
  );

  const update = (path: string, value: unknown) => setProfile((p) => setAt(p, path, value));
  const main = props.sections.filter((s) => !s.collapsed);
  const more = props.sections.filter((s) => s.collapsed);
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  function runRefine() {
    setBusy("refine");
    setMessage(null);
    startTransition(async () => {
      const res = await props.refine(
        profile,
        questions.map((q) => ({ ...q, answer: answers[q.id] ?? "" })),
      );
      if (res.ok) {
        setProfile(res.profile);
        setQuestions(res.questions);
        setAnswers({});
        setSummary(res.summary);
        setReview(res.review);
        setMessage({ tone: "ok", text: "Profil zaktualizowany i sprawdzony." });
      } else {
        setMessage({ tone: "danger", text: res.error });
      }
      setBusy(null);
    });
  }

  function runSave(finish: boolean) {
    setBusy(finish ? "finish" : "save");
    setMessage(null);
    startTransition(async () => {
      const res = await props.save(profile, finish);
      setMessage(res.ok ? { tone: "ok", text: res.message } : { tone: "danger", text: res.error });
      setBusy(null);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {main.map((section) => (
          <SectionCard key={section.title} section={section} profile={profile} update={update} />
        ))}
        {more.length > 0 ? (
          <details className="group rounded-2xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-semibold">
              <span>
                Więcej szczegółów
                <span className="ml-2 text-sm font-normal text-muted">uzupełnione automatycznie — zwykle nie trzeba nic zmieniać</span>
              </span>
              <span className="text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <div className="space-y-6 px-6 pb-6">
              {more.map((section) => (
                <SectionBody key={section.title} section={section} profile={profile} update={update} />
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-none lg:self-start">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Gotowość do reklam</span>
            <Badge tone={completeness.score >= 85 ? "ok" : completeness.score >= 55 ? "warn" : "danger"}>{completeness.score}%</Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness.score}%` }} />
          </div>
          {summary ? <p className="mt-3 text-sm text-muted">{summary}</p> : null}
          {completeness.missing.length > 0 ? (
            <p className="mt-2 text-xs text-muted">Brakuje: {completeness.missing.join(", ")}. Kliknij „Rozbuduj profil” — Claude uzupełni to sam.</p>
          ) : null}

          <Button className="mt-4 w-full" onClick={() => runSave(true)} disabled={busy !== null}>
            {busy === "finish" ? <Spinner /> : null}
            {props.finishLabel}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={runRefine} disabled={busy !== null}>
              {busy === "refine" ? <Spinner /> : null}
              {busy === "refine" ? "Pracuję…" : answeredCount > 0 ? "Wyślij odpowiedzi" : "Rozbuduj profil"}
            </Button>
            <Button variant="secondary" onClick={() => runSave(false)} disabled={busy !== null}>
              {busy === "save" ? <Spinner /> : null}
              Zapisz
            </Button>
          </div>
          {busy === "refine" ? <p className="mt-2 text-xs text-muted">Claude rozbudowuje profil, a Kontroler go sprawdza. To trwa ok. 1–2 minuty.</p> : null}
          {message ? <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
        </Card>

        {questions.length > 0 ? (
          <Card>
            <h2 className="font-semibold">Doprecyzuj (opcjonalnie)</h2>
            <p className="mt-1 text-xs text-muted">Możesz pominąć — profil działa i bez odpowiedzi.</p>
            <div className="mt-4 space-y-5">
              {questions.map((q) => (
                <div key={q.id}>
                  <Label htmlFor={`q-${q.id}`} hint={q.why}>{q.question}</Label>
                  {q.suggestions.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {q.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: s }))}
                          className={cx(
                            "rounded-full border px-2.5 py-1 text-xs transition",
                            answers[q.id] === s ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Textarea
                    id={`q-${q.id}`}
                    className="min-h-14"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Twoja odpowiedź…"
                  />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <ControlCard review={review} />
      </aside>
    </div>
  );
}

type SectionProps = { section: FieldSection; profile: Record<string, unknown>; update: (path: string, value: unknown) => void };

function SectionCard(props: SectionProps) {
  return (
    <Card>
      <SectionBody {...props} />
    </Card>
  );
}

function SectionBody({ section, profile, update }: SectionProps) {
  return (
    <div>
      <h2 className="font-semibold">{section.title}</h2>
      {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {section.fields.map((field) => (
          <FieldInput key={field.path} field={field} value={getAt(profile, field.path)} onChange={(v) => update(field.path, v)} />
        ))}
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.path}`;
  const wide = field.type === "textarea" || field.type === "list" || field.type === "records";

  let control: React.ReactNode;
  switch (field.type) {
    case "text":
      control = <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "textarea":
      control = <Textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = (
        <Input id={id} type="number" value={Number.isFinite(value as number) ? String(value) : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      );
      break;
    case "color": {
      const hex = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
      control = (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={field.label} value={hex} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-surface" />
          <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="font-mono" />
        </div>
      );
      break;
    }
    case "select":
      control = (
        <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      );
      break;
    case "boolean":
      control = (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Tak
        </label>
      );
      break;
    case "list": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <Textarea
          id={id}
          rows={Math.min(12, Math.max(4, items.length + 1))}
          value={items.join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="Jedna pozycja w linii"
        />
      );
      break;
    }
    case "records": {
      const rows = Array.isArray(value) ? (value as Array<Record<string, string>>) : [];
      const setCell = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
      control = (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {field.keys.map((key, k) => {
                  const long = (row[key] ?? "").length > 60 || k === field.keys.length - 1;
                  return (
                    <div key={key} className={long ? "sm:col-span-2" : undefined}>
                      <span className="mb-1 block text-xs text-muted">{field.labels[k]}</span>
                      {long ? (
                        <Textarea className="min-h-14" value={row[key] ?? ""} onChange={(e) => setCell(i, key, e.target.value)} />
                      ) : (
                        <Input value={row[key] ?? ""} onChange={(e) => setCell(i, key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-right">
                <Button variant="ghost" type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Usuń</Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" type="button" onClick={() => onChange([...rows, Object.fromEntries(field.keys.map((k) => [k, ""]))])}>
            {field.addLabel ?? "+ Dodaj"}
          </Button>
        </div>
      );
      break;
    }
  }

  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label htmlFor={id} hint={field.hint}>{field.label}</Label>
      {control}
    </div>
  );
}

const SEVERITY_TONE = { krytyczna: "danger", ważna: "warn", drobna: "neutral" } as const;

// Result of the independent Controller check (see knowledge/rezyser/SKILL.md).
function ControlCard({ review }: { review: ControlReport | null }) {
  if (!review) return null;
  const fixedCount = review.rounds >= 2 ? review.first_issues.length : 0;
  const serious = review.remaining.filter((i) => i.severity !== "drobna");
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Kontrola jakości</h2>
        {review.error && review.rounds === 0 ? (
          <Badge tone="warn">Nie wykonano</Badge>
        ) : serious.length === 0 ? (
          <Badge tone="ok">Bez zastrzeżeń</Badge>
        ) : (
          <Badge tone="warn">{serious.length} {plural(serious.length, "uwaga", "uwagi", "uwag")}</Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Niezależny Kontroler sprawdził, czy z profilu powstaną reklamy, które sprzedają.
        {fixedCount > 0 ? ` Znalazł ${fixedCount} ${plural(fixedCount, "usterkę", "usterki", "usterek")} — Claude ${fixedCount === 1 ? "ją" : "je"} poprawił, a Kontroler sprawdził ponownie.` : ""}
      </p>
      {review.error ? <p className="mt-2 text-xs text-warn">{review.error}</p> : null}
      {review.remaining.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted hover:text-text">Pokaż uwagi ({review.remaining.length})</summary>
          <ul className="mt-2 space-y-2">
            {review.remaining.map((issue, i) => (
              <li key={i} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
                  <span className="font-mono text-xs text-muted">{issue.field}</span>
                </div>
                <p className="mt-1.5">{issue.problem}</p>
                <p className="mt-1 text-xs text-muted">Poprawka: {issue.fix}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
