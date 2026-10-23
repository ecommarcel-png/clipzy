// Voiceover timeline: cut dead air between phrases and build caption chunks.
// Pure functions (no I/O) so the rules are unit-tested.

export type Word = { text: string; start: number; end: number };

export type Phrase = { text: string; words: Word[]; start: number; end: number };

export type VoSegment = { srcStart: number; srcEnd: number; outStart: number };

export type TightTimeline = {
  segments: VoSegment[];
  phrases: Phrase[]; // times on the output (tightened) timeline
  words: Word[]; // output timeline
  duration: number;
  original: number;
};

export type CaptionChunk = { text: string; start: number; end: number };

const PRE = 0.05;
const POST = 0.07;

function endsSentence(w: string) {
  return /[.!…]["”»)]*$/.test(w);
}

function gapAfter(text: string): number {
  if (/[.!…]["”»)]*$/.test(text)) return 0.2;
  if (/\?["”»)]*$/.test(text)) return 0.12;
  return 0.06; // comma or mid-sentence
}

// Phrases end at punctuation or at a real pause in speech.
export function toPhrases(words: Word[], pauseS = 0.35): Phrase[] {
  const clean = words.filter((w) => w.text.trim() && w.end > w.start).sort((a, b) => a.start - b.start);
  const out: Phrase[] = [];
  let cur: Word[] = [];
  clean.forEach((w, i) => {
    cur.push(w);
    const next = clean[i + 1];
    const punct = /[.,!?;:…]["”»)]*$/.test(w.text);
    if (!next || punct || next.start - w.end >= pauseS) {
      out.push({ words: cur, text: cur.map((x) => x.text.trim()).join(" "), start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [];
    }
  });
  return out;
}

// Remove pauses: each phrase keeps a little air (PRE/POST) and the gap after it
// depends on punctuation. Phrases closer than that stay together (no cut).
export function tighten(words: Word[], total: number): TightTimeline {
  const phrases = toPhrases(words);
  const segments: VoSegment[] = [];
  const outPhrases: Phrase[] = [];
  const outWords: Word[] = [];
  let t = 0;
  let open: { srcStart: number; srcEnd: number; outStart: number } | null = null;

  phrases.forEach((p, i) => {
    const srcStart = Math.max(0, p.start - PRE);
    const srcEnd = Math.min(total, p.end + POST);
    if (open && srcStart <= open.srcEnd) {
      // Natural flow: extend the open segment instead of cutting.
      open.srcEnd = srcEnd;
    } else {
      if (open) {
        segments.push({ ...open });
        t = open.outStart + (open.srcEnd - open.srcStart) + gapAfter(phrases[i - 1].text);
      }
      open = { srcStart, srcEnd, outStart: t };
    }
    const shift = open.outStart - open.srcStart;
    const ws = p.words.map((w) => ({ text: w.text.trim(), start: round(w.start + shift), end: round(w.end + shift) }));
    outWords.push(...ws);
    outPhrases.push({ text: p.text, words: ws, start: ws[0].start, end: ws[ws.length - 1].end });
  });
  if (open) segments.push(open);
  const last = segments[segments.length - 1];
  const duration = last ? round(last.outStart + (last.srcEnd - last.srcStart)) : 0;
  return {
    segments: segments.map((s) => ({ srcStart: round(s.srcStart), srcEnd: round(s.srcEnd), outStart: round(s.outStart) })),
    phrases: outPhrases,
    words: outWords,
    duration,
    original: round(total),
  };
}

function wordCount(p: Phrase) {
  return p.words.length;
}

// Caption chunks for the brand style: whole thoughts of ~3–6 words, never word-by-word.
export function captionChunks(phrases: Phrase[], maxWords = 6, minWords = 3): CaptionChunk[] {
  // 1) merge very short neighbouring phrases ("Wosk?" + "Boli.") when they sit close together
  const merged: Phrase[] = [];
  let pairedPrev = false;
  for (const p of phrases) {
    const prev = merged[merged.length - 1];
    // "Wosk?" + "Boli." — two short bits joined, but never across a finished sentence ("Bez maszynki." | "Maszynka?")
    // a question pairs with its answer, not with another question, and pairs don't chain
    const isQ = (x: string) => /\?["”»)]*$/.test(x);
    const shortPair: boolean =
      !!prev && !pairedPrev && wordCount(prev) < minWords && wordCount(p) < minWords && wordCount(prev) + wordCount(p) <= 4 &&
      !endsSentence(prev.text) && !(isQ(prev.text) && isQ(p.text));
    // "Zacięcia," + "czerwone kropki…" — a short opening of the same sentence joins the rest (split again below if long)
    const sameSentence: boolean = !!prev && !pairedPrev && wordCount(prev) < minWords && !endsSentence(prev.text) && !/\?["”»)]*$/.test(prev.text);
    if (prev && (shortPair || sameSentence) && p.start - prev.end < 0.6) {
      merged[merged.length - 1] = { text: `${prev.text} ${p.text}`, words: [...prev.words, ...p.words], start: prev.start, end: p.end };
      pairedPrev = shortPair && !sameSentence;
    } else {
      merged.push(p);
      pairedPrev = false;
    }
  }
  // 2) split long phrases into balanced chunks of >= minWords
  const chunks: CaptionChunk[] = [];
  for (const p of merged) {
    const n = p.words.length;
    const parts = n <= maxWords ? 1 : Math.ceil(n / maxWords);
    const size = Math.ceil(n / parts);
    // Balanced split (e.g. 7 words -> 4 + 3), so no chunk falls below minWords when n >= minWords.
    for (let i = 0; i < n; i += size) {
      const group = p.words.slice(i, i + size);
      chunks.push({ text: group.map((w) => w.text).join(" "), start: round(group[0].start - 0.04), end: round(group[group.length - 1].end + 0.12) });
    }
  }
  // 3) no flicker: hold each chunk until the next one when the gap is short
  for (let i = 0; i < chunks.length - 1; i++) {
    const gap = chunks[i + 1].start - chunks[i].end;
    if (gap < 0.3) chunks[i].end = chunks[i + 1].start;
  }
  if (chunks.length) chunks[0].start = Math.max(0, chunks[0].start);
  return chunks;
}

export function speechRate(words: Word[]): number {
  if (words.length < 2) return 0;
  const spoken = words.reduce((a, w) => a + (w.end - w.start), 0);
  return spoken > 0 ? words.length / spoken : 0;
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

export { endsSentence };
