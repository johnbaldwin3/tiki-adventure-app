import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("lets visitors reach the landing page and the account pages", () => {
    for (const p of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm", "/join/abc123", "/manifest.webmanifest", "/icon.svg", "/apple-icon.png"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });
  it("keeps recipes, stats and the bar for members", () => {
    for (const p of ["/cocktails/zombie", "/stats", "/cabinet", "/ingredients", "/next", "/collections", "/rums", "/shopping", "/loginx", "/iconic"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
