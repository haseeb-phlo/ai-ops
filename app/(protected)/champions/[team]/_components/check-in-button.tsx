"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { recordChampionCheckIn } from "../actions";

export function CheckInButton({ team }: { team: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await recordChampionCheckIn(team);
        })
      }
    >
      {pending ? "Recording..." : "Check in now"}
    </Button>
  );
}
