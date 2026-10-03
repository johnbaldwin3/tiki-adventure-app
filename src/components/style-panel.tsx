import Link from "next/link";
import { setDrinkStyles } from "@/app/cocktails/style-actions";
import { STYLE_GROUPS, STYLE_TAGS, getStyleTag } from "@/lib/styles";

import { FocusMessage } from "./focus-message";
import { SubmitButton } from "./submit-button";

/** A drink's style tags (linking to the filtered list), and a form for tasters to fix them. */
export function StylePanel({
  slug,
  name,
  tags,
  computed,
  canEdit,
  status,
}: {
  slug: string;
  name: string;
  tags: string[];
  /** What the rules alone say (to show which tags are hand-fixed). */
  computed: string[];
  canEdit: boolean;
  status?: string | string[];
}) {
  const fixed = tags.some((t) => !computed.includes(t)) || computed.some((t) => !tags.includes(t));
  return (
    <section id="style" aria-labelledby="style-heading" className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 id="style-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        Style
      </h2>
      {status === "saved" && (
        <FocusMessage role="status" className="mt-2 text-sm font-semibold text-teal-deep">
          Style tags saved.
        </FocusMessage>
      )}
      {status === "error" && (
        <FocusMessage role="alert" className="mt-2 text-sm font-semibold text-coral-deep">
          Couldn&apos;t save the style tags. Please try again.
        </FocusMessage>
      )}
      <ul aria-label={`Style tags for ${name}`} className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((id) => (
          <li key={id}>
            <Link
              href={`/?style=${id}`}
              prefetch={false}
              className="inline-block rounded-full border border-teal/30 px-3 py-1.5 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
            >
              {getStyleTag(id)?.label ?? id}
              <span className="sr-only"> (see all drinks tagged this)</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        {fixed ? "Worked out from the recipe, with our fixes." : "Worked out from the recipe."}
      </p>
      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">
            Fix style tags
          </summary>
          <form action={setDrinkStyles} className="mt-2 flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            {STYLE_GROUPS.map((g) => (
              <fieldset key={g.group}>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{g.label}</legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
                  {STYLE_TAGS.filter((t) => t.group === g.group).map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type={g.group === "structure" ? "radio" : "checkbox"}
                        name="style"
                        value={t.id}
                        defaultChecked={tags.includes(t.id)}
                        className="size-5 shrink-0 accent-teal-deep"
                      />
                      {t.label}
                      {computed.includes(t.id) !== tags.includes(t.id) && (
                        <span className="text-xs text-ink-faint">(our fix)</span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <SubmitButton className="w-fit rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm" pendingText="Saving…">
              Save style tags
            </SubmitButton>
          </form>
        </details>
      )}
    </section>
  );
}
