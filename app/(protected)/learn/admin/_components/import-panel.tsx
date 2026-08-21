"use client";

import { useActionState, useState } from "react";
import { AlertTriangleIcon, CheckIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { QUESTION_BY_ID } from "@/lib/programme/questions";
import {
  commitMayImport,
  previewMayImport,
  type ImportResult,
} from "../actions";

/**
 * The May 2026 import: upload, PREVIEW, then commit.
 *
 * The two-step exists because the failure mode here is silent. The importer
 * keys on column order, so a re-export with a shifted column files every
 * answer under the wrong question and produces scores that look completely
 * plausible. The preview shows per-question counts so they can be eyeballed
 * against the known distribution before anything is written.
 */
export function ImportPanel({
  expected,
}: {
  /** Committed ground-truth counts from the original export. */
  expected: Record<string, Record<string, number>>;
}) {
  const [previewState, previewAction, previewPending] = useActionState<
    ImportResult,
    FormData
  >(previewMayImport, { kind: "idle" });
  const [commitState, commitAction, commitPending] = useActionState<
    ImportResult,
    FormData
  >(commitMayImport, { kind: "idle" });

  const state = commitState.kind === "idle" ? previewState : commitState;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Import the May 2026 baseline
        </h3>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Upload the original export (<code>.xlsx</code> or{" "}
          <code>.csv</code>). Rows are matched on email and stored as the{" "}
          <code>may_2026</code> wave. Re-running changes nothing - the import
          upserts on (email, wave).
        </p>

        <form action={previewAction} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="file">Export file</Label>
            <Input id="file" name="file" type="file" accept=".xlsx,.csv" required />
          </div>
          <Button type="submit" disabled={previewPending}>
            <UploadIcon aria-hidden />
            {previewPending ? "Reading…" : "Preview"}
          </Button>
        </form>
      </div>

      {state.kind === "error" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive-ink">
          {state.message}
        </p>
      )}

      {state.kind === "done" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckIcon className="size-4 text-emerald-600" aria-hidden />
            Imported {state.inserted} responses.
          </p>
          {state.withoutAccount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {state.withoutAccount} of them have no AI Ops account yet. Their
              answers are stored against their email and will attach to their
              account the first time they sign in - they keep their baseline
              and stay in the before/after comparison.
            </p>
          )}
        </div>
      )}

      {previewState.kind === "preview" && commitState.kind === "idle" && (
        <PreviewPanel
          preview={previewState.preview}
          fileName={previewState.fileName}
          payload={previewState.payload}
          expected={expected}
          commitAction={commitAction}
          committing={commitPending}
        />
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  fileName,
  payload,
  expected,
  commitAction,
  committing,
}: {
  preview: Extract<ImportResult, { kind: "preview" }>["preview"];
  fileName: string;
  payload: string;
  expected: Record<string, Record<string, number>>;
  commitAction: (formData: FormData) => void;
  committing: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const headerOk = preview.headerCheck.ok;

  // Compare each question's answer counts against the committed ground truth.
  // A column shift cannot survive this - the totals would land on the wrong
  // question and every row would light up.
  const comparisons = Object.keys(expected).map((qid) => {
    const got = preview.distribution[qid] ?? {};
    const gotTotal = Object.values(got).reduce((a, b) => a + b, 0);
    const expTotal = Object.values(expected[qid]).reduce((a, b) => a + b, 0);
    return { qid, gotTotal, expTotal, matches: gotTotal === expTotal };
  });
  const mismatches = comparisons.filter((c) => !c.matches);
  const clean = headerOk && mismatches.length === 0 && preview.unmatchedCount === 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Preview - {fileName}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {preview.rowCount} rows, {preview.rowCount - preview.duplicatesDropped}{" "}
          unique respondents
          {preview.duplicatesDropped > 0 &&
            `, ${preview.duplicatesDropped} duplicate${preview.duplicatesDropped === 1 ? "" : "s"} dropped (kept the latest)`}
          .
        </p>
      </div>

      <Check
        ok={headerOk}
        okLabel="Column layout matches the verified mapping"
        badLabel={`${preview.headerCheck.problems.length} column(s) are not where they should be`}
      >
        {!headerOk && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {preview.headerCheck.problems.slice(0, 5).map((p) => (
              <li key={p.column}>
                Column {p.column}: expected “{p.expected}”, found “{p.found}”
              </li>
            ))}
          </ul>
        )}
      </Check>

      <Check
        ok={preview.unmatchedCount === 0}
        okLabel="Every answer matches an offered option"
        badLabel={`${preview.unmatchedCount} answer(s) match no offered option - they'll import unscored`}
      />

      <Check
        ok={mismatches.length === 0}
        okLabel="Answer counts match the original export"
        badLabel={`${mismatches.length} question(s) have a different number of answers than the original`}
      >
        {mismatches.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {mismatches.slice(0, 6).map((m) => (
              <li key={m.qid}>
                {QUESTION_BY_ID.get(m.qid)?.text ?? m.qid}: {m.gotTotal} vs{" "}
                {m.expTotal} expected
              </li>
            ))}
          </ul>
        )}
      </Check>

      {!clean && (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-foreground">
            I&apos;ve read the warnings above and want to import anyway.
            <span className="block text-xs text-muted-foreground">
              If the column layout has shifted, answers will be stored against
              the wrong questions and the scores will look plausible but be
              wrong.
            </span>
          </span>
        </label>
      )}

      <form action={commitAction}>
        <input type="hidden" name="payload" value={payload} />
        <Button type="submit" disabled={committing || (!clean && !acknowledged)}>
          {committing ? "Importing…" : `Import ${preview.rowCount} responses`}
        </Button>
      </form>
    </div>
  );
}

function Check({
  ok,
  okLabel,
  badLabel,
  children,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
          ok ? "text-emerald-600" : "text-amber-600",
        )}
      >
        {ok ? (
          <CheckIcon className="size-4" />
        ) : (
          <AlertTriangleIcon className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className={ok ? "text-muted-foreground" : "text-foreground"}>
          {ok ? okLabel : badLabel}
        </p>
        {children}
      </div>
    </div>
  );
}
