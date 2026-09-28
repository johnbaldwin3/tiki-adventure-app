/**
 * Shrinks a photo in the browser (JPEG, longest side ≤ maxSide) so it
 * uploads fast and fits the Server Action size limit. Receipts use a larger
 * limit: they're long and thin, and their small print must stay readable.
 */
export async function resizePhoto(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
