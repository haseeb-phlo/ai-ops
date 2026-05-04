"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogInterventionDialog } from "./log-intervention-dialog";

export function LogInterventionButton({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Log intervention</Button>
      <LogInterventionDialog
        open={open}
        onOpenChange={setOpen}
        workflows={workflows}
      />
    </>
  );
}
