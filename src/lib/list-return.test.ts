import { describe, expect, it } from "vitest";
import { backLabel, cardSlug, isListHref, parseListReturn } from "./list-return";

describe("list return memory", () => {
  it("only remembers home list URLs", () => {
    expect(isListHref("/")).toBe(true);
    expect(isListHref("/?show=tasted&ing=any-rum")).toBe(true);
    expect(isListHref("/stats")).toBe(false);
    expect(isListHref("//evil.example")).toBe(false);
    expect(isListHref("https://evil.example/?x")).toBe(false);
  });

  it("finds the card a link opens", () => {
    expect(cardSlug("/cocktails/zombie")).toBe("zombie");
    expect(cardSlug("/cocktails/mai-tai-by-trader-vic?x=1")).toBe("mai-tai-by-trader-vic");
    expect(cardSlug("/cocktails/new")).toBeNull();
    expect(cardSlug("/cocktails/zombie/edit")).toBeNull();
    expect(cardSlug("/ingredients/lime")).toBeNull();
  });

  it("parses what it stored and rejects anything else", () => {
    expect(parseListReturn(JSON.stringify({ href: "/?show=tasted", y: 812.4, slug: "zombie", restore: true }))).toEqual({
      href: "/?show=tasted",
      y: 812,
      slug: "zombie",
      restore: true,
    });
    expect(parseListReturn(JSON.stringify({ href: "/stats", y: 10 }))).toBeNull();
    expect(parseListReturn("not json")).toBeNull();
    expect(parseListReturn(null)).toBeNull();
    expect(parseListReturn(JSON.stringify({ href: "/", y: -5, slug: "Bad Slug!" }))).toEqual({
      href: "/",
      y: 0,
      slug: null,
      restore: false,
    });
  });

  it("labels the back link by whether the list was narrowed", () => {
    expect(backLabel(null)).toBe("All cocktails");
    expect(backLabel({ href: "/", y: 0, slug: null, restore: false })).toBe("All cocktails");
    expect(backLabel({ href: "/?ing=any-rum", y: 0, slug: null, restore: false })).toBe("Back to the list");
  });
});
