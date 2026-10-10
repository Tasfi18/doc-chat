import type { PageText } from "./types";

export interface ChunkOptions {
  /** Target size of a chunk in characters. */
  size?: number;
  /** Characters carried over from the end of one chunk into the next. */
  overlap?: number;
}

export interface RawChunk {
  page: number | null;
  text: string;
}

/** Collapse runs of spaces and tabs, keep paragraph breaks. */
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into sentences, keeping the punctuation. */
function sentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?]+(?:[.!?]+|$)/g);
  return (parts ?? [paragraph]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Break each page into chunks of roughly `size` characters, on paragraph and
 * sentence boundaries, so a chunk never mixes text from two pages. That keeps
 * the page number on every answer source accurate.
 */
export function chunkPages(pages: PageText[], opts: ChunkOptions = {}): RawChunk[] {
  const size = opts.size ?? 900;
  const overlap = Math.min(opts.overlap ?? 150, Math.floor(size / 2));
  const out: RawChunk[] = [];

  for (const { page, text } of pages) {
    const clean = normalize(text);
    if (!clean) continue;

    const units = clean
      .split(/\n{2,}/)
      .flatMap((p) => (p.length > size ? sentences(p.replace(/\n/g, " ")) : [p.replace(/\n/g, " ")]));

    let current = "";
    for (const unit of units) {
      // A single sentence longer than the limit is hard-split.
      const pieces = unit.length > size ? unit.match(new RegExp(`.{1,${size}}`, "g")) ?? [unit] : [unit];
      for (const piece of pieces) {
        if (current && current.length + piece.length + 1 > size) {
          out.push({ page, text: current });
          const tail = current.slice(-overlap);
          // Start the next chunk at a word boundary inside the overlap.
          current = (tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : tail) + " " + piece;
        } else {
          current = current ? `${current} ${piece}` : piece;
        }
      }
    }
    if (current.trim()) out.push({ page, text: current.trim() });
  }
  return out;
}
