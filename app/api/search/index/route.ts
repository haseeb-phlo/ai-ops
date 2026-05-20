import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Returns the full searchable index for the Cmd-K palette in one shot.
// The org is small enough that streaming the entire index is cheaper than
// running a query per keystroke, and the client-side filter feels instant.
// Cache-Control is set so a browser only re-fetches once per session.

export const dynamic = "force-dynamic";

export type SearchHit = {
  id: string;
  kind: "workflow" | "intervention" | "suggestion" | "video" | "person";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function GET() {
  await getSessionUser();
  const supabase = await createClient();

  const [
    { data: workflows },
    { data: interventions },
    { data: suggestions },
    { data: videos },
    { data: people },
  ] = await Promise.all([
    supabase
      .from("workflows")
      .select("id, name, team")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; team: string | null }[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status")
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; status: string | null }[]>(),
    supabase
      .from("intervention_suggestions")
      .select("id, title, status, team")
      .order("created_at", { ascending: false })
      .returns<{
        id: string;
        title: string;
        status: string | null;
        team: string | null;
      }[]>(),
    supabase
      .from("learn_videos")
      .select("id, title, topic")
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string; topic: string | null }[]>(),
    supabase
      .from("people")
      .select("email, display_name, team, title")
      .order("display_name", { ascending: true })
      .returns<{
        email: string;
        display_name: string;
        team: string | null;
        title: string | null;
      }[]>(),
  ]);

  const hits: SearchHit[] = [];

  for (const w of workflows ?? []) {
    hits.push({
      id: w.id,
      kind: "workflow",
      title: w.name,
      subtitle: w.team,
      href: `/workflows/${w.id}`,
    });
  }
  for (const i of interventions ?? []) {
    hits.push({
      id: i.id,
      kind: "intervention",
      title: i.name,
      subtitle: i.status,
      href: `/interventions/${i.id}`,
    });
  }
  for (const s of suggestions ?? []) {
    hits.push({
      id: s.id,
      kind: "suggestion",
      title: s.title,
      subtitle: [s.team, s.status].filter(Boolean).join(" · ") || null,
      href: `/suggestions/${s.id}`,
    });
  }
  for (const v of videos ?? []) {
    hits.push({
      id: v.id,
      kind: "video",
      title: v.title,
      subtitle: v.topic,
      href: `/learn`,
    });
  }
  for (const p of people ?? []) {
    if (!p.email || !p.display_name) continue;
    hits.push({
      id: p.email,
      kind: "person",
      title: p.display_name,
      subtitle: [p.title, p.team].filter(Boolean).join(" · ") || null,
      href: `/map`,
    });
  }

  return NextResponse.json(
    { hits },
    {
      headers: {
        // Browser cache for 60s; re-fetched any time the palette opens
        // after expiry. This is per-user data, so no shared cache.
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
