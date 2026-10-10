import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractPages, stripMarkdown } from "@/lib/extract";

describe("stripMarkdown", () => {
  it("turns headings into sentences and removes formatting", () => {
    expect(stripMarkdown("## How long does delivery take?\n\nOrders arrive **next day**. See [tracking](https://x.y).")).toBe(
      "How long does delivery take?\n\nOrders arrive next day. See tracking.",
    );
  });
});

describe("extractPages", () => {
  it("reads the sample PDF page by page", async () => {
    const bytes = new Uint8Array(await readFile("samples/returns-policy.pdf"));
    const pages = await extractPages("returns-policy.pdf", bytes);
    expect(pages).toHaveLength(3);
    expect(pages[0].page).toBe(1);
    expect(pages[0].text).toContain("within 30 days of delivery");
    expect(pages[2].text).toContain("Final sale");
  });

  it("rejects other file types", async () => {
    await expect(extractPages("notes.docx", new Uint8Array())).rejects.toThrow(/Unsupported/);
  });
});
