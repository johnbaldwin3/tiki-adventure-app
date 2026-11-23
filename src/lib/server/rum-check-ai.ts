import "server-only";
import { RUM_CHECK_SCHEMA, RUM_CHECK_SYSTEM, rumCheckFromModel, rumCheckPrompt, type RumCheck } from "../rum-check";
import { callModel, DEADLINE_MS, type ContentPart } from "./recipe-ai";

/** Classifies a rum from a photo and/or its name (null = no rum found). Throws ImportError with a user-safe message. */
export async function classifyRum(input: { name: string; imageDataUrl?: string }): Promise<RumCheck | null> {
  const parts: ContentPart[] = [{ type: "text", text: rumCheckPrompt(input.name, !!input.imageDataUrl) }];
  if (input.imageDataUrl) parts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  const raw = await callModel(parts, AbortSignal.timeout(DEADLINE_MS), {
    system: RUM_CHECK_SYSTEM,
    schemaName: "rum_number",
    schema: RUM_CHECK_SCHEMA,
    label: "The rum checker",
    maxTokens: 1500,
  });
  return rumCheckFromModel(raw, input.name);
}
