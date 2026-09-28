/** Where the verified recipes come from (both sources credited and linked). */
export function RecipeCredits() {
  const link = "font-semibold text-teal underline underline-offset-2";
  return (
    <p className="pt-2 text-center text-xs text-ink-faint">
      Recipes adapted from{" "}
      <a href="https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical" target="_blank" rel="noopener noreferrer" className={link}>
        Difford&apos;s Guide<span className="sr-only"> (opens in a new tab)</span>
      </a>{" "}
      (tiki) and the{" "}
      <a href="https://iba-world.com/cocktails/all-cocktails/" target="_blank" rel="noopener noreferrer" className={link}>
        IBA official cocktails<span className="sr-only"> (opens in a new tab)</span>
      </a>
      .
    </p>
  );
}
