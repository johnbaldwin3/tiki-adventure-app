import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The guide's content, one entry per section, in reading order. To cover a
 * new feature, add (or extend) an entry here: the page builds the
 * "Jump to" list and the sections from this array. Keep each tip to one or
 * two short sentences, in plain words, naming buttons exactly as the app
 * shows them.
 */
export interface GuideSection {
  /** Anchor for /guide#id; keep it stable once shipped (people share links). */
  id: string;
  icon: string;
  title: string;
  /** One line under the heading: what this part of the app is for. */
  summary: ReactNode;
  tips: ReactNode[];
  /** Optional "Go there" link. */
  link?: { href: string; label: string };
}

const a = "font-semibold text-teal underline underline-offset-2";
const b = (label: string) => <strong className="font-semibold text-ink">{label}</strong>;

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "sign-in",
    icon: "🔑",
    title: "Signing in",
    summary: "No password needed: we email you a code.",
    tips: [
      <>Tap {b("Sign in")} at the top, enter your email and tap {b("Email me a sign-in code")}.</>,
      <>Type the 6-digit code from the email into the same page. (If the email opens in your mail app&apos;s browser, just copy the code back to where you asked for it.)</>,
      <>You stay signed in on that phone or computer until you tap {b("Sign out")}.</>,
      <>Prefer a password? {b("Use a password instead")} is under the sign-in box. The code always works too.</>,
    ],
  },
  {
    id: "find",
    icon: "🔎",
    title: "Finding a drink",
    summary: "The home page lists every drink. Narrow it down however you like.",
    tips: [
      <>Pick a collection at the top: {b("Tiki")}, {b("Classics")}, {b("Prohibition")} or {b("All drinks")}.</>,
      <>Search by name, spirit or ingredient. Partial words work (&quot;pina&quot;, &quot;jamaican falernum&quot;).</>,
      <>{b("All / Tasted / Not yet")} shows everything, only what we&apos;ve tried, or what&apos;s left to try.</>,
      <>Filter by ingredients (&quot;drinks with lime and falernum&quot;, or &quot;Any rum&quot;) and by style tags like Sour, Spirit-forward, Smoky or Fruity.</>,
      <>Tap a drink for its recipe. The back link takes you to the same spot in the list, filters and all.</>,
      <>Every filtered list is its own link, so you can send one to a friend.</>,
    ],
    link: { href: "/", label: "Browse the drinks" },
  },
  {
    id: "recipe",
    icon: "🍹",
    title: "Reading a recipe",
    summary: "Each recipe card has everything you need to make the drink.",
    tips: [
      <>Make it for more people with {b("1× to 8×")}, and switch amounts between as written, fl oz and ml.</>,
      <>Glass, garnish and method are under the ingredients. Tap an ingredient for what it is and bottles to look for.</>,
      <>When you&apos;re signed in, the card says {b("We can make this")} or what&apos;s missing from your bar, with a button to add the missing bits to the shopping list.</>,
      <>Every recipe credits and links to where it came from (Difford&apos;s Guide, the IBA, or a book).</>,
    ],
  },
  {
    id: "rate",
    icon: "⭐",
    title: "Rating what you try",
    summary: "Keep a log of what you've tasted and what you thought.",
    tips: [
      <>On a recipe card, under {b("Our tasting")}, tap {b("Add rating & notes")}: a score out of 10, the date and a note.</>,
      <>Drinking together? Tick {b("… tried it too")} so it counts for both of you, then each add your own score.</>,
      <>The home page reminds you of drinks you&apos;ve tried but haven&apos;t rated yet.</>,
    ],
    // Multi-user step 2b: add who can see your ratings here once private ratings and friends ship.
  },
  {
    id: "next",
    icon: "🧭",
    title: "What to try next",
    summary: "Suggestions based on what you've loved so far.",
    tips: [
      <>{b("Try next")} on the home page shows three picks. {b("What to try next")} shows ten.</>,
      <>Each says why it was picked (&quot;Like Zombie: both use…&quot;), and drinks your bar can already make get a boost.</>,
    ],
    link: { href: "/next", label: "What to try next" },
  },
  {
    id: "bar",
    icon: "🍾",
    title: "Our bar",
    summary: "Tell the app what bottles you have, and it tells you what you can make.",
    tips: [
      <>Tap {b("Add what we have")} (later {b("Edit our bar")}) and tick what&apos;s on your shelf.</>,
      <>No ticking needed: {b("Scan a bottle or receipt")} reads a photo of a bottle (or a shop receipt) and fills in the form for you to check.</>,
      <>No photo? {b("Type in a bottle")} by name and the app guesses its style.</>,
      <>The page shows what you can make tonight, and {b("Buy next")}: single bottles that would unlock the most new drinks.</>,
      <>Want it to keep count? Set each bottle&apos;s size and how full it is, and it warns you when something is {b("running low")}.</>,
    ],
    link: { href: "/cabinet", label: "Open our bar" },
  },
  {
    id: "made",
    icon: "🥂",
    title: "We made this",
    summary: "Made a drink? Tap it so the bar stays up to date.",
    tips: [
      <>{b("We made this")} on a recipe card takes what you poured off the bottles you&apos;re tracking.</>,
      <>Tapped it by mistake? {b("Undo")} puts it all back.</>,
    ],
  },
  {
    id: "shopping",
    icon: "🛒",
    title: "Shopping list",
    summary: "One list for your bar, filled from anywhere in the app.",
    tips: [
      <>Add from a recipe card, an ingredient page or {b("Buy next")}.</>,
      <>Each item shows what it would let you make, and bottles to look for, with store links.</>,
      <>Bought it? {b("Got it")} moves it into your bar.</>,
    ],
    link: { href: "/shopping", label: "Open the shopping list" },
  },
  {
    id: "add-recipe",
    icon: "✨",
    title: "Adding recipes (with the AI helper)",
    summary: "Add drinks from a book, a website or a bar menu.",
    tips: [
      <>{b("Add a recipe")} on the home page. Snap a photo of a book page, paste a link or text, and the helper fills in the form.</>,
      <>Saw something good at a bar? {b("From a menu")}: type the ingredients and it works out likely amounts. Those recipes carry a {b("Best guess")} badge until you&apos;ve made and tweaked them.</>,
      <>Nothing is saved until you check it and tap save. The helper can get things wrong, so give it a quick look.</>,
    ],
  },
  {
    id: "tweak",
    icon: "🧪",
    title: "Tweaking a recipe",
    summary: "Too sweet? Too strong? Make it your own without losing the original.",
    tips: [
      <>On a recipe card, {b("Critique this recipe")}: say what was off and the helper suggests small changes, with reasons.</>,
      <>Save it as a trial and make it. Then {b("Keep it")} (it becomes &quot;our version&quot;) or {b("Drop it")}.</>,
      <>The original is always one tap away with {b("See the original")}.</>,
    ],
  },
  {
    id: "rums",
    icon: "🏝️",
    title: "Ingredients & rum numbers",
    summary: "What's in the bottle, and what to buy.",
    tips: [
      <>{b("Browse ingredients")} lists every ingredient with example bottles, links to look them up at the store, and the drinks that use it.</>,
      <>{b("Rum numbers")} sorts rums the way the Smuggler&apos;s Cove book does. In the shop, snap a label (or type the name) and tap {b("What number is it?")}.</>,
    ],
    link: { href: "/ingredients", label: "Browse ingredients" },
  },
  {
    id: "stats",
    icon: "📊",
    title: "Stats",
    summary: "How far through the list you are, favorites, and where tastes differ.",
    tips: [<>Find it at {b("See all our stats")} on the home page.</>],
    link: { href: "/stats", label: "See the stats" },
  },
  {
    id: "phone",
    icon: "📱",
    title: "Put it on your phone",
    summary: "It works like an app from your home screen.",
    tips: [
      <>iPhone: open equalparts.online in Safari, tap the Share button, then {b("Add to Home Screen")}.</>,
      <>Android: in Chrome, tap the ⋮ menu, then {b("Add to Home screen")} (or {b("Install app")}).</>,
    ],
  },
];

/** Shown at the end of the guide. */
export const GUIDE_HELP: ReactNode = (
  <>
    Stuck, or found something that looks wrong? Tell John or Genny. And if you just want to dive in,{" "}
    <Link href="/" className={a}>
      start with the drinks
    </Link>
    .
  </>
);
