import Anthropic from "@anthropic-ai/sdk";
import { tokenize, type Hit } from "./search";
import type { ChatResponse, ChatTurn, Source } from "./types";

export const NOT_FOUND_TOKEN = "NOT_FOUND";

export const NOT_FOUND_REPLY =
  process.env.NOT_FOUND_REPLY ??
  "I couldn't find that in the documents. Please contact support and they'll help you.";

export const SYSTEM_PROMPT = `You are a help assistant for a business. You answer customer questions using ONLY the numbered passages you are given from the business's own documents.

Rules:
- Use only facts stated in the passages. Do not add outside knowledge or guess.
- After each sentence that uses a passage, cite it with its number in square brackets, like [1] or [2][3].
- If the passages do not contain the answer, reply with exactly ${NOT_FOUND_TOKEN} and nothing else.
- Keep answers short, plain and friendly: one to four sentences, unless the user asks for detail.`;

/** Turn search hits into the numbered context block sent to Claude. */
export function buildContext(hits: Hit[]): string {
  return hits
    .map((h, i) => {
      const where = h.chunk.page ? `${h.chunk.docName}, page ${h.chunk.page}` : h.chunk.docName;
      return `[${i + 1}] (${where})\n${h.chunk.text}`;
    })
    .join("\n\n");
}

/** Find which passages the answer cited, e.g. "[1][3]" -> [1, 3]. */
export function citedNumbers(answer: string, max: number): number[] {
  const nums = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return [...new Set(nums)].filter((n) => n >= 1 && n <= max).sort((a, b) => a - b);
}

const EXCERPT_CHARS = 280;

/**
 * Pick the part of a passage most related to the question and answer, so the
 * source preview shows the relevant lines rather than the start of the page.
 */
export function excerptFor(text: string, focus: string): string {
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const want = new Set(tokenize(focus));
  let best = 0;
  let bestScore = -1;
  sentences.forEach((s, i) => {
    const score = tokenize(s).filter((t) => want.has(t)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  let out = sentences[best];
  for (let i = best + 1; i < sentences.length && out.length + sentences[i].length + 1 <= EXCERPT_CHARS; i++) {
    out += " " + sentences[i];
  }
  if (out.length > EXCERPT_CHARS) out = out.slice(0, EXCERPT_CHARS - 1).trimEnd() + "…";
  return (best > 0 ? "… " : "") + out;
}

export function toSources(hits: Hit[], numbers: number[], focus = ""): Source[] {
  return numbers.map((n) => {
    const c = hits[n - 1].chunk;
    return { n, docName: c.docName, page: c.page, excerpt: excerptFor(c.text, focus) };
  });
}

/** Shape Claude's raw reply into what the UI shows. */
export function finalize(raw: string, hits: Hit[], question = ""): ChatResponse {
  const text = raw.trim();
  if (!text || text.startsWith(NOT_FOUND_TOKEN)) {
    return { answer: NOT_FOUND_REPLY, found: false, sources: [] };
  }
  const focus = `${question} ${text.replace(/\[\d+\]/g, "")}`;
  return { answer: text, found: true, sources: toSources(hits, citedNumbers(text, hits.length), focus) };
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function answerQuestion(question: string, hits: Hit[], history: ChatTurn[] = []): Promise<ChatResponse> {
  // Nothing relevant in the documents: skip the API call entirely.
  if (hits.length === 0) return { answer: NOT_FOUND_REPLY, found: false, sources: [] };

  const recent = history.slice(-6).map((t) => ({ role: t.role, content: t.content }));
  const message = await anthropic().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
    max_tokens: Number(process.env.MAX_ANSWER_TOKENS ?? 600),
    system: SYSTEM_PROMPT,
    messages: [
      ...recent,
      {
        role: "user",
        content: `Passages from the documents:\n\n${buildContext(hits)}\n\nQuestion: ${question}`,
      },
    ],
  });

  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return finalize(raw, hits, question);
}
