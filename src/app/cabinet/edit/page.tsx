import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { fetchCabinet, type Cabinet } from "@/lib/cabinet-data";
import { ingredientsByFamily } from "@/lib/ingredients";
import { CabinetForm, type CabinetFormGroup } from "./cabinet-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit our bar", robots: { index: false } };

async function loadCabinet(): Promise<Cabinet | null> {
  try {
    return await fetchCabinet();
  } catch (err) {
    unstable_rethrow(err);
    console.error("edit cabinet: failed to load", err);
    return null;
  }
}

export default async function EditCabinetPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fcabinet%2Fedit");
  if (!user.taster && !user.lookupFailed) redirect("/cabinet");

  const cabinet = user.taster ? await loadCabinet() : null;
  const back = { href: "/cabinet", label: "Our bar" };

  if (!cabinet) {
    return (
      <PageShell back={back} eyebrow="JB & GM's home bar" title="Edit our bar" icon="🍾">
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load our bar right now. Please try refreshing the page.
        </p>
      </PageShell>
    );
  }

  // Staples are assumed on hand, so they're not listed.
  const groups: CabinetFormGroup[] = ingredientsByFamily()
    .map((g) => ({
      family: g.family,
      items: g.items
        .filter((i) => !i.staple)
        .map((i) => ({ id: i.id, name: i.name, brands: i.brands })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <PageShell
      back={back}
      eyebrow="JB & GM's home bar"
      title="Edit our bar"
      icon="🍾"
      intro="Tick what we have. Optionally note the exact bottle. Fresh citrus, water, soda, salt and Angostura are assumed on hand."
    >
      <CabinetForm groups={groups} saved={Object.fromEntries(cabinet)} />
    </PageShell>
  );
}
