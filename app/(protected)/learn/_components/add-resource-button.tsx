"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddResourceDialog } from "./add-resource-dialog";

export function AddResourceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Add resource
      </Button>
      <AddResourceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
