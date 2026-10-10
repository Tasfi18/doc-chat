import { describe, expect, it } from "vitest";
import { NOT_FOUND_REPLY, answerQuestion, buildContext, citedNumbers, excerptFor, finalize } from "@/lib/answer";
import type { Hit } from "@/lib/search";

const hits: Hit[] = [
  { score: 3, chunk: { id: "a", docId: "d1", docName: "Returns policy.pdf", page: 2, text: "Returns within 30 days." } },
  { score: 2, chunk: { id: "b", docId: "d2", docName: "Shipping FAQ.md", page: null, text: "Chattogram: 2-3 days." } },
];

describe("buildContext", () => {
  it("numbers passages and says where each came from", () => {
    expect(buildContext(hits)).toBe(
      "[1] (Returns policy.pdf, page 2)\nReturns within 30 days.\n\n[2] (Shipping FAQ.md)\nChattogram: 2-3 days.",
    );
  });
});

describe("citedNumbers", () => {
  it("finds each cited passage once, in order, and ignores out-of-range numbers", () => {
    expect(citedNumbers("Yes [2]. Also [1][2]. See [7].", 2)).toEqual([1, 2]);
  });
});

describe("finalize", () => {
  it("returns the answer with only the sources it cited", () => {
    const r = finalize("You can return items within 30 days [1].", hits);
    expect(r.found).toBe(true);
    expect(r.sources).toEqual([{ n: 1, docName: "Returns policy.pdf", page: 2, excerpt: "Returns within 30 days." }]);
  });

  it("turns NOT_FOUND into the friendly reply with no sources", () => {
    expect(finalize("NOT_FOUND", hits)).toEqual({ answer: NOT_FOUND_REPLY, found: false, sources: [] });
  });
});

describe("answerQuestion", () => {
  it("does not call the AI when search found nothing", async () => {
    const r = await answerQuestion("Do you sell gift cards?", []);
    expect(r).toEqual({ answer: NOT_FOUND_REPLY, found: false, sources: [] });
  });
});

describe("excerptFor", () => {
  it("starts the preview at the sentence that matches the question", () => {
    const text =
      "Lumen Home Returns Policy. Overview of our service. Unused items can be returned within 30 days of delivery. Bring the receipt.";
    expect(excerptFor(text, "return an item after 20 days")).toBe(
      "… Unused items can be returned within 30 days of delivery. Bring the receipt.",
    );
  });
});
