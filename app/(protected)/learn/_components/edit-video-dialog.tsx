"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Alert } from "@/components/ui/alert";
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
import { parseLoomId } from "@/lib/loom";
import { editVideo } from "../actions";
import {
  LEARN_SUBTOPICS,
  LEARN_SUBTOPIC_LABEL,
  LEARN_TOPICS,
  LEARN_TOPIC_LABEL,
  type ActionState,
  type LearnSubtopic,
  type LearnTopic,
} from "../topics";

/**
 * Dialog shell; the form lives in a keyed child so useActionState resets on
 * every open (see AddVideoDialog for the rationale). Field state also
 * re-initialises from props on each open via the same key bump.
 */
export function EditVideoDialog({
  id,
  title,
  description,
  loomShareUrl,
  topic,
  subtopic,
}: {
  id: string;
  title: string;
  description: string | null;
  loomShareUrl: string;
  topic: LearnTopic | null;
  subtopic: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (next) setFormKey((k) => k + 1);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Edit ${title}`}
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
        <EditVideoForm
          key={formKey}
          id={id}
          title={title}
          description={description}
          loomShareUrl={loomShareUrl}
          topic={topic}
          subtopic={subtopic}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditVideoForm({
  id,
  title,
  description,
  loomShareUrl,
  topic,
  subtopic,
  onSuccess,
  onCancel,
}: {
  id: string;
  title: string;
  description: string | null;
  loomShareUrl: string;
  topic: LearnTopic | null;
  subtopic: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [topicValue, setTopicValue] = useState<LearnTopic | "">(topic ?? "");
  const [subtopicValue, setSubtopicValue] = useState<string>(subtopic ?? "");
  const [loomUrl, setLoomUrl] = useState(loomShareUrl);
  const [state, formAction] = useActionState<ActionState, FormData>(editVideo, {
    kind: "idle",
  });

  useEffect(() => {
    if (state.kind === "success") onSuccess();
  }, [state, onSuccess]);

  const subtopicOptions = topicValue ? LEARN_SUBTOPICS[topicValue] ?? [] : [];

  // Mirror of the server-side parseLoomId check so a bad link errors inline
  // before a round-trip. (A full oEmbed preview is future work.)
  const loomInvalid = loomUrl.trim().length > 0 && !parseLoomId(loomUrl);
  const disabledHint = !topicValue
    ? "Choose a topic to save"
    : loomInvalid
      ? "Enter a valid Loom link"
      : null;

  return (
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
          <Label htmlFor={`edit-topic-${id}`}>
            Topic{" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </Label>
          <input type="hidden" name="topic" value={topicValue} />
          <Select
            value={topicValue}
            onValueChange={(v) => {
              setTopicValue((v as LearnTopic) ?? "");
              setSubtopicValue("");
            }}
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

        {subtopicOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor={`edit-subtopic-${id}`}>Subtopic (optional)</Label>
            <input type="hidden" name="subtopic" value={subtopicValue} />
            <Select
              value={subtopicValue || null}
              onValueChange={(v) => setSubtopicValue(v ?? "")}
            >
              <SelectTrigger id={`edit-subtopic-${id}`} className="w-full">
                <SelectValue placeholder="No subtopic">
                  {(v) => (v ? LEARN_SUBTOPIC_LABEL[v as LearnSubtopic] : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {subtopicOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEARN_SUBTOPIC_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`edit-loom-${id}`}>Loom URL</Label>
          <Input
            id={`edit-loom-${id}`}
            name="loom_url"
            required
            type="url"
            value={loomUrl}
            onChange={(e) => setLoomUrl(e.target.value)}
            placeholder="https://www.loom.com/share/..."
            aria-invalid={loomInvalid || undefined}
          />
          {loomInvalid && (
            <p role="alert" className="text-xs text-destructive">
              That doesn&apos;t look like a Loom link. Paste a
              https://www.loom.com/share/... URL.
            </p>
          )}
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
          <Alert variant="destructive">{state.message}</Alert>
        )}
      </div>

      <DialogFooter className="m-0 items-center border-t border-border bg-muted/40 px-6 py-3">
        {disabledHint && (
          <span className="mr-auto text-xs text-muted-foreground">
            {disabledHint}
          </span>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton disabled={!topicValue || loomInvalid} />
      </DialogFooter>
    </form>
  );
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled} loading={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}
