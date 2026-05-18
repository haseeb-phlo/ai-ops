"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addVideo,
  LEARN_TOPICS,
  LEARN_TOPIC_LABEL,
  type ActionState,
  type LearnTopic,
} from "../actions";

export function AddVideoDialog() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<LearnTopic | "">("");
  const [state, formAction] = useActionState<ActionState, FormData>(
    addVideo,
    { kind: "idle" },
  );

  // Render-phase close on success - same pattern as suggestions/submit-dialog.
  // The `open` guard prevents an infinite loop once state stays at "success".
  if (state.kind === "success" && open) {
    setOpen(false);
    setTopic("");
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setTopic("");
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add video</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add Loom video</DialogTitle>
          <DialogDescription>
            Paste a Loom share link. The video will appear on the Learn tab for
            everyone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col">
          <div className="space-y-4 border-t border-border px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. Writing prompts that don't suck"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <input type="hidden" name="topic" value={topic} />
              <Select
                value={topic}
                onValueChange={(v) => setTopic((v as LearnTopic) ?? "")}
              >
                <SelectTrigger id="topic" className="w-full">
                  <SelectValue placeholder="Pick a topic">
                    {(v) => (v ? LEARN_TOPIC_LABEL[v as LearnTopic] : null)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEARN_TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LEARN_TOPIC_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loom_url">Loom URL</Label>
              <Input
                id="loom_url"
                name="loom_url"
                required
                type="url"
                placeholder="https://www.loom.com/share/..."
              />
              <p className="text-xs text-muted-foreground">
                Use the Share button in Loom and paste the link here.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                maxLength={1000}
                placeholder="One-line summary of what this covers."
              />
            </div>

            {state.kind === "error" && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {state.message}
              </p>
            )}
          </div>

          <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton disabled={!topic} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Adding…" : "Add video"}
    </Button>
  );
}
