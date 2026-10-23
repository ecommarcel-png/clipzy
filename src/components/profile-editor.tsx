"use client";

import { useMemo, useState, useTransition } from "react";
import type { FieldDef, FieldSection, Question } from "@/lib/profiles/common";
import type { ControlReport } from "@/lib/ai/control";
import type { BrandProfile } from "@/lib/profiles/brand";
import type { ProductProfile } from "@/lib/profiles/product";
import { brandCompleteness, productCompleteness } from "@/lib/profiles/completeness";
import { plural } from "@/lib/plural";
import { getAt, setAt } from "@/lib/profiles/common";
import { Badge, Button, Card, Chevron, Disclosure, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";

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
  const advanced = props.sections.filter((s) => s.collapsed);
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
        setMessage({ tone: "ok", text: "Profil rozbudowany i sprawdzony." });
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        {main.map((section) => (
          <Card key={section.title}>
            <SectionBody section={section} profile={profile} update={update} />
          </Card>
        ))}
        {advanced.length > 0 ? (
          <Disclosure title="Zaawansowane" meta="uzupełnione automatycznie">
            <div className="divide-y divide-border">
              {advanced.map((section) => (
                <div key={section.title} className="py-3 first:pt-0 last:pb-0">
                  <Disclosure plain title={<span className="text-text">{section.title}</span>}>
                    <SectionBody section={section} profile={profile} update={update} hideTitle />
                  </Disclosure>
                </div>
              ))}
            </div>
          </Disclosure>
        ) : null}
      </div>

      <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-none lg:self-start">
        <Card>
          <div className="flex items-center gap-4">
            <ScoreRing score={completeness.score} />
            <div className="min-w-0">
              <div className="font-extrabold">Gotowość do reklam</div>
              <div className="mt-0.5 text-xs text-muted">
                {completeness.missing.length === 0 ? "Profil jest kompletny." : `Brakuje: ${completeness.missing.join(", ")}.`}
              </div>
            </div>
          </div>
          {summary ? <Expandable text={summary} /> : null}

          <Button className="mt-5 w-full" onClick={() => runSave(true)} disabled={busy !== null}>
            {busy === "finish" ? <Spinner /> : null}
            {props.finishLabel}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={runRefine}
              disabled={busy !== null}
              title="Claude uzupełni braki i dopisze kolejne problemy i kąty, a Kontroler to sprawdzi."
            >
              {busy === "refine" ? <Spinner /> : null}
              {busy === "refine" ? "Pracuję…" : answeredCount > 0 ? "Wyślij odpowiedzi" : "Rozbuduj"}
            </Button>
            <Button variant="secondary" onClick={() => runSave(false)} disabled={busy !== null}>
              {busy === "save" ? <Spinner /> : null}
              Zapisz
            </Button>
          </div>
          {busy === "refine" ? <p className="mt-2 text-xs text-muted">Claude pracuje, a Kontroler sprawdza. Ok. 1–2 minuty.</p> : null}
          {message ? <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
        </Card>

        {questions.length > 0 ? (
          <Disclosure
            title="Doprecyzuj"
            meta={answeredCount > 0 ? `${answeredCount}/${questions.length}` : "opcjonalne"}
          >
            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.id}>
                  <Label htmlFor={`q-${q.id}`}>
                    <span title={q.why}>{q.question}</span>
                  </Label>
                  {q.suggestions.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {q.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: s }))}
                          className={cx(
                            "rounded-full border px-2.5 py-1 text-xs transition",
                            answers[q.id] === s ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:border-border-strong hover:text-text",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Textarea
                    id={`q-${q.id}`}
                    className="min-h-12"
                    rows={2}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Albo napisz własną odpowiedź"
                  />
                </div>
              ))}
            </div>
          </Disclosure>
        ) : null}

        <ControlCard review={review} />
      </aside>
    </div>
  );
}

