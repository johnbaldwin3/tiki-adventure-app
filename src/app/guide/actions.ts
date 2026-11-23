"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WELCOME_COOKIE, WELCOME_HIDDEN, WELCOME_MAX_AGE } from "@/lib/welcome";

/** "Hide this" on the home page's welcome card (remembered in this browser). */
export async function hideWelcome() {
  (await cookies()).set(WELCOME_COOKIE, WELCOME_HIDDEN, {
    maxAge: WELCOME_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/** "Show it again" on the guide page: brings the welcome card back. */
export async function showWelcome() {
  (await cookies()).delete(WELCOME_COOKIE);
  redirect("/guide?welcome=shown#welcome-card");
}
