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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { addVideoResourceFile, addVideoResourceUrl } from "../actions";
import { VIDEO_RESOURCE_MAX_FILE_BYTES, type ActionState } from "../topics";

type Tab = "url" | "file";

// Document / image / archive types we expect people to attach alongside a
// walkthrough video. The server only enforces size, so this is a UX filter,
// not a security boundary.
const FILE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.key,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.zip";

/**
 * Dialog shell; forms live in a keyed child so both useActionState hooks
 * reset on every open - a previous success can't instantly re-close the
 * dialog and stale errors never reappear (see AddVideoDialog).
 */
export function AddAttachmentDialog({
  videoId,
  videoTitle,
  trigger,
}: {
  videoId: string;
  videoTitle: string;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (next) setFormKey((k) => k + 1);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add resource</DialogTitle>
          <DialogDescription>
            Attach a link or upload a file under {`"${videoTitle}"`}.
          </DialogDescription>
        </DialogHeader>
        <AttachmentForms
          key={formKey}
          videoId={videoId}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AttachmentForms({
  videoId,
  onSuccess,
  onCancel,
}: {
  videoId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<Tab>("url");
  const [fileError, setFileError] = useState<string | null>(null);

  const [urlState, urlAction] = useActionState<ActionState, FormData>(
    addVideoResourceUrl,
    { kind: "idle" },
  );
  const [fileState, fileAction] = useActionState<ActionState, FormData>(
    addVideoResourceFile,
    { kind: "idle" },
  );

  useEffect(() => {
    if (urlState.kind === "success" || fileState.kind === "success") {
      onSuccess();
    }
  }, [urlState, fileState, onSuccess]);

  const maxMb = Math.round(VIDEO_RESOURCE_MAX_FILE_BYTES / 1024 / 1024);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size > VIDEO_RESOURCE_MAX_FILE_BYTES) {
      setFileError(
        `That file is ${formatMb(file.size)} MB - the limit is ${maxMb} MB.`,
      );
    } else {
      setFileError(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="border-t border-border bg-muted/30 px-6 py-3">
        <SegmentedControl
          aria-label="Attachment type"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "url", label: "Link" },
            { value: "file", label: "File" },
          ]}
        />
      </div>

      {tab === "url" ? (
        <form action={urlAction} className="flex flex-col">
          <input type="hidden" name="video_id" value={videoId} />
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="url-title">Title</Label>
              <Input
                id="url-title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. Anthropic prompt engineering guide"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url-url">URL</Label>
              <Input
                id="url-url"
                name="url"
                type="url"
                required
                placeholder="https://..."
              />
            </div>
            {urlState.kind === "error" && (
              <Alert variant="destructive">{urlState.message}</Alert>
            )}
          </div>
          <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <SubmitButton label="Add link" pendingLabel="Adding…" />
          </DialogFooter>
        </form>
      ) : (
        <form action={fileAction} className="flex flex-col">
          <input type="hidden" name="video_id" value={videoId} />
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="file-title">Title</Label>
              <Input
                id="file-title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. Workshop slides (PDF)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file-file">File</Label>
              <Input
                id="file-file"
                name="file"
                type="file"
                required
                accept={FILE_ACCEPT}
                onChange={handleFileChange}
                aria-invalid={fileError ? true : undefined}
                className="cursor-pointer"
              />
              {fileError ? (
                <p role="alert" className="text-xs text-destructive">
                  {fileError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Up to {maxMb} MB. Stored privately; signed download links are
                  minted on click.
                </p>
              )}
            </div>
            {fileState.kind === "error" && (
              <Alert variant="destructive">{fileState.message}</Alert>
            )}
          </div>
          <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <SubmitButton
              label="Upload"
              pendingLabel="Uploading…"
              disabled={fileError != null}
            />
          </DialogFooter>
        </form>
      )}
    </div>
  );
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function SubmitButton({
  label,
  pendingLabel,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled} loading={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
