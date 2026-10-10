import { describe, expect, it } from "vitest";
import { search, tokenize } from "@/lib/search";
import type { DocChunk } from "@/lib/types";

const chunk = (id: string, text: string, page = 1): DocChunk => ({ id, docId: "d", docName: "doc.pdf", page, text });

const chunks = [
  chunk("returns", "Unused items can be returned within 30 days of delivery. Bring the receipt or order number."),
  chunk("shipping", "Delivery to Chattogram takes 2 to 3 working days. Dhaka orders arrive the next day.", 2),
  chunk("warranty", "Electronics come with a one year warranty against manufacturing faults.", 3),
];

describe("tokenize", () => {
  it("drops stopwords and stems simple endings", () => {
    expect(tokenize("Can I return the items I returned?")).toEqual(["return", "item", "return"]);
  });
});

describe("search", () => {
  it("ranks the passage that answers the question first", () => {
    const hits = search(chunks, "Can I return an item after 20 days?");
    expect(hits[0].chunk.id).toBe("returns");
  });

  it("matches place names", () => {
    const hits = search(chunks, "How long is delivery to Chattogram?");
    expect(hits[0].chunk.id).toBe("shipping");
  });

  it("returns nothing when no passage shares a meaningful word", () => {
    expect(search(chunks, "Do you sell gift cards?")).toEqual([]);
  });

  it("handles an empty index", () => {
    expect(search([], "anything")).toEqual([]);
  });
});
