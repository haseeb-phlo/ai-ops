"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeChampion } from "@/app/(protected)/admin/_actions/champions";

/**
 * Removes a single champion row. Confirms first, then calls the server
 * action with a redirect_to so the page doesn't 404 if this was the
 * team's only champion (the action redirects to the directory).
 */
export function RemoveChampionButton({
  championId,
  team,
  displayName,
}: {
  championId: string;
  team: string;
  displayName: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !confirm(
        `Remove ${displayName} as a champion of ${team}? They keep their account and any notes they wrote.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("champion_id", championId);
      fd.set("team", team);
      // Only send a redirect when removing the last champion would 404 the
      // page; the server action only honours redirect_to if set, and the
      // /champions/[team] page already gracefully handles the empty case,
      // so we keep redirect_to off here and let the page re-render.
      await removeChampion(fd);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-red-700"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Removing..." : "Remove"}
    </Button>
  );
}
