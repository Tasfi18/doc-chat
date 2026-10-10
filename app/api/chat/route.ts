import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/answer";
import { checkLimit } from "@/lib/ratelimit";
import { search } from "@/lib/search";
import { allChunks } from "@/lib/store";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";

const MAX_QUESTION_CHARS = 1000;

export async function POST(req: Request) {
  let body: { question?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON like { \"question\": \"...\" }." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` }, { status: 400 });
  }

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
        )
        .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
    : [];

  const visitor = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = checkLimit(visitor);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Daily limit of ${limit.limit} questions reached. Please try again tomorrow.` },
      { status: 429 },
    );
  }

  const chunks = await allChunks();
  const topK = Number(process.env.TOP_K ?? 5);
  let hits = search(chunks, question, topK);
  // A short follow-up like "and for Chattogram?" may match nothing on its own,
  // so retry with the previous question added for context.
  if (hits.length === 0) {
    const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
    if (lastUser) hits = search(chunks, `${question} ${lastUser}`, topK);
  }

  try {
    const result = await answerQuestion(question, hits, history);
    return NextResponse.json({ ...result, remaining: limit.remaining });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
