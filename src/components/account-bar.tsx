import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { Logo } from "@/components/logo";

/** Slim bar above every page: the logo (home link), and who's signed in, with Settings and sign-in / sign-out. */
export async function AccountBar() {
  let user: Awaited<ReturnType<typeof getSignedInUser>> = null;
  try {
    user = await getSignedInUser();
  } catch (err) {
    // Let Next's own control-flow errors through (e.g. the "this page reads
    // cookies, so render it per request" signal) -- only swallow real failures.
    unstable_rethrow(err);
    console.error("account bar: failed to load signed-in user", err);
    user = null; // auth hiccup: show the signed-out bar rather than breaking the page
  }
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-3 text-sm sm:max-w-lg">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-xl font-extrabold tracking-tight text-teal-deep">
        <Logo size={36} className="drop-shadow-sm" />
        <span className="text-base">Equal Parts</span>
      </Link>
      <nav aria-label="Account" className="flex min-w-0 items-center justify-end gap-3">
        {user ? (
          <>
            <span className="min-w-0 truncate text-ink-soft">
              {/* The prefix stays for screen readers; phones show just the name, next to the logo. */}
              <span className="sr-only sm:not-sr-only">Signed in as </span>
              <strong className="text-ink">{user.taster?.displayName ?? user.email}</strong>
            </span>
            <Link href="/settings" className="whitespace-nowrap font-semibold text-teal underline-offset-2 hover:underline">
              Settings
            </Link>
            <form action={signOut}>
              <button type="submit" className="whitespace-nowrap font-semibold text-teal underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="font-semibold text-teal underline-offset-2 hover:underline">
            Sign in
          </Link>
        )}
      </nav>
    </div>
  );
}
