"use client";

import { useState, useTransition } from "react";
import type { FieldDef, FieldSection, Question } from "@/lib/profiles/common";
import { getAt, setAt } from "@/lib/profiles/common";
import { Badge, Button, Card, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";

export type RefineResult =
  | { ok: true; profile: Record<string, unknown>; questions: Question[]; completeness: number; summary: string }
  | { ok: false; error: string };

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

type Props = {
  sections: FieldSection[];
  initialProfile: Record<string, unknown>;
  initialQuestions: Question[];
  initialCompleteness: number;
  initialSummary: string;
  refine: (profile: Record<string, unknown>, answers: Array<Question & { answer: string }>) => Promise<RefineResult>;
  save: (profile: Record<string, unknown>, finish: boolean) => Promise<SaveResult>;
  finishLabel: string;
};

export function ProfileEditor(props: Props) {
  const [profile, setProfile] = useState(props.initialProfile);
  const [questions, setQuestions] = useState(props.initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completeness, setCompleteness] = useState(props.initialCompleteness);
  const [summary, setSummary] = useState(props.initialSummary);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<"refine" | "save" | "finish" | null>(null);
  const [, startTransition] = useTransition();

  const update = (path: string, value: unknown) => setProfile((p) => setAt(p, path, value));

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
        setCompleteness(res.completeness);
        setSummary(res.summary);
        setMessage({ tone: "ok", text: res.questions.length ? "Profil zaktualizowany. Claude ma kolejne pytania." : "Profil zaktualizowany. Claude nie ma więcej pytań." });
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

  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {props.sections.map((section) => (
          <Card key={section.title}>
            <h2 className="font-semibold">{section.title}</h2>
            {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {section.fields.map((field) => (
                <FieldInput key={field.path} field={field} value={getAt(profile, field.path)} onChange={(v) => update(field.path, v)} />
              ))}
            </div>
          </Card>
        ))}
      </div>

      <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-none lg:self-start">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Kompletność profilu</span>
            <Badge tone={completeness >= 90 ? "ok" : completeness >= 60 ? "warn" : "danger"}>{completeness}%</Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness}%` }} />
          </div>
          {summary ? <p className="mt-3 text-sm text-muted">{summary}</p> : null}
        </Card>

        <Card>
          <h2 className="font-semibold">Pytania od Claude</h2>
          {questions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Brak otwartych pytań. Możesz poprawić pola ręcznie albo poprosić o ponowne sprawdzenie profilu.</p>
          ) : (
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
                    className="min-h-16"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Twoja odpowiedź…"
                  />
                </div>
              ))}
            </div>
          )}

          <Button className="mt-5 w-full" onClick={runRefine} disabled={busy !== null}>
            {busy === "refine" ? <Spinner /> : null}
            {busy === "refine" ? "Claude analizuje…" : questions.length ? `Wyślij odpowiedzi (${answeredCount}/${questions.length})` : "Sprawdź profil ponownie"}
          </Button>
          <p className="mt-2 text-xs text-muted">Claude uwzględni też Twoje ręczne zmiany w polach.</p>
        </Card>

        <Card className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => runSave(false)} disabled={busy !== null}>
            {busy === "save" ? <Spinner /> : null}
            Zapisz zmiany
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => runSave(true)} disabled={busy !== null}>
            {busy === "finish" ? <Spinner /> : null}
            {props.finishLabel}
          </Button>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </Card>
      </aside>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.path}`;
  const wide = field.type === "textarea" || field.type === "list" || field.type === "pairs";

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
          value={items.join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="Jedna pozycja w linii"
        />
      );
      break;
    }
    case "pairs": {
      const rows = Array.isArray(value) ? (value as Array<Record<string, string>>) : [];
      const [k1, k2] = field.keys;
      control = (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label={field.labels[0]} placeholder={field.labels[0]} value={row[k1] ?? ""} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [k1]: e.target.value } : r)))} />
              <Input aria-label={field.labels[1]} placeholder={field.labels[1]} value={row[k2] ?? ""} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [k2]: e.target.value } : r)))} />
              <Button variant="ghost" type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Usuń</Button>
            </div>
          ))}
          <Button variant="secondary" type="button" onClick={() => onChange([...rows, { [k1]: "", [k2]: "" }])}>+ Dodaj</Button>
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
