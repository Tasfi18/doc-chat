import { describe, expect, it } from "vitest";
import { chunkPages, normalize } from "@/lib/chunk";

describe("normalize", () => {
  it("collapses spaces but keeps paragraph breaks", () => {
    expect(normalize("a   b\t c\r\n\r\n\r\nnext")).toBe("a b c\n\nnext");
  });
});

describe("chunkPages", () => {
  it("never mixes text from two pages", () => {
    const chunks = chunkPages([
      { page: 1, text: "Returns are accepted within 30 days." },
      { page: 2, text: "Shipping to Chattogram takes 2 to 3 days." },
    ]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ page: 1, text: "Returns are accepted within 30 days." });
    expect(chunks[1].page).toBe(2);
  });

  it("splits long pages into chunks near the target size", () => {
    const sentence = "This is a sentence about the returns policy of the store. ";
    const chunks = chunkPages([{ page: 1, text: sentence.repeat(40) }], { size: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(360);
  });

  it("skips empty pages", () => {
    expect(chunkPages([{ page: 1, text: "   " }, { page: 2, text: "" }])).toEqual([]);
  });
});
