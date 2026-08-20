"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type GalleryEntry = {
  id: string;
  promptText: string | null;
  taskSolved: string | null;
  timeSaved: string | null;
  artefactUrl: string | null;
  authorName: string;
  isChampion: boolean;
  cohortName: string;
  team: string | null;
};

/**
 * One entry in the company prompt library.
 *
 * The copy button is the point of the whole surface - a prompt someone has to
 * retype is a prompt nobody reuses.
 */
export function PromptCard({ entry }: { entry: GalleryEntry }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!entry.promptText) return;
    await navigator.clipboard.writeText(entry.promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {entry.taskSolved ?? "Prompt"}
        </h3>
        {entry.timeSaved && (
          <span className="text-xs text-muted-foreground">
            saves {entry.timeSaved}
          </span>
        )}
      </div>

      {entry.promptText && (
        <pre className="mt-3 max-h-48 flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
          {entry.promptText}
        </pre>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {entry.promptText && (
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        )}
        {entry.artefactUrl && (
          <a
            href={entry.artefactUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            See it
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="text-foreground">{entry.authorName}</span>
        {entry.isChampion && <Badge variant="secondary">Champion</Badge>}
        {entry.team && <span>· {entry.team}</span>}
        <span>· {entry.cohortName}</span>
      </div>
    </article>
  );
}
