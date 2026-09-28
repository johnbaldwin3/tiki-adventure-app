import "server-only";
import {
  BOTTLE_SCHEMA,
  BOTTLE_SYSTEM,
  bottleFromModel,
  RECEIPT_SCHEMA,
  RECEIPT_SYSTEM,
  receiptFromModel,
  type BottleDraft,
  type ReceiptDraft,
} from "../scan";
import { callModel, DEADLINE_MS } from "./recipe-ai";

/** Reads a bottle photo (null = no bottle found). Throws ImportError with a user-safe message. */
export async function scanBottlePhoto(imageDataUrl: string): Promise<BottleDraft | null> {
  const raw = await callModel(
    [
      { type: "text", text: "Identify this bottle, its size and how full it is." },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    AbortSignal.timeout(DEADLINE_MS),
    { system: BOTTLE_SYSTEM, schemaName: "bottle", schema: BOTTLE_SCHEMA, label: "The photo reader" }
  );
  return bottleFromModel(raw);
}

/** Reads a receipt photo (null = not a receipt). */
export async function scanReceiptPhoto(imageDataUrl: string): Promise<ReceiptDraft | null> {
  const raw = await callModel(
    [
      { type: "text", text: "List the items bought on this receipt." },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    AbortSignal.timeout(DEADLINE_MS),
    { system: RECEIPT_SYSTEM, schemaName: "receipt", schema: RECEIPT_SCHEMA, label: "The photo reader", maxTokens: 5000 }
  );
  return receiptFromModel(raw);
}
