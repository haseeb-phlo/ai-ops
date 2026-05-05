import { redirect } from "next/navigation";

export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // /dashboard merged into the home dashboard at /. Preserve any toast or
  // other params on the redirect.
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v) qs.set(k, v);
  }
  redirect(qs.toString() ? `/?${qs.toString()}` : "/");
}
