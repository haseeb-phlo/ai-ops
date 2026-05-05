"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleInterventionCosign } from "./actions";

export function CosignButton({
  interventionId,
  team,
  alreadySigned,
}: {
  interventionId: string;
  team: string;
  alreadySigned: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={alreadySigned ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const fd = new FormData();
          fd.set("intervention_id", interventionId);
          fd.set("team", team);
          await toggleInterventionCosign(fd);
        })
      }
    >
      {pending
        ? "Working..."
        : alreadySigned
        ? `Withdraw ${team} co-sign`
        : `Co-sign for ${team}`}
    </Button>
  );
}
