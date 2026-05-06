"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PickerPerson } from "@/components/ui/people-picker";
import { LogInterventionDialog } from "./log-intervention-dialog";

export function LogInterventionButton({
  workflows,
  people,
}: {
  workflows: { id: string; name: string }[];
  people: PickerPerson[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Log intervention</Button>
      <LogInterventionDialog
        open={open}
        onOpenChange={setOpen}
        workflows={workflows}
        people={people}
      />
    </>
  );
}
