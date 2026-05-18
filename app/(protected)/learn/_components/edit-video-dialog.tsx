"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PencilIcon } from "lucide-react";
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
import { editVideo } from "../actions";
import {
  LEARN_TOPICS,
  LEARN_TOPIC_LABEL,
  type ActionState,
  type LearnTopic,
} from "../topics";

export function EditVideoDialog({
  id,
  title,
  description,
  loomShareUrl,
  topic,
}: {
  id: string;
  title: string;
  description: string | null;
  loomShareUrl: string;
  topic: LearnTopic | null;
}) {
  const [open, setOpen] = useState(false);
  // Keep the selected topic in local state so the Select control can be
  // reset to the current value each time the dialog reopens (otherwise the
  // controlled component would drift after a successful edit).
  const [topicValue, setTopicValue] = useState<LearnTopic | "">(topic ?? "");
  const [state, formAction] = useActionState<ActionState, FormData>(
    editVideo,
    { kind: "idle" },
  );

  if (state.kind === "success" && open) {
    setOpen(false);
  }

  const handleOpenChange = (next: boolean) => {
    if (next) setTopicValue(topic ?? "");
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Edit video"
            title="Edit video"
          >
            <PencilIcon className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Edit video</DialogTitle>
          <DialogDescription>
            Update the title, description, topic, or Loom link.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col">
          <input type="hidden" name="id" value={id} />
          <div className="space-y-4 border-t border-border px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-title-${id}`}>Title</Label>
              <Input
                id={`edit-title-${id}`}
                name="title"
                required
                maxLength={200}
                defaultValue={title}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`edit-topic-${id}`}>Topic</Label>
              <input type="hidden" name="topic" value={topicValue} />
              <Select
                value={topicValue}
                onValueChange={(v) =>
                  setTopicValue((v as LearnTopic) ?? "")
                }
              >
                <SelectTrigger id={`edit-topic-${id}`} className="w-full">
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
              <Label htmlFor={`edit-loom-${id}`}>Loom URL</Label>
              <Input
                id={`edit-loom-${id}`}
                name="loom_url"
                required
                type="url"
                defaultValue={loomShareUrl}
                placeholder="https://www.loom.com/share/..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`edit-description-${id}`}>
                Description (optional)
              </Label>
              <Textarea
                id={`edit-description-${id}`}
                name="description"
                rows={2}
                maxLength={1000}
                defaultValue={description ?? ""}
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
            <SubmitButton disabled={!topicValue} />
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
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}
