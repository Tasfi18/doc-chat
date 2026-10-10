/**
 * A simple per-visitor daily question limit, so one person cannot run up the
 * AI bill. Counts live in memory and reset at midnight UTC or on restart.
 */
const LIMIT = Number(process.env.DAILY_QUESTION_LIMIT ?? 30);

const g = globalThis as unknown as { __rate?: Map<string, { day: string; count: number }> };
const counts = (g.__rate ??= new Map());

export function checkLimit(visitor: string): { allowed: boolean; remaining: number; limit: number } {
  const day = new Date().toISOString().slice(0, 10);
  const entry = counts.get(visitor);
  const used = entry && entry.day === day ? entry.count : 0;
  if (used >= LIMIT) return { allowed: false, remaining: 0, limit: LIMIT };
  counts.set(visitor, { day, count: used + 1 });
  return { allowed: true, remaining: LIMIT - used - 1, limit: LIMIT };
}
