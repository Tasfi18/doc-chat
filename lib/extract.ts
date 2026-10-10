import type { PageText } from "./types";

export const ACCEPTED = [".pdf", ".txt", ".md"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/** Remove Markdown symbols so passages read as plain text. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, ""))
    .replace(/^#{1,6}\s+(.*)$/gm, "$1.") // headings become their own sentence
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\?\./g, "?")
    .replace(/\.\./g, ".");
}

/** Pull plain text out of an uploaded file, one entry per PDF page. */
export async function extractPages(fileName: string, bytes: Uint8Array): Promise<PageText[]> {
  const ext = extensionOf(fileName);

  if (ext === ".pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((t, i) => ({ page: i + 1, text: t }));
  }

  if (ext === ".txt") {
    return [{ page: null, text: new TextDecoder("utf-8").decode(bytes) }];
  }

  if (ext === ".md") {
    return [{ page: null, text: stripMarkdown(new TextDecoder("utf-8").decode(bytes)) }];
  }

  throw new Error(`Unsupported file type "${ext || fileName}". Upload a PDF, TXT or Markdown file.`);
}
