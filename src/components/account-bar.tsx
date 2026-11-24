import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { Logo } from "@/components/logo";
import { getPendingInvites } from "@/lib/pending-invites-data";

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
  // Admins: how many members' invites wait for an OK (a badge on Settings).
  let waiting = 0;
  if (user?.isAdmin) {
    try {
      waiting = (await getPendingInvites())?.length ?? 0;
    } catch (err) {
      unstable_rethrow(err);
      console.error("account bar: failed to count waiting invites", err);
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-3 text-sm sm:max-w-lg">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-xl font-extrabold tracking-tight text-teal-deep">
        <Logo size={36} className="drop-shadow-sm" />
        <span className="text-base">Equal Parts</span>
      </Link>
      <nav aria-label="Account" className="flex min-w-0 items-center justify-end gap-3">
        <Link href="/guide" className="shrink-0 font-semibold text-teal underline-offset-2 hover:underline">
          Help
        </Link>
        {user ? (
          <>
            <span className="min-w-0 truncate text-ink-soft">
              {/* The prefix stays for screen readers; phones show just the name, next to the logo. */}
              <span className="sr-only sm:not-sr-only">Signed in as </span>
              <strong className="text-ink">{user.taster?.displayName ?? user.email}</strong>
            </span>
            <Link
              href={waiting > 0 ? "/settings#approvals" : "/settings"}
              className={`relative whitespace-nowrap font-semibold ${waiting > 0 ? "mr-3" : ""} text-teal underline-offset-2 hover:underline`}
            >
              Settings
              {waiting > 0 && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-4 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-coral-deep px-1 text-[0.6875rem] leading-none font-bold text-white shadow-sm"
                  >
                    {waiting > 9 ? "9+" : waiting}
                  </span>
                  <span className="sr-only">
                    {`(${waiting} ${waiting === 1 ? "invite needs" : "invites need"} your approval)`}
                  </span>
                </>
              )}
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
