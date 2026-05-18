"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddVideoDialog } from "./add-video-dialog";

export function AddVideoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add video</Button>
      <AddVideoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
