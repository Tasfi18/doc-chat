import type { DocChunk } from "./types";

const STOPWORDS = new Set(
  (
    "a an and are as at be but by can could do does for from had has have how i if in into is it its " +
    "me my of on or our so that the their them then there these they this to us was we were what when " +
    "where which who why will with would you your yours about after again all also am any because been " +
    "before being between both did each few more most no nor not only other own same should some such " +
    "than too very just over under up down out off once here"
  ).split(" "),
);

/** Light stemming so "returns", "returned" and "returning" match "return". */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ied")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es") && /(ss|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

export interface Hit {
  chunk: DocChunk;
  score: number;
}

/**
 * Rank chunks against a query with BM25, the standard keyword-ranking formula
 * used by search engines. It needs no extra API or model, so search is free
 * and runs offline; only the final answer calls Claude.
 */
export function search(chunks: DocChunk[], query: string, k = 5, minScore = 0.5): Hit[] {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0 || chunks.length === 0) return [];

  const k1 = 1.5;
  const b = 0.75;
  const docs = chunks.map((c) => tokenize(c.text));
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;

  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);

  const N = docs.length;
  const hits: Hit[] = [];
  docs.forEach((terms, i) => {
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const q of qTerms) {
      const f = tf.get(q);
      if (!f) continue;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * terms.length) / avgLen)));
    }
    if (score >= minScore) hits.push({ chunk: chunks[i], score });
  });

  return hits.sort((x, y) => y.score - x.score).slice(0, k);
}
