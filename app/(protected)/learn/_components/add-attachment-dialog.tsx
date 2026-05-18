"use client";

import { useActionState, useState, type ReactElement } from "react";
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
import { addVideoResourceFile, addVideoResourceUrl } from "../actions";
import { VIDEO_RESOURCE_MAX_FILE_BYTES, type ActionState } from "../topics";

type Tab = "url" | "file";

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
  const [tab, setTab] = useState<Tab>("url");

  const [urlState, urlAction] = useActionState<ActionState, FormData>(
    addVideoResourceUrl,
    { kind: "idle" },
  );
  const [fileState, fileAction] = useActionState<ActionState, FormData>(
    addVideoResourceFile,
    { kind: "idle" },
  );

  const state = tab === "url" ? urlState : fileState;

  if (state.kind === "success" && open) {
    setOpen(false);
  }

  const maxMb = Math.round(VIDEO_RESOURCE_MAX_FILE_BYTES / 1024 / 1024);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add resource</DialogTitle>
          <DialogDescription>
            Attach a link or upload a file under {`"${videoTitle}"`}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-t border-border bg-muted/30 px-6 pt-3">
          <TabButton active={tab === "url"} onClick={() => setTab("url")}>
            Link
          </TabButton>
          <TabButton active={tab === "file"} onClick={() => setTab("file")}>
            File
          </TabButton>
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
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {urlState.message}
                </p>
              )}
            </div>
            <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
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
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Up to {maxMb} MB. Stored privately; signed download links
                  are minted on click.
                </p>
              </div>
              {fileState.kind === "error" && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {fileState.message}
                </p>
              )}
            </div>
            <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <SubmitButton label="Upload" pendingLabel="Uploading…" />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-border bg-background text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
