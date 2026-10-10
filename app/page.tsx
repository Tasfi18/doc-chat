"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatTurn, Source, StoredDoc } from "@/lib/types";

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
  found?: boolean;
  sources?: Source[];
}

const EXAMPLES = [
  "Can I return an item after 20 days?",
  "How long does delivery to Chattogram take?",
  "Do you sell gift cards?",
];

function sourceLabel(s: Source) {
  return s.page ? `${s.docName} · page ${s.page}` : s.docName;
}

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = sources.find((s) => s.n === open);
  return (
    <>
      <div className="sources">
        {sources.map((s) => (
          <button
            key={s.n}
            className="src"
            aria-expanded={open === s.n}
            onClick={() => setOpen(open === s.n ? null : s.n)}
            title="Show the passage this answer used"
          >
            [{s.n}] {sourceLabel(s)}
          </button>
        ))}
      </div>
      {shown && <div className="excerpt">{shown.excerpt}</div>}
    </>
  );
}

export default function Home() {
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadDocs = useCallback(async () => {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocs(data.docs ?? []);
  }, []);

  useEffect(() => {
    loadDocs().catch(() => setNotice({ kind: "err", text: "Could not load documents." }));
  }, [loadDocs]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setNotice(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "err", text: `${file.name}: ${data.error}` });
      } else {
        setNotice({ kind: "ok", text: `${file.name} added (${data.doc.chunks} ${data.doc.chunks === 1 ? "passage" : "passages"}).` });
      }
    }
    await loadDocs();
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function remove(doc: StoredDoc) {
    if (!confirm(`Remove ${doc.name}? The assistant will stop answering from it.`)) return;
    await fetch(`/api/documents?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" });
    await loadDocs();
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatTurn[] = messages
      .filter((m): m is Message & { role: "user" | "assistant" } => m.role !== "error")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "error", content: data.error ?? "Something went wrong." }]);
      } else {
        // Strip the [n] markers from the text; the source chips show them.
        const clean = String(data.answer).replace(/\s*\[\d+\]/g, "");
        setMessages((m) => [...m, { role: "assistant", content: clean, found: data.found, sources: data.sources }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "error", content: "Could not reach the server." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <h1>Doc Chat</h1>
          <p>Answers from your own documents, with sources.</p>
        </div>

        <div className="upload">
          <div
            className={`drop${dragOver ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              upload(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
          >
            {uploading ? "Reading the file…" : <>Drop a PDF, TXT or MD file, or <b>browse</b></>}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.md"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
        </div>

        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

        <div className="docs">
          <h2>Documents ({docs.length})</h2>
          {docs.length === 0 && (
            <p className="empty-docs">No documents yet. Upload the files in the samples folder to try it.</p>
          )}
          {docs.map((d) => (
            <div className="doc" key={d.id}>
              <div className="icon">{d.name.split(".").pop()?.toUpperCase()}</div>
              <div className="meta">
                <div className="name" title={d.name}>{d.name}</div>
                <div className="sub">
                  {d.pages ? `${d.pages} pages · ` : ""}
                  {d.chunks} {d.chunks === 1 ? "passage" : "passages"}
                </div>
              </div>
              <button className="del" onClick={() => remove(d)} aria-label={`Remove ${d.name}`}>✕</button>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="head">
          <div className="dot">AI</div>
          <div>
            <b>Help assistant</b>
            <span>Answers only from the uploaded documents</span>
          </div>
        </div>

        <div className="msgs">
          {messages.length === 0 && (
            <div className="welcome">
              <h2>Ask about your documents</h2>
              <p>Every answer comes from the uploaded files and shows where it found the information. If the answer isn&apos;t there, it says so.</p>
              <div className="examples">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => ask(e)} disabled={docs.length === 0}>{e}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg user">{m.content}</div>
            ) : m.role === "error" ? (
              <div key={i} className="msg err">{m.content}</div>
            ) : (
              <div key={i} className={`msg bot${m.found ? "" : " miss"}`}>
                {m.content}
                {m.sources && m.sources.length > 0 && <SourceList sources={m.sources} />}
              </div>
            ),
          )}
          {busy && <div className="msg bot typing">Searching the documents…</div>}
          <div ref={bottom} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={docs.length ? "Ask a question…" : "Upload a document first"}
            disabled={docs.length === 0}
            maxLength={1000}
          />
          <button type="submit" disabled={busy || !input.trim() || docs.length === 0}>Send</button>
        </form>
        <div className="foot">Answers are generated by AI from your documents. Check important details in the source.</div>
      </main>
    </div>
  );
}
