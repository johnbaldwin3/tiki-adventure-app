/**
 * Local shops for "where can we buy this bottle?" links on ingredient pages.
 *
 * Neither store offers an API or public inventory feed (and Total Wine's
 * site blocks automated access), so the app never checks stock itself:
 * - Total Wine: a search link. Their site remembers the shopper's chosen
 *   store, so results show in-stock status for that store (e.g. Greenville).
 * - WineXpress (Five Forks): no online catalog, so a tap-to-call link.
 *   Number/address verified against two listings (loc8nearme, cigarworld).
 */

export const WINEXPRESS = {
  name: "WineXpress (Five Forks)",
  phoneDisplay: "(864) 283-6049",
  phoneHref: "tel:+18642836049",
  address: "202 Scuffletown Rd, Simpsonville, SC 29681",
};

/** Search-friendly bottle name: drops our notes in parentheses, e.g. "(54.5%)". */
export function bottleSearchTerm(brand: string): string {
  return brand.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

export function totalWineSearchUrl(brand: string): string {
  return `https://www.totalwine.com/search/all?text=${encodeURIComponent(bottleSearchTerm(brand))}`;
}
