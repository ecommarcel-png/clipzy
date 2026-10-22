import type { Review, ReviewIssue } from "./review";

// Draft → independent review → one correction round → final review.
// Kept free of I/O so the loop itself can be unit-tested.

export type ControlReport = {
  checked_at: string;
  rounds: number;
  first_issues: ReviewIssue[];
  remaining: ReviewIssue[];
  checked: string[];
  error?: string;
};

const SERIOUS = new Set<ReviewIssue["severity"]>(["krytyczna", "ważna"]);

export function seriousIssues(issues: ReviewIssue[]) {
  return issues.filter((i) => SERIOUS.has(i.severity));
}

export async function controlLoop<T>(opts: {
  draft: T;
  review: (draft: T) => Promise<Review>;
  revise: (draft: T, issues: ReviewIssue[]) => Promise<T>;
  /** Skip the correction round when the time budget is nearly spent. */
  canRevise?: () => boolean;
  /** Skip the final re-check when the time budget is nearly spent. */
  hasTimeFor?: () => boolean;
  now?: () => Date;
}): Promise<{ result: T; report: ControlReport }> {
  const now = opts.now ?? (() => new Date());
  const hasTime = opts.hasTimeFor ?? (() => true);
  const canRevise = opts.canRevise ?? (() => true);

  let first: Review;
  try {
    first = await opts.review(opts.draft);
  } catch (e) {
    // A failed review must not lose the user's work.
    return {
      result: opts.draft,
      report: { checked_at: now().toISOString(), rounds: 0, first_issues: [], remaining: [], checked: [], error: errorText(e) },
    };
  }

  const toFix = first.issues;
  if (seriousIssues(toFix).length === 0) {
    return {
      result: opts.draft,
      report: { checked_at: now().toISOString(), rounds: 1, first_issues: toFix, remaining: toFix, checked: first.checked },
    };
  }

  if (!canRevise()) {
    return {
      result: opts.draft,
      report: {
        checked_at: now().toISOString(),
        rounds: 1,
        first_issues: toFix,
        remaining: toFix,
        checked: first.checked,
        error: "Zabrakło czasu na poprawki — kliknij „Rozbuduj profil”, a Claude je wprowadzi.",
      },
    };
  }

  let revised: T;
  try {
    revised = await opts.revise(opts.draft, toFix);
  } catch (e) {
    return {
      result: opts.draft,
      report: { checked_at: now().toISOString(), rounds: 1, first_issues: toFix, remaining: toFix, checked: first.checked, error: errorText(e) },
    };
  }

  if (!hasTime()) {
    return {
      result: revised,
      report: {
        checked_at: now().toISOString(),
        rounds: 1,
        first_issues: toFix,
        remaining: [],
        checked: first.checked,
        error: "Poprawki wprowadzone, ale zabrakło czasu na ponowną kontrolę — kliknij „Sprawdź profil ponownie”.",
      },
    };
  }

  try {
    const second = await opts.review(revised);
    return {
      result: revised,
      report: { checked_at: now().toISOString(), rounds: 2, first_issues: toFix, remaining: second.issues, checked: second.checked },
    };
  } catch (e) {
    return {
      result: revised,
      report: { checked_at: now().toISOString(), rounds: 1, first_issues: toFix, remaining: [], checked: first.checked, error: errorText(e) },
    };
  }
}

function errorText(e: unknown) {
  return `Kontrola nie powiodła się: ${e instanceof Error ? e.message : "nieznany błąd"}`;
}
