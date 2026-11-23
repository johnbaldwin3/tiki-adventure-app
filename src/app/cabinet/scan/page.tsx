import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { ingredientsByFamily } from "@/lib/ingredients";
import { fetchBar } from "@/lib/cabinet-data";
import { describeLeft } from "@/lib/inventory";
import { ScanBar, type CurrentBar } from "./scan-bar";

export const dynamic = "force-dynamic";
// Reading a photo with the model can take a while.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Scan into our bar", robots: { index: false } };

export default async function ScanPage({ searchParams }: PageProps<"/cabinet/scan">) {
  const sp = await searchParams;
  const startTyped = sp.type === "1";
  const user = await getSignedInUser();
  if (!user) redirect(startTyped ? "/login?next=%2Fcabinet%2Fscan%3Ftype%3D1" : "/login?next=%2Fcabinet%2Fscan");
  if (!user.taster) redirect("/cabinet");
  // What's in our bar now (shown when a save would replace it).
  const bar = await fetchBar().catch((err) => {
    unstable_rethrow(err);
    console.error("scan: failed to load bar", err);
    return null;
  });
  const current: CurrentBar = Object.fromEntries(
    [...(bar?.cabinet ?? new Map()).entries()].map(([id, bottle]) => [
      id,
      { bottle, left: describeLeft(bar!.inventory.get(id) ?? { sizeMl: null, remainingMl: null }) },
    ])
  );
  const catalog = ingredientsByFamily()
    .map((g) => ({ family: g.family, items: g.items.filter((i) => !i.staple).map((i) => ({ id: i.id, name: i.name, brands: i.brands })) }))
    .filter((g) => g.items.length > 0);
  return (
    <PageShell
      back={{ href: "/cabinet", label: "Our bar" }}
      eyebrow="JB & GM's home bar"
      title={startTyped ? "Add a bottle" : "Scan into our bar"}
      icon={startTyped ? "🍾" : "📷"}
      intro={
        startTyped
          ? "Type the bottle's name and we'll guess its style. Add its size and how full it is."
          : "Snap a bottle to add it with its size and how full it is, or a receipt to add what you bought. No photo? Type it in."
      }
    >
      <ScanBar catalog={catalog} current={current} startTyped={startTyped} />
    </PageShell>
  );
}
