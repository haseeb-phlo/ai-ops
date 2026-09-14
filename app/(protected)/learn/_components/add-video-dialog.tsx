"use client";

import { useActionState, useEffect, useState, type ReactElement } from "react";
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
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldDescriptionId } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseVideoUrl } from "@/lib/video";
import { addVideo } from "../actions";
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
 * Dialog shell. The form (and its useActionState) lives in a keyed child:
 * the key is bumped on every open so the action state resets to idle, which
 * means a previous success can never instantly re-close the dialog and a
 * previous error can never show up stale on reopen. The child closes the
 * dialog via an effect when a NEW success arrives.
 */
export function AddVideoDialog({
  trigger,
  defaultTopic,
}: {
  trigger?: ReactElement;
  defaultTopic?: LearnTopic;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (next) setFormKey((k) => k + 1);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button>Add video</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add video</DialogTitle>
          <DialogDescription>
            Paste a share link from anywhere. The video will appear on the Learn tab for
            everyone.
          </DialogDescription>
        </DialogHeader>
        <AddVideoForm
          key={formKey}
          defaultTopic={defaultTopic}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddVideoForm({
  defaultTopic,
  onSuccess,
  onCancel,
}: {
  defaultTopic?: LearnTopic;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [topic, setTopic] = useState<LearnTopic | "">(defaultTopic ?? "");
  const [subtopic, setSubtopic] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState("");
  const [state, formAction] = useActionState<ActionState, FormData>(addVideo, {
    kind: "idle",
  });

  useEffect(() => {
    if (state.kind === "success") onSuccess();
  }, [state, onSuccess]);

  const subtopicOptions = topic ? LEARN_SUBTOPICS[topic] ?? [] : [];

  // Mirror of the server-side `parseVideoUrl` check so a bad link errors
  // inline before a round-trip. It is a much weaker claim than it used to be:
  // the host no longer has to be Loom, so this only catches something that is
  // not a link at all. Left as a mirror rather than deleted, because a typo
  // still deserves to be caught before the dialog closes.
  const urlInvalid = videoUrl.trim().length > 0 && !parseVideoUrl(videoUrl);
  const disabledHint = !topic
    ? "Choose a topic to save"
    : urlInvalid
      ? "Enter a valid video link"
      : null;

  return (
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
          <Label htmlFor="topic">
            Topic{" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </Label>
          <input type="hidden" name="topic" value={topic} />
          <Select
            value={topic}
            onValueChange={(v) => {
              setTopic((v as LearnTopic) ?? "");
              setSubtopic("");
            }}
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

        {subtopicOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="subtopic">Subtopic (optional)</Label>
            <input type="hidden" name="subtopic" value={subtopic} />
            <Select
              value={subtopic || null}
              onValueChange={(v) => setSubtopic(v ?? "")}
            >
              <SelectTrigger id="subtopic" className="w-full">
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

        <Field
          htmlFor="video_url"
          label="Video link"
          required
          error={
            urlInvalid &&
            "That doesn't look like a link. Paste the https:// URL you would share with someone."
          }
          help="Loom and Streamable play inside the card. Anything else is saved as a link out."
        >
          <Input
            id="video_url"
            name="video_url"
            required
            type="url"
            placeholder="https://streamable.com/... or any share link"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            aria-invalid={urlInvalid || undefined}
            aria-describedby={fieldDescriptionId("video_url")}
          />
        </Field>

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
        <SubmitButton disabled={!topic || urlInvalid} />
      </DialogFooter>
    </form>
  );
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled} loading={pending}>
      {pending ? "Adding…" : "Add video"}
    </Button>
  );
}
