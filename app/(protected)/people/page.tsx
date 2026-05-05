import { redirect } from "next/navigation";

export default async function PeopleRedirect({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { team } = await searchParams;
  const teamStr = Array.isArray(team) ? team[0] : team;
  const qs = new URLSearchParams({ view: "directory" });
  if (typeof teamStr === "string" && teamStr.length > 0) {
    qs.set("team", teamStr);
  }
  redirect(`/map?${qs.toString()}`);
}
