import { describe, it, expect } from "vitest";
import { containsBadWords, censorText } from "../profanity";

describe("profanity filter", () => {
  it("detects an insult as a whole word", () => {
    expect(containsBadWords("ce gestionnaire est un connard")).toBe(true);
  });

  it("does not flag a word that merely contains a substring of a bad word", () => {
    expect(containsBadWords("le radiateur ne chauffe plus depuis 3 jours")).toBe(false);
  });

  it("ignores case", () => {
    expect(containsBadWords("MERDE alors")).toBe(true);
  });

  it("censors detected words while keeping the sentence readable", () => {
    const result = censorText("c'est vraiment nul ce service");
    expect(result).not.toMatch(/\bnul\b/);
    expect(result).toContain("n**");
  });

  it("leaves clean text untouched", () => {
    const text = "Le radiateur de la chambre 108 ne chauffe plus.";
    expect(censorText(text)).toBe(text);
  });
});