// The one bold element of the editor: a ring that fills as the profile gets ad-ready.
function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--ok)" : score >= 55 ? "var(--accent)" : "var(--warn)";
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`Gotowość ${score}%`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90 overflow-visible">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{score}%</span>
    </div>
  );
}

function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <div className="mt-4 text-sm text-muted">
      <p className={cx(!open && long && "line-clamp-3")}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-bold text-text hover:text-accent">
          {open ? "Zwiń" : "Rozwiń"}
        </button>
      ) : null}
    </div>
  );
}

type SectionProps = { section: FieldSection; profile: Record<string, unknown>; update: (path: string, value: unknown) => void; hideTitle?: boolean };

function SectionBody({ section, profile, update, hideTitle }: SectionProps) {
  const shown = section.fields.filter((f) => !f.more);
  const more = section.fields.filter((f) => f.more);
  const field = (f: FieldDef) => <FieldInput key={f.path} field={f} value={getAt(profile, f.path)} onChange={(v) => update(f.path, v)} />;

  return (
    <div>
      {hideTitle ? null : <h2 className="text-lg font-extrabold tracking-tight">{section.title}</h2>}
      {section.description ? <p className={cx("text-sm text-faint", !hideTitle && "mt-0.5")}>{section.description}</p> : null}
      <div className={cx(FIELD_GRID, hideTitle && !section.description ? "" : "mt-5")}>{shown.map(field)}</div>
      {more.length > 0 ? (
        <div className="mt-5 border-t border-border pt-3">
          <Disclosure plain title={`Więcej pól (${more.length})`}>
            <div className={FIELD_GRID}>{more.map(field)}</div>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.path}`;
  const span = field.type === "textarea" ? "sm:col-span-6" : field.type === "number" || field.type === "select" ? "sm:col-span-2" : "sm:col-span-3";

  if (field.type === "list") {
    return (
      <div className="sm:col-span-6">
        <ListField id={id} label={field.label} hint={field.hint} items={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
      </div>
    );
  }
  if (field.type === "records") {
    return (
      <div className="sm:col-span-6">
        <RecordsField field={field} rows={Array.isArray(value) ? (value as Array<Record<string, string>>) : []} onChange={onChange} />
      </div>
    );
  }

  let control: React.ReactNode;
  switch (field.type) {
    case "text":
      control = <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "textarea":
      control = <Textarea id={id} rows={3} className="min-h-0" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
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
          <input type="color" aria-label={field.label} value={hex} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent" />
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
  }

  return (
    <div className={span}>
      <Label htmlFor={id} hint={field.hint}>{field.label}</Label>
      {control}
    </div>
  );
}

// Six columns: numbers and selects take a third, short text half, long text the full row.
const FIELD_GRID = "grid grid-cols-1 gap-5 sm:grid-cols-6";

const PREVIEW = 5;

// Read view first (a few items + "Pokaż wszystkie"), textarea only after "Edytuj".
function ListField({ id, label, hint, items, onChange }: { id: string; label: string; hint?: string; items: string[]; onChange: (v: unknown) => void }) {
  const [editing, setEditing] = useState(items.length === 0);
  const [all, setAll] = useState(false);
  const visible = all ? items : items.slice(0, PREVIEW);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-bold">{label}</label>
        {items.length > 0 ? <span className="rounded-full bg-surface-3 px-2 text-xs font-bold text-muted">{items.length}</span> : null}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold text-muted hover:bg-surface-2 hover:text-text"
        >
          {editing ? "Gotowe" : "Edytuj"}
        </button>
      </div>
      {hint && editing ? <p className="mb-1.5 text-xs text-faint">{hint}</p> : null}
      {editing ? (
        <Textarea
          id={id}
          rows={Math.min(12, Math.max(4, items.length + 1))}
          value={items.join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="Jedna pozycja w linii"
        />
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-snug">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {items.length > PREVIEW ? (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-bold text-muted hover:text-text">
              {all ? "Zwiń" : `Pokaż wszystkie (${items.length})`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

type RecordsDef = Extract<FieldDef, { type: "records" }>;

// Each record is one line (title + short subtitle); details open on click.
function RecordsField({ field, rows, onChange }: { field: RecordsDef; rows: Array<Record<string, string>>; onChange: (v: unknown) => void }) {
  const [all, setAll] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const setCell = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const limit = 6;
  const visible = all || rows.length <= limit + 1 ? rows : rows.slice(0, limit);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold">{field.label}</span>
        {rows.length > 0 ? <span className="rounded-full bg-surface-3 px-2 text-xs font-bold text-muted">{rows.length}</span> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {visible.map((row, i) => {
          const title = row[field.keys[0]] || "Bez nazwy";
          const sub = row[field.keys[1]];
          return (
            <details key={i} open={added === i} className="group border-b border-border bg-bg/40 last:border-b-0 open:bg-surface-2/60">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{title}</span>
                  {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
                </span>
                <Chevron className="text-faint group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
                {field.keys.map((key, k) => {
                  const long = (row[key] ?? "").length > 60 || k === field.keys.length - 1;
                  return (
                    <div key={key} className={long ? "sm:col-span-2" : undefined}>
                      <span className="mb-1 block text-xs font-semibold text-muted">{field.labels[k]}</span>
                      {long ? (
                        <Textarea rows={2} className="min-h-0" value={row[key] ?? ""} onChange={(e) => setCell(i, key, e.target.value)} />
                      ) : (
                        <Input value={row[key] ?? ""} onChange={(e) => setCell(i, key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
                <div className="text-right sm:col-span-2">
                  <Button variant="ghost" type="button" className="px-3 py-1 text-xs" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    Usuń
                  </Button>
                </div>
              </div>
            </details>
          );
        })}
        {rows.length === 0 ? <p className="px-4 py-3 text-sm text-faint">Pusto.</p> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="text-xs font-bold text-accent hover:text-accent-strong"
          onClick={() => {
            setAll(true);
            setAdded(rows.length);
            onChange([...rows, Object.fromEntries(field.keys.map((k) => [k, ""]))]);
          }}
        >
          {field.addLabel ?? "+ Dodaj"}
        </button>
        {rows.length > limit + 1 ? (
          <button type="button" onClick={() => setAll(!all)} className="text-xs font-bold text-muted hover:text-text">
            {all ? "Zwiń" : `Pokaż wszystkie (${rows.length})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const SEVERITY_TONE = { krytyczna: "danger", ważna: "warn", drobna: "neutral" } as const;

// Result of the independent Controller check (see knowledge/rezyser/SKILL.md).
function ControlCard({ review }: { review: ControlReport | null }) {
  if (!review) return null;
  const fixedCount = review.rounds >= 2 ? review.first_issues.length : 0;
  const serious = review.remaining.filter((i) => i.severity !== "drobna");
  const badge =
    review.error && review.rounds === 0 ? (
      <Badge tone="warn" dot>Nie wykonano</Badge>
    ) : serious.length === 0 ? (
      <Badge tone="ok" dot>Bez zastrzeżeń</Badge>
    ) : (
      <Badge tone="warn" dot>{serious.length} {plural(serious.length, "uwaga", "uwagi", "uwag")}</Badge>
    );

  return (
    <Disclosure title="Kontrola jakości" meta={badge}>
      <p className="text-sm text-muted">
        Drugi Claude sprawdził, czy z profilu powstaną reklamy, które sprzedają.
        {fixedCount > 0 ? ` Poprawiono ${fixedCount} ${plural(fixedCount, "usterkę", "usterki", "usterek")}.` : ""}
      </p>
      {review.error ? <p className="mt-2 text-xs text-warn">{review.error}</p> : null}
      {review.remaining.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {review.remaining.map((issue, i) => (
            <li key={i} className="rounded-xl border border-border bg-bg/40 p-3 text-sm">
              <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
              <p className="mt-1.5">{issue.problem}</p>
              <p className="mt-1 text-xs text-muted">{issue.fix}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Disclosure>
  );
}
