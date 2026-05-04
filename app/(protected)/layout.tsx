import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "./_components/header";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  let teams: string[] = [];
  if (user.realRole === "super_admin") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflows")
      .select("team")
      .is("deleted_at", null)
      .not("team", "is", null);
    teams = Array.from(
      new Set((data ?? []).map((r) => r.team).filter(Boolean) as string[]),
    ).sort();
  }

  return (
    <>
      <Header user={user} teams={teams} />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
