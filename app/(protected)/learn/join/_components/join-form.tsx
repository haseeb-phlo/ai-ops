"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinCohort, type JoinState } from "../actions";

export function JoinForm({ prefilled }: { prefilled: string | null }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(
    joinCohort,
    { kind: "idle" },
  );
  const router = useRouter();

  // Straight to the track on success - the code was the only thing standing
  // between them and day 1.
  useEffect(() => {
    if (state.kind === "success") router.push("/learn/track");
  }, [state, router]);

  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Cohort code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={prefilled ?? ""}
          placeholder="e.g. PHLO-C1"
          autoComplete="off"
          autoCapitalize="characters"
          required
        />
      </div>
      {state.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join the programme"}
      </Button>
    </form>
  );
}
