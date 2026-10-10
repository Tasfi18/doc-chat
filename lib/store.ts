import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chunkPages } from "./chunk";
import type { DocChunk, PageText, StoredDoc } from "./types";

interface StoreData {
  docs: StoredDoc[];
  chunks: DocChunk[];
}

/**
 * A small file-backed store: everything is kept in memory and saved to
 * data/store.json so documents survive a restart. Fine for a demo or a
 * single-server deployment; swap for a database when you need more.
 */
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const g = globalThis as unknown as { __docStore?: Promise<StoreData> };

async function load(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(STORE_FILE, "utf8")) as StoreData;
  } catch {
    return { docs: [], chunks: [] };
  }
}

function store(): Promise<StoreData> {
  g.__docStore ??= load();
  return g.__docStore;
}

async function save(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(data), "utf8");
}

export async function listDocs(): Promise<StoredDoc[]> {
  return [...(await store()).docs].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function allChunks(): Promise<DocChunk[]> {
  return (await store()).chunks;
}

export async function addDoc(name: string, pages: PageText[]): Promise<StoredDoc> {
  const data = await store();
  const raw = chunkPages(pages);
  if (raw.length === 0) {
    throw new Error("No readable text found. Scanned PDFs need OCR before they can be searched.");
  }

  // Re-uploading a file with the same name replaces the old version.
  const existing = data.docs.find((d) => d.name === name);
  if (existing) await removeDoc(existing.id);

  const id = randomUUID();
  const hasPages = pages.some((p) => p.page !== null);
  const doc: StoredDoc = {
    id,
    name,
    pages: hasPages ? pages.length : null,
    chunks: raw.length,
    addedAt: new Date().toISOString(),
  };
  data.docs.push(doc);
  data.chunks.push(...raw.map((c, i) => ({ id: `${id}:${i}`, docId: id, docName: name, page: c.page, text: c.text })));
  await save(data);
  return doc;
}

export async function removeDoc(id: string): Promise<boolean> {
  const data = await store();
  const before = data.docs.length;
  data.docs = data.docs.filter((d) => d.id !== id);
  data.chunks = data.chunks.filter((c) => c.docId !== id);
  await save(data);
  return data.docs.length < before;
}
