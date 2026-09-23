import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getSignedInUser } from "@/lib/auth/current-taster";

/** Slim bar above every page: who's signed in, with sign-in / sign-out. */
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
    <nav aria-label="Account" className="mx-auto flex w-full max-w-md items-center justify-end gap-3 px-4 pt-3 text-sm sm:max-w-lg">
      {user ? (
        <>
          <span className="min-w-0 truncate text-ink-soft">
            Signed in as <strong className="text-ink">{user.taster?.displayName ?? user.email}</strong>
          </span>
          <form action={signOut}>
            <button type="submit" className="font-semibold text-teal underline-offset-2 hover:underline">
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
  );
}
