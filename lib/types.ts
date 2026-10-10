export interface PageText {
  /** 1-based page number, or null for files without pages (TXT, Markdown). */
  page: number | null;
  text: string;
}

export interface DocChunk {
  id: string;
  docId: string;
  docName: string;
  page: number | null;
  text: string;
}

export interface StoredDoc {
  id: string;
  name: string;
  pages: number | null;
  chunks: number;
  addedAt: string;
}

export interface Source {
  /** The passage number the answer cites, e.g. [2]. */
  n: number;
  docName: string;
  page: number | null;
  excerpt: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  found: boolean;
  sources: Source[];
}
