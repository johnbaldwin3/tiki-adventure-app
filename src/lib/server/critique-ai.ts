import "server-only";
import { proposalFromModel, type CritiqueInput, type Proposal } from "../critique";
import { CRITIQUE_SCHEMA, CRITIQUE_SYSTEM, critiquePrompt } from "../critique-prompt";
import type { RecipeLine } from "../recipe-form";
import { callModel, DEADLINE_MS } from "./recipe-ai";

/** Asks the recipe helper for small changes that answer the critique. Null if it suggests nothing usable. */
export async function suggestTweaks(input: {
  name: string;
  lines: RecipeLine[];
  method: string | null;
  styles: string[];
  critique: CritiqueInput;
}): Promise<Proposal | null> {
  const raw = await callModel([{ type: "text", text: critiquePrompt(input) }], AbortSignal.timeout(DEADLINE_MS), {
    system: CRITIQUE_SYSTEM,
    schemaName: "recipe_critique",
    schema: CRITIQUE_SCHEMA,
    label: "The recipe helper",
    maxTokens: 2000,
  });
  return proposalFromModel(raw, input.lines);
}
