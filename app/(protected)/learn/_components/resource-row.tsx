"use client";

import { useTransition } from "react";
import { ExternalLinkIcon, TrashIcon } from "lucide-react";
import { deleteResource } from "../actions";

export function ResourceRow({
  id,
  title,
  url,
  description,
  addedByName,
  formattedDate,
  canDelete,
}: {
  id: string;
  title: string;
  url: string;
  description: string | null;
  addedByName: string;
  createdAt: string;
  formattedDate: string;
  canDelete: boolean;
}) {
  const [, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Remove "${title}"?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      void deleteResource(fd);
    });
  };

  // Hostname is shown so people can tell at a glance where the link goes
  // without having to hover. We hide errors silently if the URL is malformed
  // (RLS-side validation already rejected obvious junk).
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1 space-y-0.5">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
        >
          {title}
          <ExternalLinkIcon className="size-3 text-muted-foreground" />
        </a>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {host && (
            <>
              <span className="text-foreground/70">{host}</span>
              <span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span>
            </>
          )}
          Added by <span className="text-foreground">{addedByName}</span>
          <span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span>
          {formattedDate}
        </p>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 text-muted-foreground hover:text-red-600"
          aria-label="Remove resource"
          title="Remove resource"
        >
          <TrashIcon className="size-3.5" />
        </button>
      )}
    </li>
  );
}
